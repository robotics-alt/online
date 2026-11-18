'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, GraduationCap, Loader2, ShieldCheck } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { ALL_COUNTRY_NAMES, timezoneForCountry, zonesForCountry } from '@/lib/country-timezones';
import { readList, type LanguageItem, type ExperienceItem, type SkillItem } from '@/lib/profile-data';
import LanguageListEditor from './LanguageListEditor';
import { ExperienceEditor, SkillEditor } from './ProfessionalFields';
import WorkingHoursEditor, { type WorkingRule } from './WorkingHoursEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import './platform-upgrades.css';
const steps = ['Introduction', 'Languages', 'Subjects & skills', 'Experience & proof', 'Lesson options', 'Working hours', 'Review & submit'];
export default function TeacherProfileForm({ embedded = false, onSaved, initialStep = 0, onlySection = false, onBack }: {
    embedded?: boolean;
    onSaved?: () => void | Promise<void>;
    initialStep?: number;
    onlySection?: boolean;
    onBack?: () => void;
}) {
    const { user, go, refreshMe } = useApp(), [step, setStep] = useState(initialStep), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [status, setStatus] = useState('DRAFT');
    const [subjects, setSubjects] = useState<{
        id: string;
        name: string;
    }[]>([]), [languages, setLanguages] = useState<LanguageItem[]>([]), [experiences, setExperiences] = useState<ExperienceItem[]>([]), [skills, setSkills] = useState<SkillItem[]>([]), [hours, setHours] = useState<WorkingRule[]>([]);
    const [form, setForm] = useState({ headline: '', about: '', education: '', methodology: '', country: user?.country || '', timezone: user?.timezone || 'UTC', hourlyRate: 20, onlineEnabled: true, faceToFaceEnabled: false, subjectIds: [] as string[] });
    useEffect(() => {
        let cancelled = false;
        Promise.all([api<{
                profile: Record<string, unknown>;
                pendingChange?: {
                    patchJson: string;
                    status: string;
                    reason?: string;
                } | null;
            }>('/api/tutor/profile'), api<{
                subjects: {
                    id: string;
                    name: string;
                }[];
            }>('/api/subjects')]).then(([data, available]) => {
            if (cancelled)
                return;
            const original = data.profile, pending = data.pendingChange?.status === 'PENDING' ? JSON.parse(data.pendingChange.patchJson) : {}, profile = { ...original, ...pending };
            setSubjects(available.subjects);
            setStatus(String(original.status));
            setForm(old => ({ ...old, headline: String(profile.headline || ''), about: String(profile.about || ''), education: String(profile.education || ''), methodology: String(profile.methodology || ''), hourlyRate: Number(profile.hourlyRateCents || 2000) / 100, onlineEnabled: profile.onlineEnabled !== false, faceToFaceEnabled: profile.faceToFaceEnabled === true, subjectIds: (profile.subjectIds as string[] | undefined) || ((profile.subjects as {
                    subject: {
                        id: string;
                    };
                }[]) || []).map(item => item.subject.id) }));
            setLanguages(readList<LanguageItem>(profile.languageItems));
            setExperiences(readList<ExperienceItem>(profile.experienceItems));
            setSkills(readList<SkillItem>(profile.skillItems));
            setHours((original.rules as WorkingRule[]) || []);
            if (data.pendingChange)
                setNotice(data.pendingChange.status === 'PENDING' ? 'Your professional changes are awaiting admin approval. Your approved profile stays live.' : data.pendingChange.reason || 'Previous review completed.');
        }).catch(error => setError(error.message)).finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
    }, [user?.id]);
    const edit = (key: keyof typeof form, value: unknown) => setForm(old => ({ ...old, [key]: value }));
    const save = async (submit = false, advance = false) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            if ((!onlySection || step === 5) && hours.some(item => !Number.isFinite(item.startMin) || !Number.isFinite(item.endMin) || item.endMin - item.startMin < 30))
                throw new Error('Each working period must last at least 30 minutes');
            if (submit && !hours.length)
                throw new Error('Add your working hours before submitting');
            if (submit && (!languages.length || !form.subjectIds.length))
                throw new Error('Add at least one language and subject');
            if (!onlySection || step === 5)
                await api('/api/tutor/availability', { method: 'PUT', json: { rules: hours } });
            const result = await api<{
                pendingReview?: boolean;
            }>('/api/tutor/profile', { method: 'PUT', json: onlySection ? { ...([{ headline: form.headline, about: form.about, country: form.country, timezone: form.timezone }, { languageItems: languages }, { subjectIds: form.subjectIds, skillItems: skills }, { experienceItems: experiences, education: form.education }, { hourlyRate: form.hourlyRate, onlineEnabled: form.onlineEnabled, faceToFaceEnabled: form.faceToFaceEnabled, methodology: form.methodology }][step] || {}), action: 'save' } : { ...form, languageItems: languages, experienceItems: experiences, skillItems: skills, action: submit && status !== 'APPROVED' ? 'submit' : 'save' } });
            await refreshMe();
            await onSaved?.();
            if (result.pendingReview)
                setNotice('Submitted for admin approval. Your public profile will update after review.');
            else
                setNotice(submit ? 'Application submitted for review.' : 'Progress saved.');
            if (submit && !embedded)
                go('tutor-dash');
            else if (advance)
                setStep(old => Math.min(6, old + 1));
        }
        catch (error) {
            setError((error as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    if (loading)
        return <div className="p-10"><Loader2 className="animate-spin"/>{uiText("Loading your teaching profile\u2026")}</div>;
    if (user?.role !== 'TUTOR')
        return <div className="p-10">{uiText("Create a teacher account to apply.")}</div>;
    return <div className={`teacher-application ${embedded ? 'is-embedded' : ''} ${onlySection ? 'is-section-editor' : ''}`}>{!onlySection && <aside><span className="application-mark"><GraduationCap size={28}/></span><p>{uiText("YOUR TEACHING JOURNEY")}</p><h1>{embedded ? uiText("Your professional profile") : uiText("Build a profile students can trust.")}</h1><p>{uiText("Show your strengths, upload your qualifications and choose when you teach.")}</p><ol>{uiText(steps.map((label, index) => <li key={label}><button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{index < step ? <Check size={16}/> : uiText(index + 1)}</span>{uiText(label)}</button></li>))}</ol><div className="application-trust"><ShieldCheck size={22}/><span>{uiText("Qualifications and professional changes are reviewed by the admin team.")}</span></div></aside>}<main>{!onlySection && <header><span>{onlySection ? uiText("EDIT PROFILE") : <>{uiText("STEP ")}{uiText(step + 1)}{uiText(" OF ")}{uiText(steps.length)}</>}</span><h2>{uiText(steps[step])}</h2><div className="application-progress"><span style={{ width: `${(step + 1) / steps.length * 100}%` }}/></div></header>}
    {step === 0 && <section className="application-fields"><label>{uiText("Professional headline")}<Input value={form.headline} maxLength={160} placeholder={uiText("Certified mathematics teacher \u00B7 IGCSE & IB")} onChange={e => edit('headline', e.target.value)}/></label><label>{uiText("About your teaching")}<Textarea rows={6} value={form.about} placeholder={uiText("Tell students about your approach, strengths and who your lessons are for (at least 80 characters).")} onChange={e => edit('about', e.target.value)} maxLength={8000}/></label><div className="professional-two-columns"><label>{uiText("Country")}<select value={form.country} onChange={e => { edit('country', e.target.value); edit('timezone', timezoneForCountry(e.target.value, Intl.DateTimeFormat().resolvedOptions().timeZone)); }}><option value="">{uiText("Choose country")}</option>{uiText(ALL_COUNTRY_NAMES.map(name => <option key={name} value={name}>{name}</option>))}</select></label><label>{uiText("Local timezone")}<select value={form.timezone} onChange={e => edit('timezone', e.target.value)}>{uiText([...new Set([form.timezone, ...zonesForCountry(form.country)])].map(zone => <option key={zone} value={zone}>{uiText(zone)}</option>))}</select></label></div><p className="text-sm text-muted-foreground">{uiText("Your country suggests a timezone. Choose the right region if your country has more than one.")}</p></section>}
    {step === 1 && <section className="application-fields"><p>{uiText("List every language you speak and your level. Students will see approved language levels on your profile.")}</p><LanguageListEditor value={languages} onChange={setLanguages}/></section>}
    {step === 2 && <section className="application-fields"><h3>{uiText("Teaching subjects")}</h3><div className="subject-choice-grid">{subjects.map(subject => <button type="button" key={subject.id} aria-pressed={form.subjectIds.includes(subject.id)} onClick={() => edit('subjectIds', form.subjectIds.includes(subject.id) ? form.subjectIds.filter(id => id !== subject.id) : [...form.subjectIds, subject.id].slice(0, 8))}><BookOpen size={16}/>{subject.name}</button>)}</div><h3>{uiText("Skills and specialities")}</h3><SkillEditor value={skills} onChange={setSkills}/></section>}
    {step === 3 && <section className="application-fields"><ExperienceEditor value={experiences} onChange={setExperiences}/><label>{uiText("Education")}<Input value={form.education} onChange={e => edit('education', e.target.value)} placeholder={uiText("Degree / training")}/></label><label>{uiText("Teaching approach")}<Textarea rows={3} value={form.methodology} onChange={e => edit('methodology', e.target.value)}/></label></section>}
    {step === 4 && <section className="application-fields"><label>{uiText("Full lesson hourly rate (USD)")}<Input type="number" min={1} max={1000} value={form.hourlyRate} onChange={e => edit('hourlyRate', Number(e.target.value))}/></label><p className="rounded-xl bg-primary/10 p-4 text-sm">{uiText("First trials are free. Full appointments require admin payment approval.")}</p><fieldset><legend>{uiText("Lesson formats")}</legend><label className="application-check"><input type="checkbox" checked={form.onlineEnabled} onChange={e => edit('onlineEnabled', e.target.checked)}/>{uiText("Online video lessons")}</label><label className="application-check"><input type="checkbox" checked={form.faceToFaceEnabled} onChange={e => edit('faceToFaceEnabled', e.target.checked)}/>{uiText("Face-to-face lessons")}</label></fieldset></section>}
    {step === 5 && <WorkingHoursEditor value={hours} onChange={setHours} timezone={form.timezone}/>}
    {step === 6 && <section className="application-summary"><ShieldCheck size={32}/><h3>{uiText("Ready for review")}</h3><p>{form.headline || uiText("Add your professional headline")}</p><dl><div><dt>{uiText("Languages")}</dt><dd>{languages.map(item => `${item.name} (${item.level.split(' · ')[0]})`).join(', ') || uiText("Not added")}</dd></div><div><dt>{uiText("Experience entries")}</dt><dd>{uiText(experiences.length)}</dd></div><div><dt>{uiText("Subjects / skills")}</dt><dd>{uiText(form.subjectIds.length)} / {uiText(skills.length)}</dd></div><div><dt>{uiText("Working periods")}</dt><dd>{uiText(hours.length)} · {uiText(form.timezone)}</dd></div></dl><p>{uiText("Attach evidence for institutional and programme claims. Administrators review professional changes before they appear to students.")}</p></section>}
    {error && <p className="application-error" role="alert">{uiText(error)}</p>}{notice && <p className="application-notice" role="status">{uiText(notice)}</p>}<footer>{onlySection ? <><Button disabled={busy} onClick={() => void save(false)}>{uiText("Save changes")}</Button></> : <><Button type="button" variant="ghost" disabled={busy || step === 0} onClick={() => setStep(old => old - 1)}><ChevronLeft size={16}/>{uiText("Back")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)}>{uiText("Save progress")}</Button><Button type="button" disabled={busy} onClick={() => void save(step === 6, step < 6)}>{busy ? <Loader2 className="animate-spin" size={16}/> : step === 6 ? <ShieldCheck size={16}/> : <ChevronRight size={16}/>}{step === 6 ? status === 'APPROVED' ? uiText("Submit changes") : uiText("Submit application") : uiText("Save & continue")}</Button></>}</footer></main></div>;
}
