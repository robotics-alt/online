'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { ArrowLeft, ArrowRight, Check, BookOpen, Wallet, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function StudentLearningSetup() {
    const { user, go, fmt, language, publicData } = useApp(), t = useT(language), [step, setStep] = useState(0), [interest, setInterest] = useState(''), [level, setLevel] = useState('Beginner'), [goal, setGoal] = useState(''), [minimum, setMinimum] = useState<number | null>(null), [budget, setBudget] = useState(''), [days, setDays] = useState<{
        day: number;
        hours: number;
    }[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        api<{
            minimumHourlyRateCents: number | null;
            preferences: {
                budgetCents?: number;
                interests?: string;
                level?: string;
                goal?: string;
                availability?: string;
            } | null;
        }>('/api/registration/options').then(d => {
            setMinimum(d.minimumHourlyRateCents ?? 100);
            setBudget(String((d.preferences?.budgetCents ?? d.minimumHourlyRateCents ?? 2000) / 100));
            if (d.preferences) {
                setInterest(d.preferences.interests || '');
                setLevel(d.preferences.level || 'Beginner');
                setGoal(d.preferences.goal || '');
                try {
                    const value = JSON.parse(d.preferences.availability || '[]');
                    if (Array.isArray(value))
                        setDays(value);
                }
                catch { }
            }
        }).catch(e => setError(e.message));
    }, []);
    const titles = [t('learningGoals'), t('lessonBudget'), t('studyHours')], valid = step === 0 ? interest && goal.trim().length >= 3 : step === 1 ? minimum !== null && Number.isFinite(Number(budget)) && Number(budget) * 100 >= minimum : days.length > 0;
    const finish = async () => {
        setBusy(true);
        setError('');
        try {
            await api('/api/me', { method: 'PUT', json: { interests: interest, level, goal, budgetCents: Math.round(Number(budget) * 100), studyHours: days, timezone: user?.timezone } });
            await useApp.getState().refreshMe();
            go('search', { priceMax: String(Number(budget)) });
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    return <div className="learning-setup" data-student-setup><aside><span className="setup-label">{t('studentRegistration')}</span><h1>{t('yourLearningPlan')}</h1><p>{t('studentSetupIntro')}</p><ol>{uiText(titles.map((title, i) => <li key={title} aria-current={step === i ? 'step' : undefined}><span>{i < step ? <Check size={16}/> : uiText(i + 1)}</span>{uiText(title)}</li>))}</ol></aside><section><header><span>{t('step')} {uiText(step + 1)} / 3</span><h2>{uiText(titles[step])}</h2></header>{step === 0 ? <div className="setup-fields"><label>{t('whatToLearn')}<select className="feature-select" value={interest} onChange={e => setInterest(e.target.value)}><option value="">{t('chooseSubject')}</option>{(publicData?.subjects.length ? publicData.subjects.map(s => s.name) : ['Languages', 'Mathematics', 'Programming', 'Music', 'Business']).map(s => <option key={s} value={s}>{uiText(s)}</option>)}</select></label><label>{t('currentLevel')}<select className="feature-select" value={level} onChange={e => setLevel(e.target.value)}>{uiText(['Beginner', 'Intermediate', 'Advanced'].map(v => <option key={v} value={v}>{uiText(v)}</option>))}</select></label><label>{t('learningGoal')}<Input value={goal} maxLength={1000} onChange={e => setGoal(e.target.value)} placeholder={t('learningGoalPlaceholder')}/></label></div> : step === 1 ? <div className="setup-fields"><span className="setup-feature-icon"><Wallet /></span><p>{t('budgetExplanation')}</p><label>{t('hourlyBudgetUSD')}<Input aria-label={uiText("Hourly budget in USD")} type="number" min={minimum === null ? 1 : minimum / 100} max={100000} step="0.01" value={budget} onChange={e => setBudget(e.target.value)}/></label><p className="rounded-xl bg-primary/5 p-4 text-sm">{t('minimumAvailableRate')}: {minimum === null ? '...' : uiText(fmt(minimum))} {t('perHour')}</p></div> : <div className="setup-fields"><p>{t('studyHoursExplanation')}</p>{uiText(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => { const row = days.find(d => d.day === i); return <div className="study-day-row" key={day}><label><input type="checkbox" checked={Boolean(row)} onChange={e => setDays(e.target.checked ? [...days, { day: i, hours: 1 }] : days.filter(d => d.day !== i))}/>{t(day.toLowerCase())}</label>{row && <label className="study-hours-input"><Input aria-label={uiText("{{value1}} study hours", { value1: day })} type="number" min={.5} max={12} step={.5} value={row.hours} onChange={e => setDays(days.map(d => d.day === i ? { ...d, hours: Number(e.target.value) } : d))}/><span>{t('hours')}</span></label>}</div>; }))}<p className="text-sm text-muted-foreground">{t('total')}: {uiText(days.reduce((s, d) => s + d.hours, 0))} {t('hoursPerWeek')}</p></div>}{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<footer><Button variant="ghost" disabled={!step || busy} onClick={() => setStep(step - 1)}><ArrowLeft size={16}/>{t('back')}</Button><Button disabled={!valid || busy} onClick={() => step < 2 ? setStep(step + 1) : void finish()}>{busy ? t('saving') : step === 2 ? t('findMatchingTutors') : t('continue')}<ArrowRight size={16}/></Button></footer></section></div>;
}
