'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp, type TutorCard as Tutor } from '@/lib/store';
import { useT } from '@/lib/i18n';
import TutorCard from './TutorCard';
export default function BudgetTutorSuggestions() { const { language, go, fmt } = useApp(), t = useT(language), [budget, setBudget] = useState<number | null>(null), [rows, setRows] = useState<Tutor[]>([]); useEffect(() => { let live = true; api<{
    preferences: {
        budgetCents: number;
    } | null;
}>('/api/registration/options').then(async (d) => { if (!d.preferences?.budgetCents)
    return; const amount = d.preferences.budgetCents; const list = await api<{
    tutors: Tutor[];
}>('/api/tutors?priceMax=' + amount + '&sort=price_asc'); if (live) {
    setBudget(amount);
    setRows(list.tutors.slice(0, 3));
} }).catch(() => { }); return () => { live = false; }; }, []); if (budget === null)
    return null; return <section className="student-budget-suggestions"><header><div><h2>{t('recommendedTutors')}</h2><p>{uiText(fmt(budget))} {t('perHour')}</p></div><button onClick={() => go('search', { priceMax: String(budget / 100) })}>{t('findTutor')}</button></header>{rows.length ? <div>{uiText(rows.map(tutor => <TutorCard key={tutor.id} tutor={tutor} onOpen={() => go('tutor', { id: tutor.id })} onBook={() => go('tutor', { id: tutor.id, book: '1' })}/>))}</div> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">{uiText("No approved teacher is currently within this budget. Try increasing your budget.")}</p>}</section>; }
