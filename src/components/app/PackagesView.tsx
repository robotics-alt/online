'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarDays, Package, Check, ChevronRight } from 'lucide-react';
type Product = {
    id: string;
    name: string;
    description: string;
    lessons: number;
    weeklyLessons: number;
    priceCents: number;
    featured: boolean;
    active: boolean;
    teachers: {
        id: string;
        userId: string;
        user: {
            name: string;
            avatarUrl: string | null;
        };
    }[];
    classes: {
        id: string;
        title: string;
    }[];
};
type Credit = {
    id: string;
    packageId: string;
    note: string;
    remaining: number;
    total: number;
    expired: boolean;
    purchase?: {
        weeklyLessons: number;
    } | null;
};
type Slot = {
    kind: 'lesson' | 'group';
    tutorProfileId?: string;
    groupId?: string;
    startUtc: string;
    endUtc: string;
    label: string;
};
export function PackageStrip() { return <PackagesView strip/>; }
export function PackagesView({ strip = false }: {
    strip?: boolean;
}) {
    const { user, go, fmt, refreshMe } = useApp(), [items, setItems] = useState<Product[]>([]), [credits, setCredits] = useState<Credit[]>([]), [selected, setSelected] = useState<Product | null>(null), [credit, setCredit] = useState<Credit | null>(null), [week, setWeek] = useState(new Date().toISOString().slice(0, 10)), [slots, setSlots] = useState<Slot[]>([]), [chosen, setChosen] = useState<Slot[]>([]), [method, setMethod] = useState('WALLET'), [coupon, setCoupon] = useState(''), [reference, setReference] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [quote, setQuote] = useState<{
        totalCents: number;
        discountCents: number;
    } | null>(null), [quoteError, setQuoteError] = useState('');
    const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const load = () => {
        api<{
            packages: Product[];
        }>('/api/packages').then(d => setItems(d.packages)).catch(e => setError(e.message));
        if (user?.role === 'STUDENT' && !strip)
            api<{
                credits: Credit[];
            }>('/api/wallet').then(d => setCredits(d.credits)).catch(e => setError(e.message));
    };
    useEffect(load, [user?.id, strip]);
    useEffect(() => {
        if (!selected || credit)
            return;
        setQuote(null);
        setQuoteError('');
        let live = true;
        const t = setTimeout(() => api<{
            totalCents: number;
            discountCents: number;
        }>(`/api/packages?packageId=${selected.id}&couponCode=${encodeURIComponent(coupon)}`).then(d => {
            if (live)
                setQuote(d);
        }).catch(e => {
            if (live)
                setQuoteError(e.message);
        }), 250);
        return () => { live = false; clearTimeout(t); };
    }, [selected?.id, coupon, credit?.id]);
    useEffect(() => {
        if (!selected)
            return;
        setChosen([]);
        setSlots([]);
        setError('');
        let live = true;
        api<{
            slots: Slot[];
        }>(`/api/packages/schedule?packageId=${selected.id}${credit ? '&creditId=' + credit.id : ''}&week=${week}&timezone=${encodeURIComponent(timezone)}`).then(d => {
            if (live)
                setSlots(d.slots);
        }).catch(e => {
            if (live)
                setError(e.message);
        });
        return () => { live = false; };
    }, [selected?.id, credit?.id, week, timezone]);
    const choose = (p: Product, c: Credit | null = null) => {
        if (!user) {
            go('auth', { mode: 'login' });
            return;
        }
        if (user.role !== 'STUDENT') {
            setError('A student account is needed to reserve a package.');
            return;
        }
        setSelected(p);
        setCredit(c);
        setCoupon('');
        setReference('');
        setError('');
        setMethod('WALLET');
    };
    const submit = async () => {
        if (!selected)
            return;
        setBusy(true);
        setError('');
        try {
            await api('/api/packages/schedule', { method: 'POST', json: { packageId: selected.id, creditId: credit?.id, week, timezone, slots: chosen, paymentMethod: method, couponCode: coupon || undefined, paymentReference: reference } });
            setSelected(null);
            setNotice('Your selected lessons have been reserved for administrator approval.');
            await refreshMe();
            load();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    const shown = strip ? items.filter(p => p.featured && p.active).slice(0, 3) : items.filter(p => p.active);
    if (strip && !shown.length)
        return null;
    return <section className="mx-auto w-full max-w-7xl px-4 py-10" aria-label={uiText("Lesson packages")}><header className="mb-6 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{uiText("Plan your progress")}</p><h2 className="mt-2 text-2xl font-bold">{uiText("Lesson packages")}</h2><p className="mt-2 text-sm text-muted-foreground">{uiText("Choose your teachers and reserve available lessons each week.")}</p></div>{strip && <Button variant="outline" onClick={() => go('packages')}>{uiText("View all")}<ChevronRight size={16}/></Button>}</header>{notice && <p role="status" className="mb-5 rounded-xl bg-primary/10 p-4">{uiText(notice)}</p>}{error && !selected && <p role="alert" className="text-destructive">{uiText(error)}</p>}{!strip && credits.some(c => !c.expired && c.remaining > 0) && <div className="mb-8 space-y-3"><h3 className="font-semibold">{uiText("Your packages")}</h3>{uiText(credits.filter(c => !c.expired && c.remaining > 0).map(c => <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5" key={c.id}><div><strong>{c.note || uiText("Lesson package")}</strong><p className="text-sm text-muted-foreground">{uiText(c.remaining)}{uiText(" of ")}{uiText(c.total)}{uiText(" lessons available")}</p></div><Button variant="outline" onClick={() => {
                    const p = items.find(p => p.id === c.packageId);
                    if (p)
                        choose(p, c);
                    else
                        go('search');
                }}><CalendarDays size={16}/>{uiText("Choose this week\u2019s lessons")}</Button></div>))}</div>}<div className="grid gap-5 md:grid-cols-3">{shown.map(p => <article key={p.id} className="flex min-w-0 flex-col rounded-3xl border bg-card p-6 shadow-sm"><span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package size={24}/></span><h3 className="text-xl font-bold">{p.name}</h3><p className="mt-2 flex-1 text-sm text-muted-foreground">{uiText(p.description)}</p><p className="mt-5 text-3xl font-bold">{uiText(fmt(p.priceCents))}</p><p className="mt-1 text-sm">{uiText(p.lessons)}{uiText(" lessons \u00B7 ")}{uiText(p.weeklyLessons)}{uiText(" per week")}</p><div className="my-5 space-y-2 text-sm">{p.teachers.map(t => <p key={t.id} className="flex items-center gap-2"><Check size={14} className="text-primary"/>{t.user.name}</p>)}{uiText(p.classes.map(c => <p key={c.id} className="flex items-center gap-2"><Check size={14} className="text-primary"/>{uiText(c.title)}</p>))}{!p.teachers.length && !p.classes.length && <p>{uiText("Teacher availability will be shown when scheduling.")}</p>}</div><Button onClick={() => choose(p)}>{uiText("Select weekly lessons")}</Button></article>)}</div>{!shown.length && !strip && <p className="rounded-2xl border p-8 text-muted-foreground">{uiText("New packages will appear here when published.")}</p>}<Dialog open={!!selected} onOpenChange={open => {
            if (!open && !busy)
                setSelected(null);
        }}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"><DialogTitle>{credit ? uiText("Schedule package lessons") : selected?.name}</DialogTitle><DialogDescription>{uiText("Select ")}{credit ? uiText("up to ") : ''}{uiText(Math.min(credit?.purchase?.weeklyLessons || selected?.weeklyLessons || 1, credit?.remaining || selected?.lessons || 1))}{uiText(" available lessons for a Monday-to-Sunday week. Times are shown in ")}{uiText(timezone)}{uiText(". An administrator will confirm your reservation.")}</DialogDescription><label className="text-sm">{uiText("Week containing")}<Input aria-label={uiText("Package week starts")} type="date" value={week} onChange={e => setWeek(e.target.value)}/></label><div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{uiText(slots.map((s, i) => { const active = chosen.includes(s); return <button key={i} aria-pressed={active} onClick={() => setChosen(old => active ? old.filter(v => v !== s) : old.length < Math.min(credit?.purchase?.weeklyLessons || selected?.weeklyLessons || 1, credit?.remaining || selected?.lessons || 1) ? [...old, s] : old)} className={`rounded-xl border p-3 text-left text-sm ${active ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted'}`}><strong className="block">{uiText(s.label)}</strong><span>{uiText(new Date(s.startUtc).toLocaleString(undefined, { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span><small className="block text-muted-foreground">{s.kind === 'group' ? uiText("Group class") : uiText("Private lesson")}</small></button>; }))}{!slots.length && <p className="p-3 text-sm text-muted-foreground">{uiText("No available slots in this week. Choose another week.")}</p>}</div><p className="text-sm">{uiText(chosen.length)}{uiText(" selected")}</p>{!credit && <div className="space-y-3"><label className="block text-sm">{uiText("Payment method")}<select className="feature-select" value={method} onChange={e => setMethod(e.target.value)}><option value="WALLET">{uiText("Wallet \u00B7 ")}{uiText(fmt(user?.walletCents || 0))}{uiText(" available")}</option><option value="BANK_TRANSFER">{uiText("Bank transfer")}</option><option value="CASH">{uiText("Cash / administrator")}</option></select></label>{method === 'BANK_TRANSFER' && <label className="block text-sm">{uiText("Transfer reference")}<Input value={reference} onChange={e => setReference(e.target.value)}/></label>}<label className="block text-sm">{uiText("Coupon code (optional)")}<Input maxLength={40} value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())}/></label><p className="text-sm text-muted-foreground">{uiText("Total: ")}{uiText(fmt(quote?.totalCents ?? selected?.priceCents ?? 0))}{quote?.discountCents ? uiText(" (coupon saves {{value1}})", { value1: fmt(quote.discountCents) }) : ''}{uiText(". Wallet funds are reserved pending approval and returned if rejected.")}</p></div>}{quoteError && <p role="alert" className="text-destructive">{uiText(quoteError)}</p>}{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<Button disabled={busy || !chosen.length || !credit && (!quote || !!quoteError)} onClick={() => void submit()}>{busy ? uiText("Reserving\u2026") : uiText("Submit for approval")}</Button></DialogContent></Dialog></section>;
}
