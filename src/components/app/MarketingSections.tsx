'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp, type TutorCard as Teacher } from '@/lib/store';
import { normalizeMarketing } from '@/lib/marketing-config';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Gamepad2, Star } from 'lucide-react';
export function MarketingHero() {
    const { publicData, go, fmt } = useApp(), config = normalizeMarketing(publicData?.settings.marketing), slides = config.slides.filter(s => s.active), [index, setIndex] = useState(0), [teacher, setTeacher] = useState<Teacher | null>(null);
    const slide = slides[index % Math.max(slides.length, 1)], teacherId = slide?.teacherId || publicData?.featuredTutors[0]?.id;
    useEffect(() => {
        if (slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches)
            return;
        const t = setInterval(() => setIndex(i => (i + 1) % slides.length), 7000);
        return () => clearInterval(t);
    }, [slides.length]);
    useEffect(() => {
        let live = true;
        setTeacher(publicData?.featuredTutors.find(t => t.id === teacherId) || null);
        if (teacherId)
            api<{
                tutor: Teacher;
            }>('/api/tutors/' + teacherId).then(d => {
                if (live)
                    setTeacher(d.tutor);
            }).catch(() => { });
        return () => { live = false; };
    }, [teacherId, publicData?.featuredTutors]);
    const action = () => {
        const target = slide?.destination || 'search';
        if (target === 'tutor') {
            if (teacherId)
                go('tutor', { id: teacherId });
            else
                go('search');
        }
        else
            go(target);
    };
    return <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-amber-500/5">{slide?.imageId && <><img src={'/api/media/' + slide.imageId} alt="" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-background/85"/></>}<div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 md:py-20 lg:grid-cols-[1.2fr_1fr]"><div><span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-primary"><GraduationCap size={16}/>{uiText("Learning designed around you")}</span><h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl xl:text-6xl">{slide?.title || publicData?.settings.heroTitle || uiText("Learn anything. From anywhere.")}</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{slide?.subtitle || uiText(publicData?.settings.heroSubtitle)}</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" className="rounded-xl px-7" onClick={action}>{slide?.buttonText || uiText("Find your teacher")}<ArrowRight size={18}/></Button><Button size="lg" variant="outline" className="rounded-xl" onClick={() => go('classes')}>{uiText("Explore classes")}</Button></div>{slides.length > 1 && <div className="mt-7 flex items-center gap-3"><button aria-label={uiText("Previous slide")} className="rounded-full border p-2" onClick={() => setIndex((index + slides.length - 1) % slides.length)}><ChevronLeft size={18}/></button>{uiText(slides.map((s, i) => <button key={s.id} aria-label={uiText("Show slide {{value1}}", { value1: (i + 1) })} aria-current={i === index % slides.length} className={`h-2.5 rounded-full ${i === index % slides.length ? 'w-7 bg-primary' : 'w-2.5 bg-muted-foreground/30'}`} onClick={() => setIndex(i)}/>))}<button aria-label={uiText("Next slide")} className="rounded-full border p-2" onClick={() => setIndex((index + 1) % slides.length)}><ChevronRight size={18}/></button></div>}</div><div className="rounded-3xl border bg-card p-6 shadow-xl sm:p-8"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><GraduationCap size={24}/></span><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{uiText("Your next step")}</p><h2 className="text-lg font-bold">{uiText("Meet your teacher")}</h2></div></div>{teacher ? <><div className="flex items-center gap-4">{teacher.avatarUrl ? <img src={teacher.avatarUrl} alt="" className="h-20 w-20 rounded-2xl object-cover"/> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-bold text-primary">{teacher.name?.[0]}</span>}<div><h3 className="text-xl font-bold">{teacher.name}</h3><p className="mt-1 text-sm text-muted-foreground">{teacher.country}</p>{teacher.rating && <p className="mt-1 flex items-center gap-1 text-sm"><Star size={14} className="fill-amber-400 text-amber-500"/>{uiText(teacher.rating)} · {uiText(teacher.reviewCount)}{uiText(" reviews")}</p>}</div></div><p className="mt-5 text-muted-foreground">{uiText(teacher.headline)}</p><div className="my-5 rounded-2xl bg-muted/50 p-4"><strong className="text-2xl">{uiText(fmt(teacher.hourlyRateCents))}</strong><span className="text-sm text-muted-foreground">{uiText(" / lesson")}</span><p className="mt-2 text-sm">{uiText("Personal guidance \u00B7 Interactive classroom")}</p></div><Button variant="outline" className="w-full" onClick={() => go('tutor', { id: teacher.id })}>{uiText("View teacher & availability")}<ArrowRight size={16}/></Button></> : <div className="space-y-4 py-4"><h3 className="text-2xl font-semibold">{uiText("A clear path to progress")}</h3><p className="text-muted-foreground">{uiText("Expert teachers, live lessons and a schedule that fits your life.")}</p><Button variant="outline" onClick={() => go('search')}>{uiText("Explore teachers")}</Button></div>}</div></div></section>;
}
export function HomepageStats() {
    const { publicData } = useApp(), config = normalizeMarketing(publicData?.settings.marketing);
    if (!config.statisticsEnabled)
        return null;
    return <section className="border-b bg-card"><div className="mx-auto flex max-w-7xl flex-wrap justify-evenly gap-8 px-5 py-9">{uiText((Object.keys(config.statistics) as (keyof typeof config.statistics)[]).filter(k => config.statistics[k].enabled).map(k => <div key={k} className="min-w-28 text-center"><strong className="text-3xl font-bold text-primary">{uiText((config.statistics[k].mode === 'manual' ? config.statistics[k].value : publicData?.stats[k] || 0).toLocaleString())}</strong><p className="mt-2 text-sm text-muted-foreground">{uiText(config.statistics[k].label)}</p></div>))}</div></section>;
}
export function HomepageGames() {
    const { publicData, go } = useApp(), config = normalizeMarketing(publicData?.settings.marketing), [games, setGames] = useState<{
        id: string;
        slug: string;
        name: string;
        tagline: string;
    }[]>([]);
    useEffect(() => {
        api<{
            games: typeof games;
        }>('/api/games').then(d => setGames(d.games)).catch(() => { });
    }, []);
    if (!config.gamesEnabled)
        return null;
    const shown = games.filter(g => !config.gameIds.length || config.gameIds.includes(g.id)).slice(0, 4);
    return <section className="mx-auto max-w-7xl px-4 py-12"><h2 className="text-2xl font-bold">{uiText(config.gamesTitle)}</h2><p className="mt-2 text-muted-foreground">{uiText(config.gamesSubtitle)}</p><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{shown.map(g => <button className="rounded-2xl border bg-card p-5 text-left transition hover:border-primary" key={g.id} onClick={() => go('games', { game: g.slug })}><Gamepad2 className="mb-4 text-primary"/><h3 className="font-semibold">{g.name}</h3><p className="mt-2 text-sm text-muted-foreground">{uiText(g.tagline)}</p></button>)}</div></section>;
}
