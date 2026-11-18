'use client';
import { uiText } from "@/lib/ui-text";
import { MarketingHero, HomepageStats, HomepageGames } from './MarketingSections';
import { PackageStrip } from './PackagesView';
import { CatalogIcon } from './CatalogIcon';
import { normalizeMarketing } from '@/lib/marketing-config';
import { GroupClassList } from './GroupClasses';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import { useT } from '@/lib/i18n';
import TutorCard from './TutorCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, GraduationCap, Video, CalendarCheck, Globe2, ShieldCheck, Wallet, LineChart, Sparkles, Users, BookOpenCheck, Star, MonitorSmartphone, Mail, Check, } from 'lucide-react';
const ICONS: Record<string, React.ComponentType<{
    className?: string;
}>> = {
    sigma: BookOpenCheck, languages: Globe2, code: Sparkles, atom: BookOpenCheck,
    'flask-conical': BookOpenCheck, music: Sparkles, piano: Sparkles, 'graduation-cap': GraduationCap,
    briefcase: LineChart, palette: Sparkles, 'book-open': BookOpenCheck,
};
export default function Landing() {
    const { publicData, go, fmt } = useApp();
    const t = useT(useApp((s) => s.language));
    const { toast } = useToast();
    const [q, setQ] = useState('');
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const marketing = normalizeMarketing(publicData?.settings.marketing);
    const subjects = publicData?.subjects ?? [];
    const featured = publicData?.featuredTutors ?? [];
    const stats = publicData?.stats ?? { students: 0, tutors: 0, lessons: 0 };
    const testimonials = publicData?.testimonials ?? [];
    const faqs = publicData?.faqs ?? [];
    const doSearch = () => go('search', q.trim() ? { q: q.trim() } : {});
    const subscribe = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast({ title: 'Please enter a valid email', variant: 'destructive' });
            return;
        }
        try {
            await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            setSubscribed(true);
            toast({ title: 'Subscribed!', description: 'You will receive learning tips and offers.' });
        }
        catch {
            toast({ title: 'Could not subscribe', variant: 'destructive' });
        }
    };
    return (<div className="landing-screen">
      <MarketingHero /><HomepageStats />
      {/* ============ POPULAR SUBJECTS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">{uiText("Popular subjects")}</h2>
            <p className="mt-2 text-muted-foreground">{uiText("Find an expert tutor for exactly what you want to learn.")}</p>
          </div>
          <Button variant="ghost" onClick={() => go('search')}>{uiText("View all \u2192")}</Button>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {subjects.slice(0, 10).map((s) => {
            const Icon = ICONS[s.icon] ?? BookOpenCheck;
            return (<button key={s.id} onClick={() => go('search', { subject: s.slug })} className="group rounded-2xl border border-border bg-card p-5 text-start transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <CatalogIcon name={s.icon} className="size-9"/>
                </span>
                <p className="mt-3 font-semibold text-foreground">{s.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{uiText(s.description)}</p>
              </button>);
        })}
        </div>
      </section>

      <PackageStrip /><HomepageGames />
      <GroupClassList strip title={uiText("Learn together in live group classes")}/>
      {/* ============ FEATURED TUTORS ============ */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">{uiText(marketing.featuredTitle)}</h2>
              <p className="mt-2 text-muted-foreground">{uiText(marketing.featuredSubtitle)}</p>
            </div>
            <Button variant="ghost" onClick={() => go('search')}>{uiText("Browse all \u2192")}</Button>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {uiText(featured.slice(0, 4).map((t) => (<TutorCard key={t.id} tutor={t} onOpen={() => go('tutor', { id: t.id })} onBook={() => go('tutor', { id: t.id, book: '1' })}/>)))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">{uiText("How online learning works")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">{uiText("From search to success in four simple steps.")}</p>
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          {uiText([
            { icon: Search, title: '1. Find your tutor', text: 'Filter by subject, price, language and availability. Read verified reviews.' },
            { icon: CalendarCheck, title: '2. Book a lesson', text: 'Pick a time in your own timezone and pay securely with wallet credits.' },
            { icon: Video, title: '3. Learn live', text: 'Meet in the interactive classroom: HD video, whiteboard, chat and files.' },
            { icon: LineChart, title: '4. Track progress', text: 'Set goals, get homework, and watch your skills grow lesson by lesson.' },
        ].map((step) => (<div key={step.title} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white">
                <step.icon className="h-5 w-5"/>
              </span>
              <h3 className="mt-4 font-semibold text-foreground">{uiText(step.title)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </div>)))}
        </div>
      </section>

      {/* ============ WHY US ============ */}
      <section className="bg-teal-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-bold md:text-3xl">{uiText("Why choose ")}{publicData?.settings.platformName ?? uiText("TutorSphere")}?</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {uiText([
            { icon: ShieldCheck, title: 'Verified tutors', text: 'Identity checks, qualification review and admin approval before any tutor can teach.' },
            { icon: Globe2, title: 'Your timezone, your language', text: 'Automatic timezone conversion and a multilingual interface with full RTL support.' },
            { icon: Wallet, title: 'Fair, transparent pricing', text: 'Wallet credits, lesson packages and refunds — every transaction on a real ledger.' },
            { icon: Video, title: 'A real classroom', text: 'Built-in HD video with a shared whiteboard, chat and attendance tracking. No downloads.' },
            { icon: Users, title: 'Safeguarding first', text: 'Guardian-linked child accounts and monitored messaging keep young learners safe.' },
            { icon: MonitorSmartphone, title: 'Works everywhere', text: 'A mobile-first experience that runs beautifully in any browser, on any device.' },
        ].map((f) => (<div key={f.title} className="rounded-2xl bg-card/5 p-6 ring-1 ring-white/10">
                <f.icon className="h-6 w-6 text-amber-400"/>
                <h3 className="mt-3 font-semibold">{uiText(f.title)}</h3>
                <p className="mt-2 text-sm text-stone-300">{f.text}</p>
              </div>)))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      {marketing.reviewsEnabled && <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">{uiText(marketing.reviewsTitle)}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {testimonials.slice(0, 4).map((tm) => (<Card key={tm.id} className="rounded-2xl border-border">
              <CardContent className="p-6">
                <div className="flex gap-0.5">
                  {uiText([1, 2, 3, 4, 5].map((i) => (<Star key={i} className={`h-4 w-4 ${i <= tm.rating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`}/>)))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">“{tm.content}”</p>
                <p className="mt-4 text-sm font-semibold text-foreground">{tm.name}</p>
                <p className="text-xs text-muted-foreground">{uiText(tm.role)}{tm.country ? uiText(" \u00B7 {{value1}}", { value1: tm.country }) : ''}</p>
              </CardContent>
            </Card>))}
        </div>
      </section>}

      {/* ============ TUTOR RECRUITMENT ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-12 text-white md:px-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">{uiText("Share your knowledge. Grow your income.")}</h2>
              <p className="mt-3 text-teal-100">{uiText("Join thousands of tutors earning on their own schedule. Set your price, keep 80% of every lesson, and get paid securely.")}</p>
              <ul className="mt-4 space-y-2 text-sm text-teal-50">
                {uiText(['Keep 80% of lesson revenue', 'Weekly payout requests', 'Powerful calendar and student tools'].map((x) => (<li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-300"/>{uiText(x)}</li>)))}
              </ul>
            </div>
            <div className="md:justify-self-end">
              <Button size="lg" onClick={() => go(useApp.getState().user ? 'onboarding-tutor' : 'auth', useApp.getState().user ? {} : { mode: 'register', role: 'TUTOR' })} className="h-12 rounded-xl bg-card px-8 text-teal-800 hover:bg-teal-50">{uiText("Apply as a tutor")}</Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">{uiText("Frequently asked questions")}</h2>
          <Accordion type="single" collapsible className="mt-8">
            {uiText(faqs.map((f) => (<AccordionItem key={f.id} value={f.id}>
                <AccordionTrigger className="text-start text-foreground">{uiText(f.question)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{uiText(f.answer)}</AccordionContent>
              </AccordionItem>)))}
          </Accordion>
        </div>
      </section>

      {/* ============ MOBILE LEARNING + NEWSLETTER ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">{uiText("Learn on the go")}</h2>
            <p className="mt-3 text-muted-foreground">{uiText("Every part of ")}{publicData?.settings.platformName ?? uiText("TutorSphere")}{uiText(" \u2014 search, booking, classroom, messaging \u2014 works beautifully on your phone browser. No app download needed.")}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {uiText(['One-tap lesson reminders', 'Message tutors from anywhere', 'Join your classroom in the browser'].map((x) => (<li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-teal-600"/>{uiText(x)}</li>)))}
            </ul>
          </div>
          <div className="rounded-3xl border border-border bg-muted/40 p-8">
            <Mail className="h-6 w-6 text-teal-600"/>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{uiText("Get learning tips & offers")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{uiText("Join our newsletter. No spam, unsubscribe anytime.")}</p>
            <div className="mt-4 flex gap-2">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={uiText("you@example.com")} aria-label={uiText("Email address")} disabled={subscribed}/>
              <Button onClick={subscribe} disabled={subscribed} className="bg-teal-600 hover:bg-teal-700 shrink-0">
                {subscribed ? <Check className="h-4 w-4"/> : uiText("Subscribe")}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>);
}
function userOrAuth(): 'student' | 'auth' {
    return useApp.getState().user ? 'student' : 'auth';
}
