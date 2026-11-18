'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { useApp, api, LANGUAGES } from '@/lib/store';
import { ALL_COUNTRY_NAMES, timezoneForCountry, zonesForCountry } from '@/lib/country-timezones';
import { ChevronRight, ArrowLeft, UserRound, Languages as LanguageIcon, BookOpen, Briefcase, Video, ShieldCheck, Palette, CalendarDays, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TeacherProfileForm from './TeacherProfileForm';
import ThemeToggle from './ThemeToggle';
export default function TeacherAccount({ onSaved }: {
    onSaved?: () => void | Promise<void>;
}) {
    const { user, publicData, go, back, view, refreshMe, language, currency, setLanguage, setCurrency } = useApp(), screen = view.params?.section || 'home', [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [form, setForm] = useState({ name: user?.name || '', country: user?.country || '', timezone: user?.timezone || 'UTC', currentPassword: '', newPassword: '', confirm: '' });
    if (!user)
        return null;
    const sections = [{ title: 'Introduction', hint: 'Your headline, biography and location', Icon: UserRound, step: 0 }, { title: 'Languages', hint: 'Spoken languages and proficiency levels', Icon: LanguageIcon, step: 1 }, { title: 'Subjects & skills', hint: 'What you teach and your specialties', Icon: BookOpen, step: 2 }, { title: 'Experience & qualifications', hint: 'Your background and supporting certificates', Icon: Briefcase, step: 3 }, { title: 'Lesson options', hint: 'Pricing, online and face-to-face lessons', Icon: Video, step: 4 }];
    const accountBack = () => {
        const parent = window.history.state?.tsParent;
        if (parent?.name === 'tutor-dash' && parent.params?.tab === 'profile' && !parent.params?.section)
            back();
        else
            go('tutor-dash', { tab: 'profile' });
    };
    const title = screen.startsWith('profile:') ? sections[Number(screen.split(':')[1])]?.title : ({ home: 'My account', personal: 'Personal details', security: 'Password & security', preferences: 'Appearance & preferences' } as Record<string, string>)[screen];
    const change = (next: string) => {
        if (next === 'personal')
            setForm(old => ({ ...old, name: user.name, country: user.country || '', timezone: user.timezone }));
        go('tutor-dash', { tab: 'profile', ...(next === 'home' ? {} : { section: next }) });
        setMessage('');
    };
    const save = async () => {
        setBusy(true);
        setMessage('');
        try {
            if (screen === 'security') {
                if (form.newPassword !== form.confirm || form.newPassword.length < 12)
                    throw Error('Use matching passwords with at least 12 characters');
                await api('/api/me', { method: 'PUT', json: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
                setForm({ ...form, currentPassword: '', newPassword: '', confirm: '' });
            }
            else
                await api('/api/me', { method: 'PUT', json: { name: form.name, country: form.country, timezone: form.timezone } });
            await refreshMe();
            setMessage('Changes saved.');
        }
        catch (e) {
            setMessage((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    const row = (title: string, hint: string, Icon: typeof UserRound, onClick: () => void) => <button key={title} type="button" className="flex min-h-20 w-full items-center gap-4 border-b p-4 text-start last:border-b-0 hover:bg-muted/40" onClick={onClick}><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={21}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{uiText(title)}</strong></span><ChevronRight className="shrink-0 text-muted-foreground" size={18}/></button>;
    return <div className="mx-auto max-w-3xl space-y-5 pb-6" data-teacher-account><header className="teacher-account-heading">{screen !== 'home' && <Button variant="ghost" size="icon" aria-label={uiText("Back to my account")} onClick={accountBack}><ArrowLeft size={22}/></Button>}<h1>{title || uiText("My account")}</h1></header>{screen.startsWith('profile:') ? <TeacherProfileForm key={screen} embedded onlySection initialStep={Number(screen.split(':')[1])} onSaved={onSaved}/> : screen === 'home' ? <><header className="flex items-center gap-4 rounded-2xl border bg-card p-5">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-16 rounded-2xl object-cover"/> : <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">{user.name[0]}</span>}<div className="min-w-0"><h2 className="mt-1 break-words text-xl font-semibold">{user.name}</h2><p className="mt-1 text-sm text-muted-foreground">{uiText(user.tutorStatus?.toLowerCase())}{uiText(" teaching profile")}</p></div></header>{user.tutorProfileId && <Button className="w-full" variant="outline" onClick={() => go('tutor', { id: user.tutorProfileId! })}>{uiText("View public profile")}<ExternalLink size={15}/></Button>}<section className="overflow-hidden rounded-2xl border bg-card"><h3 className="border-b px-5 py-4 font-semibold">{uiText("Teaching profile")}</h3>{uiText(sections.map(s => row(s.title, s.hint, s.Icon, () => change('profile:' + s.step))))}</section><p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={17} className="shrink-0"/>{uiText("Changes to professional information are reviewed by the administrator.")}</p><section className="overflow-hidden rounded-2xl border bg-card"><h3 className="border-b px-5 py-4 font-semibold">{uiText("Account & preferences")}</h3>{uiText(row('Personal details', 'Name, country and timezone', UserRound, () => change('personal')))}{uiText(row('Password & security', 'Update your sign-in password', ShieldCheck, () => change('security')))}{uiText(row('Appearance & preferences', 'Theme, language and currency', Palette, () => change('preferences')))}{uiText(row('Availability & time off', 'Working hours, vacations and blocked dates', CalendarDays, () => go('tutor-dash', { tab: 'schedule-settings', from: 'account' })))}</section></> : <><section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-7">{screen === 'personal' && <><label className="grid gap-2 text-sm">{uiText("Full name")}<Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><label className="grid gap-2 text-sm">{uiText("Email")}<Input value={user.email} readOnly/></label><label className="grid gap-2 text-sm">{uiText("Country")}<select className="feature-select" value={form.country} onChange={e => setForm({ ...form, country: e.target.value, timezone: timezoneForCountry(e.target.value, form.timezone) })}><option value="">{uiText("Choose country")}</option>{uiText(ALL_COUNTRY_NAMES.map(name => <option key={name} value={name}>{name}</option>))}</select></label><label className="grid gap-2 text-sm">{uiText("Timezone")}<select className="feature-select" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>{uiText([...new Set([form.timezone, ...zonesForCountry(form.country)])].map(zone => <option key={zone} value={zone}>{uiText(zone)}</option>))}</select></label></>}{screen === 'security' && uiText((['currentPassword', 'newPassword', 'confirm'] as const).map((key, i) => <label key={key} className="grid gap-2 text-sm">{uiText(['Current password', 'New password', 'Confirm new password'][i])}<Input type="password" autoComplete={i ? 'new-password' : 'current-password'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>))}{screen === 'preferences' ? <><div className="flex items-center justify-between rounded-xl border p-4"><span className="text-sm">{uiText("Light or dark theme")}</span><ThemeToggle /></div><label className="grid gap-2 text-sm">{uiText("Language")}<select className="feature-select" value={language} onChange={e => setLanguage(e.target.value)}>{uiText(LANGUAGES.filter(l => publicData?.settings.enabledLanguages.includes(l.code)).map(l => <option key={l.code} value={l.code}>{uiText(l.label)}</option>))}</select></label><label className="grid gap-2 text-sm">{uiText("Currency")}<select className="feature-select" value={currency} onChange={e => setCurrency(e.target.value)}>{uiText(publicData?.settings.enabledCurrencies.map(c => <option key={c} value={c}>{uiText(c)}</option>))}</select></label><Button variant="outline" onClick={async () => {
                    try {
                        await api('/api/me', { method: 'PUT', json: { usePlatformDefaults: true } });
                        await refreshMe();
                    }
                    catch (e) {
                        setMessage((e as Error).message);
                    }
                }}>{uiText("Use platform defaults")}</Button></> : <Button disabled={busy} className="w-full" onClick={() => void save()}>{busy ? uiText("Saving\u2026") : uiText("Save changes")}</Button>}{message && <p role="status" className="text-sm">{message}</p>}</section></>}</div>;
}
