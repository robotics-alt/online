'use client';
import { uiText } from "@/lib/ui-text";
import BudgetTutorSuggestions from './BudgetTutorSuggestions';
import { StudentHomework } from './HomeworkWorkspace';
import NotificationsPanel from './NotificationsPanel';
import StudentLanguages from './StudentLanguages';
import { ALL_COUNTRY_NAMES, timezoneForCountry, zonesForCountry } from '@/lib/country-timezones';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion, useMotionValue, useMotionValueEvent, animate, type Variants } from 'framer-motion';
import { useApp, api, COUNTRY_OPTIONS, LANGUAGES } from '@/lib/store';
import { TutorAvatar } from './TutorCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, BookOpen, Heart, Target, Wallet, CreditCard, Settings as SettingsIcon, Video, Clock, Loader2, MessageSquare, Star, Bell, Package, GraduationCap, ChevronRight, TrendingUp, Users, } from 'lucide-react';
import { formatInTz, dateKeyInTz } from '@/lib/tz';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { useLessonClock } from '@/hooks/use-lesson-clock';
import { canJoinLesson } from '@/lib/lesson-access';
import StudentMobileHome, { StudentMobileToolbar } from './StudentMobileHome';
import StudentLessons from './StudentLessons';
import './learning-workspace.css';
import { FloatingOrbs, LiveDot, ProgressRing, Sparkline, Stagger, StaggerItem, TabPill } from './MotionKit';
interface Booking {
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isTrial: boolean;
    priceCents: number;
    paymentMethod: string;
    student: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
    tutor: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
    subject: {
        name: string;
    } | null;
    review: {
        id: string;
        rating: number;
    } | null;
}
interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
}
interface Goal {
    id: string;
    title: string;
    status: string;
    targetDate: string | null;
    tutorName: string | null;
}
interface Assignment {
    id: string;
    title: string;
    description: string;
    dueDate: string | null;
    status: string;
    tutor: {
        name: string;
    };
    submissions: {
        id: string;
        content: string;
        feedback: string | null;
        status: string;
    }[];
}
const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
    COMPLETED: 'bg-muted text-muted-foreground',
    CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    RESCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    PENDING_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};
// ---------- Animation presets (transform/opacity only) ----------
const fadeUpItem: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};
const staggerContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const HOVER_LIFT = 'transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0';
type StatTone = 'teal' | 'violet' | 'amber' | 'emerald';
const TONE_CHIP: Record<StatTone, string> = {
    teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};
export default function StudentDashboard({ initialTab }: {
    initialTab?: string;
}) {
    const localTimezone = useDeviceTimezone();
    const now = useLessonClock();
    const { user, go, fmt, refreshMe, unreadNotifications } = useApp();
    const { toast } = useToast();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [myTutors, setMyTutors] = useState<{
        student: {
            id: string;
            name: string;
            avatarUrl: string | null;
            country: string | null;
        };
        completed: number;
        nextLesson: string | null;
    }[]>([]);
    const [wallet, setWallet] = useState<{
        balanceCents: number;
        credits: {
            id: string;
            remaining: number;
            total: number;
            note: string;
            expired: boolean;
        }[];
        providerStatus: {
            name: string;
            configured: boolean;
            setup: string | null;
        }[];
        entries: {
            id: string;
            type: string;
            amountCents: number;
            balanceAfterCents: number;
            description: string;
            createdAt: string;
        }[];
    } | null>(null);
    const [packages, setPackages] = useState<{
        id: string;
        name: string;
        lessons: number;
        priceCents: number;
        description: string;
    }[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewFor, setReviewFor] = useState<Booking | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [submitFor, setSubmitFor] = useState<Assignment | null>(null);
    const [submitText, setSubmitText] = useState('');
    const [newGoal, setNewGoal] = useState('');
    const [buyingPkg, setBuyingPkg] = useState<string | null>(null);
    // Presentation-only: time-of-day greeting (updated after mount to stay SSR/hydration safe).
    const [greeting, setGreeting] = useState('Welcome back');
    useEffect(() => {
        const h = new Date().getHours();
        setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
    }, []);
    // Controlled tab state — drives the sliding TabPill indicator.
    const tab = initialTab === 'payments' ? 'overview' : initialTab ?? 'overview';
    // Presentation-only: 30s ticker so the "next lesson" countdown stays fresh.
    const [, setTick] = useState(0);
    useEffect(() => {
        const iv = setInterval(() => setTick((t) => t + 1), 30000);
        return () => clearInterval(iv);
    }, []);
    const loadAll = useCallback(async () => {
        try {
            const [b, n, g, a, w, p] = await Promise.all([
                api<{
                    bookings: Booking[];
                }>('/api/bookings'),
                api<{
                    notifications: Notification[];
                }>('/api/notifications'),
                api<{
                    goals: Goal[];
                }>('/api/goals'),
                api<{
                    assignments: Assignment[];
                }>('/api/assignments'),
                api<typeof wallet>('/api/wallet'),
                api<{
                    packages: typeof packages;
                }>('/api/packages'),
            ]);
            setBookings(b.bookings);
            setNotifications(n.notifications);
            setGoals(g.goals);
            setAssignments(a.assignments);
            setWallet(w);
            setPackages(p.packages);
            // derive tutors from bookings
            const map = new Map<string, {
                student: {
                    id: string;
                    name: string;
                    avatarUrl: string | null;
                    country: string | null;
                };
                completed: number;
                nextLesson: string | null;
            }>();
            for (const bk of b.bookings) {
                const e = map.get(bk.tutor.id) ?? { student: { id: bk.tutor.id, name: bk.tutor.name, avatarUrl: bk.tutor.avatarUrl, country: null }, completed: 0, nextLesson: null };
                if (bk.status === 'COMPLETED')
                    e.completed++;
                if (['CONFIRMED', 'RESCHEDULED'].includes(bk.status) && new Date(bk.endUtc) > new Date() && (!e.nextLesson || bk.startUtc < e.nextLesson))
                    e.nextLesson = bk.startUtc;
                map.set(bk.tutor.id, e);
            }
            setMyTutors([...map.values()].sort((x, y) => y.completed - x.completed));
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (user?.role !== 'STUDENT')
            return;
        void loadAll();
        void api('/api/notifications/read', { method: 'POST', json: {} }).then(() => useApp.getState().refreshMe());
    }, [user?.role, loadAll]);
    useEffect(() => { const refresh = () => { void loadAll(); }; window.addEventListener('lesson-review-saved', refresh); return () => window.removeEventListener('lesson-review-saved', refresh); }, [loadAll]);
    if (!user) {
        return (<div className="mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <GraduationCap className="h-8 w-8" aria-hidden/>
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{uiText("Log in to see your dashboard")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText("Track lessons, homework and progress in one place.")}</p>
        <Button className="mt-5 h-11 bg-teal-600 px-6 hover:bg-teal-700" onClick={() => go('auth', { mode: 'login' })}>{uiText("Log in")}</Button>
      </div>);
    }
    if (user.role !== 'STUDENT') {
        return (<div className="mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <GraduationCap className="h-8 w-8" aria-hidden/>
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{uiText("This is the student dashboard.")}</h1>
        <Button className="mt-5 h-11 bg-teal-600 px-6 hover:bg-teal-700" onClick={() => go(user.role === 'TUTOR' ? 'tutor-dash' : 'admin')}>{uiText("Go to your dashboard")}</Button>
      </div>);
    }
    const upcoming = bookings.filter((b) => ['CONFIRMED', 'RESCHEDULED'].includes(b.status) && new Date(b.endUtc) > new Date());
    const past = bookings.filter((b) => b.status === 'COMPLETED' || new Date(b.startUtc) < new Date());
    const next = upcoming[0];
    const minutesToNext = next ? Math.round((new Date(next.startUtc).getTime() - Date.now()) / 60000) : null;
    const completedCount = bookings.filter((b) => b.status === 'COMPLETED').length;
    const hours = Math.round(completedCount * 60) / 60;
    const canJoin = (b: Booking) => canJoinLesson(b, now);
    // Presentation-only helpers derived from the values above.
    const countdownShort = minutesToNext != null && minutesToNext > 0 ? (minutesToNext >= 60 ? `${Math.floor(minutesToNext / 60)}h ${minutesToNext % 60}m` : `${minutesToNext}m`) : null;
    const nextLive = minutesToNext != null && minutesToNext <= 0;
    const nextChip = next ? (nextLive ? 'In progress' : countdownShort ? `Starts in ${countdownShort}` : null) : null;
    const heroNextLabel = next ? (nextLive ? 'Lesson in progress' : countdownShort ? `Next lesson in ${countdownShort}` : 'Next lesson scheduled') : 'No upcoming lesson';
    const activeCredits = (wallet?.credits ?? []).filter((c) => !c.expired).length;
    // Presentation-only: lessons per day over the last 14 days (viewer timezone),
    // derived from real booking data for the activity sparkline.
    const activity14: number[] = [];
    for (let i = 13; i >= 0; i--) {
        const key = dateKeyInTz(new Date(Date.now() - i * 86400000), localTimezone);
        activity14.push(bookings.filter((b) => dateKeyInTz(new Date(b.startUtc), localTimezone) === key).length);
    }
    const peakDay = Math.max(...activity14, 0);
    const cancelBooking = async (b: Booking) => {
        if (!window.confirm('Cancel this lesson? Free cancellation ends 12h before the start time.'))
            return;
        try {
            await api(`/api/bookings/${b.id}/cancel`, { method: 'POST', json: { reason: 'Cancelled by student' } });
            toast({ title: 'Lesson cancelled' });
            void loadAll();
            void refreshMe();
        }
        catch (err) {
            toast({ title: 'Could not cancel', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const submitReview = async () => {
        if (!reviewFor)
            return;
        try {
            await api('/api/reviews', { method: 'POST', json: { bookingId: reviewFor.id, rating: reviewRating, comment: reviewText } });
            toast({ title: 'Thanks for your review!' });
            setReviewFor(null);
            setReviewText('');
            void loadAll();
        }
        catch (err) {
            toast({ title: 'Could not submit review', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const submitHomework = async () => {
        if (!submitFor)
            return;
        try {
            await api('/api/assignments', { method: 'POST', json: { assignmentId: submitFor.id, content: submitText } });
            toast({ title: 'Homework submitted!' });
            setSubmitFor(null);
            void loadAll();
        }
        catch (err) {
            toast({ title: 'Could not submit', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const addGoal = async () => {
        if (!newGoal.trim())
            return;
        try {
            await api('/api/goals', { method: 'POST', json: { title: newGoal } });
            setNewGoal('');
            void loadAll();
        }
        catch (err) {
            toast({ title: 'Could not add goal', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const buyPackage = async (pkgId: string) => {
        setBuyingPkg(pkgId);
        try {
            await api('/api/packages/purchase', { method: 'POST', json: { packageId: pkgId } });
            toast({ title: 'Package purchased!', description: 'Lesson credits added to your account.' });
            void loadAll();
            void refreshMe();
        }
        catch (err) {
            toast({ title: 'Purchase failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setBuyingPkg(null);
        }
    };
    const messageTutor = async (tutorUserId: string) => {
        try {
            const r = await api<{
                conversationId: string;
            }>('/api/conversations', { method: 'POST', json: { userId: tutorUserId } });
            go('messages', { conversationId: r.conversationId });
        }
        catch {
            toast({ title: 'Could not open chat', variant: 'destructive' });
        }
    };
    return (<MotionConfig reducedMotion="user">
      <div className="student-dashboard mx-auto max-w-7xl px-4 py-8">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? uiText((<motion.div key="dashboard-skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
              <DashboardSkeleton />
            </motion.div>)) : (<motion.div key="dashboard-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              {/* ============ HERO ============ */}
              <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="student-dashboard-hero relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-teal-600 to-emerald-600 p-6 text-white shadow-lg shadow-teal-600/20 ring-1 ring-white/10 sm:p-8 dark:from-teal-700 dark:via-teal-700 dark:to-emerald-700 dark:shadow-teal-900/30">
                <FloatingOrbs variant="hero"/>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px ts-shimmer-line bg-gradient-to-r from-transparent via-white/60 to-transparent"/>
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <motion.h1 className="text-2xl font-bold tracking-tight sm:text-3xl" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}>
                      {[`${greeting},`, user.name.split(' ')[0], '👋'].map((word, i) => (<motion.span key={i} className="inline-block whitespace-pre" variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
                }}>
                          {uiText(word)}{i < 2 ? ' ' : ''}
                        </motion.span>))}
                    </motion.h1>
                    <p className="mt-1 text-sm text-teal-50/90">{uiText("Your learning journey at a glance.")}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                        <Wallet className="h-3.5 w-3.5" aria-hidden/>
                        <span className="sr-only">{uiText("Wallet balance: ")}</span>
                        {uiText(fmt(user.walletCents))}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                        {nextLive ? <LiveDot className="[&>span]:bg-white [&>span:first-child]:bg-white/90"/> : <Clock className="h-3.5 w-3.5" aria-hidden/>}
                        {uiText(heroNextLabel)}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => go('search')} className="ms-auto h-11 shrink-0 bg-white px-4 text-teal-700 transition-transform duration-200 hover:scale-[1.03] hover:bg-teal-50 active:scale-[0.98] focus-visible:ring-white motion-reduce:transition-none motion-reduce:hover:scale-100">{uiText("Find a tutor ")}<ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden/>
                  </Button>
                </div>
              </motion.section>

              <StudentMobileToolbar tab={tab}/>
              <Tabs value={tab} onValueChange={(value) => go('student', { tab: value })} className="mt-6">
                <TabsList aria-label={uiText("Dashboard sections")} className="student-dashboard-tabs flex-wrap h-auto gap-1 rounded-2xl bg-muted p-1">
                  <TabsTrigger value="overview" className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-300">
                    <TabPill show={tab === 'overview'} layoutId="student-tab-pill" className="rounded-lg bg-background shadow-sm ring-1 ring-border/70 dark:bg-input/40"/>
                    <span className="relative z-10">{uiText("Overview")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="lessons" className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-300">
                    <TabPill show={tab === 'lessons'} layoutId="student-tab-pill" className="rounded-lg bg-background shadow-sm ring-1 ring-border/70 dark:bg-input/40"/>
                    <span className="relative z-10">{uiText("My Lessons")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="tutors" className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-300">
                    <TabPill show={tab === 'tutors'} layoutId="student-tab-pill" className="rounded-lg bg-background shadow-sm ring-1 ring-border/70 dark:bg-input/40"/>
                    <span className="relative z-10">{uiText("My Tutors")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="homework" className="rounded-lg">{uiText("Homework")}</TabsTrigger>
                  <TabsTrigger value="progress" className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-300">
                    <TabPill show={tab === 'progress'} layoutId="student-tab-pill" className="rounded-lg bg-background shadow-sm ring-1 ring-border/70 dark:bg-input/40"/>
                    <span className="relative z-10">{uiText("Progress")}</span>
                  </TabsTrigger>

                  <TabsTrigger value="notifications" className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-300">
                    <TabPill show={tab === 'notifications'} layoutId="student-tab-pill" className="rounded-lg bg-background shadow-sm ring-1 ring-border/70 dark:bg-input/40"/>
                    <span className="relative z-10">{uiText("Notifications")}</span> {unreadNotifications > 0 && <Badge className="relative z-10 ms-1 bg-amber-500 text-white border-0">{uiText(unreadNotifications)}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="settings" aria-label={uiText("Settings")} className="relative min-h-11 min-w-11 px-2 data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-300">
                    <TabPill show={tab === 'settings'} layoutId="student-tab-pill" className="rounded-lg bg-background shadow-sm ring-1 ring-border/70 dark:bg-input/40"/>
                    <SettingsIcon className="relative z-10 h-4 w-4" aria-hidden/>
                  </TabsTrigger>
                </TabsList>

                {/* ============ OVERVIEW ============ */}
                <TabsContent value="overview" className="mt-6">
                  <StudentMobileHome upcoming={upcoming} completedCount={completedCount} now={now}/>
                  <div className="student-desktop-overview"><TabPanel className="space-y-6">
                    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <motion.div variants={fadeUpItem} className="h-full">
                        <Card className={cn('relative h-full overflow-hidden rounded-2xl border-teal-200/70 bg-gradient-to-br from-teal-50 via-card to-emerald-50 dark:border-teal-900/60 dark:from-teal-950/40 dark:via-card dark:to-emerald-950/20', HOVER_LIFT)}>
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">{uiText("Next lesson")}</p>
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><CalendarDays className="h-4 w-4" aria-hidden/></span>
                            </div>
                            {next ? (<>
                                <p className="mt-2 font-semibold text-foreground">{next.tutor.name}</p>
                                <p className="text-sm text-muted-foreground">{uiText(formatInTz(new Date(next.startUtc), localTimezone))}</p>
                                {nextChip && uiText((<span className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                                    <Clock className="h-3 w-3" aria-hidden/> {uiText(nextChip)}
                                  </span>))}
                                {canJoin(next) && uiText((<Button size="sm" className="mt-3 h-9 w-full bg-teal-600 hover:bg-teal-700" onClick={() => go('classroom', { bookingId: next.id })}>
                                    <Video className="me-1 h-4 w-4" aria-hidden/>{uiText(" Join classroom")}</Button>))}
                              </>) : uiText((<div className="mt-2">
                                <p className="text-sm text-muted-foreground">{uiText("No upcoming lesson yet.")}</p>
                                <button className="mt-1 rounded text-sm font-medium text-teal-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-teal-300" onClick={() => go('search')}>{uiText("Book one now")}</button>
                              </div>))}
                          </CardContent>
                        </Card>
                      </motion.div>
                      <motion.div variants={fadeUpItem} className="h-full">
                        <StatCard icon={BookOpen} label={uiText("Lessons completed")} value={String(completedCount)} countTo={completedCount} tone="violet" footer={<div>
                              <AnimatedProgress value={Math.min(100, completedCount * 10)} className="h-1.5" aria-label={uiText("Progress to next 10-lesson milestone")}/>
                              <p className="mt-1.5 text-[11px] text-muted-foreground">{uiText(10 - (completedCount % 10))}{uiText(" more to next milestone")}</p>
                            </div>}/>
                      </motion.div>
                      <motion.div variants={fadeUpItem} className="h-full">
                        <StatCard icon={Clock} label={uiText("Learning hours")} value={`${hours}h`} countTo={hours} format={(n) => `${n}h`} tone="amber" footer={<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              <TrendingUp className="h-3 w-3" aria-hidden/> {uiText(upcoming.length)}{uiText(" upcoming")}</span>}/>
                      </motion.div>
                      <motion.div variants={fadeUpItem} className="h-full">
                        <StatCard icon={Wallet} label={uiText("Lesson credits")} value={String(activeCredits)} countTo={activeCredits} tone="emerald" footer={activeCredits > 0 ? (<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              <Package className="h-3 w-3" aria-hidden/> {uiText(activeCredits)}{uiText(" credit ")}{activeCredits === 1 ? uiText("pack") : uiText("packs")}{uiText(" active")}</span>) : undefined}/>
                      </motion.div>
                    </motion.div>

                    {/* Learning activity sparkline (derived from real bookings) */}
                    <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between gap-2 text-base">
                          <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-300" aria-hidden/>{uiText(" Learning activity")}</span>
                          <span className="text-xs font-normal text-muted-foreground">{uiText("Last 14 days \u00B7 lessons per day")}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Sparkline points={activity14} height={56} ariaLabel={`Lessons per day over the last 14 days, peak ${peakDay}`} gradientId="student-activity"/>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{uiText(upcoming.length)}{uiText(" upcoming \u00B7 ")}{uiText(completedCount)}{uiText(" completed all-time")}</span>
                          {peakDay > 0 ? <span>{uiText("Peak day: ")}{uiText(peakDay)}{uiText(" lesson")}{peakDay === 1 ? '' : uiText("s")}</span> : <span>{uiText("No lessons in this window yet")}</span>}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Upcoming lessons")}</CardTitle></CardHeader>
                        <CardContent>
                          {upcoming.length === 0 ? uiText((<EmptyState compact icon={CalendarDays} title={uiText("Nothing scheduled yet")} hint={uiText("Book a lesson with a tutor and it will show up here.")} actionLabel={uiText("Find a tutor")} onAction={() => go('search')}/>)) : (<motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
                              {upcoming.slice(0, 4).map((b) => (<motion.div key={b.id} variants={fadeUpItem}>
                                  <BookingRow b={b} myTz={localTimezone} otherLabel={b.tutor.name} onJoin={canJoin(b) ? () => go('classroom', { bookingId: b.id }) : undefined} onCancel={() => cancelBooking(b)} fmt={fmt}/>
                                </motion.div>))}
                            </motion.div>)}
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Homework")}</CardTitle></CardHeader>
                        <CardContent>
                          {assignments.length === 0 ? uiText((<EmptyState compact icon={BookOpen} title={uiText("No assignments yet")} hint={uiText("Homework from your tutors will appear here.")}/>)) : (<motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
                              {assignments.slice(0, 4).map((a) => (<motion.div key={a.id} variants={fadeUpItem} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 transition-[border-color,box-shadow] hover:border-teal-200 hover:shadow-sm dark:hover:border-teal-900/60">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{uiText(a.title)}</p>
                                    <p className="text-xs text-muted-foreground/70">{uiText("from ")}{a.tutor.name}{a.dueDate ? uiText(" \u00B7 due {{value1}}", { value1: new Date(a.dueDate).toLocaleDateString() }) : ''}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={a.status === 'GRADED' ? 'border-0 bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' : 'border-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}>{uiText(a.status)}</Badge>
                                    <Button size="sm" variant="outline" onClick={() => go('student', { tab: 'homework', assignmentId: a.id })}>{uiText("Open")}</Button>
                                  </div>
                                </motion.div>))}
                            </motion.div>)}
                        </CardContent>
                      </Card>
                    </div>
                  </TabPanel>
                </div>
                <BudgetTutorSuggestions /></TabsContent>

                {/* ============ LESSONS ============ */}
                <TabsContent value="lessons" className="mt-6"><StudentLessons bookings={bookings} timezone={localTimezone} now={now} onUpdated={() => { void loadAll(); void refreshMe(); }} onReview={(lesson) => {
                const booking = bookings.find((item) => item.id === lesson.id);
                if (booking) {
                    setReviewFor(booking);
                    setReviewRating(5);
                    setReviewText('');
                }
            }}/></TabsContent>

                {/* ============ TUTORS ============ */}
                <TabsContent value="tutors" className="mt-6">
                  <TabPanel>
                    {myTutors.length === 0 ? uiText((<EmptyState icon={Users} title={uiText("You haven't booked any tutors yet")} hint={uiText("Browse the marketplace and book your first lesson.")} actionLabel={uiText("Find your first tutor")} onAction={() => go('search')}/>)) : (<motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {myTutors.map((t) => (<motion.div key={t.student.id} variants={fadeUpItem} className="h-full">
                            <Card className={cn('h-full rounded-2xl border-border', HOVER_LIFT)}>
                              <CardContent className="p-5">
                                <div className="flex items-center gap-3">
                                  <TutorAvatar name={t.student.name} url={t.student.avatarUrl} className="h-12 w-12"/>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-foreground">{t.student.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.student.country ?? ''} · {uiText(t.completed)}{uiText(" lesson")}{t.completed === 1 ? '' : uiText("s")}{uiText(" together")}</p>
                                  </div>
                                </div>
                                {t.nextLesson && uiText((<span className="mt-3 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                                    <Clock className="h-3 w-3" aria-hidden/>{uiText(" Next: ")}{uiText(formatInTz(new Date(t.nextLesson), localTimezone))}
                                  </span>))}
                                <div className="mt-4 flex gap-2">
                                  <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => messageTutor(t.student.id)}><MessageSquare className="me-1 h-3.5 w-3.5" aria-hidden/>{uiText(" Message")}</Button>
                                  <Button size="sm" variant="ghost" className="h-9 flex-1" onClick={() => go('search')}>{uiText("Book again")}</Button>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>))}
                      </motion.div>)}
                    <Card className="mt-6 rounded-2xl border-dashed border-border bg-muted/40 shadow-sm"><CardContent className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Heart className="h-4 w-4 text-rose-400" aria-hidden/>{uiText(" Favorite tutors are saved on this device.")}</div>
                    </CardContent></Card>
                  </TabPanel>
                </TabsContent>

                {/* ============ PROGRESS ============ */}
                <TabsContent value="progress" className="mt-6">
                  <TabPanel>
                    <Stagger className="mb-6 grid gap-4 sm:grid-cols-3">
                      <StaggerItem className="h-full">
                        <Card className="h-full rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-4 p-5">
                            <ProgressRing value={goals.length ? (goals.filter((g) => g.status === 'ACHIEVED').length / goals.length) * 100 : 0} size={84} ariaLabel="Goals achieved progress">
                              <span className="text-lg font-bold tabular-nums text-foreground">
                                {goals.length ? uiText(Math.round((goals.filter((g) => g.status === 'ACHIEVED').length / goals.length) * 100)) : uiText(0)}%
                              </span>
                            </ProgressRing>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{uiText("Goals achieved")}</p>
                              <p className="text-xs text-muted-foreground">{uiText(goals.filter((g) => g.status === 'ACHIEVED').length)}{uiText(" of ")}{uiText(goals.length)}{uiText(" learning goals")}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </StaggerItem>
                      <StaggerItem className="h-full">
                        <Card className="h-full rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-4 p-5">
                            <ProgressRing value={assignments.length ? (assignments.filter((a) => a.submissions.length > 0).length / assignments.length) * 100 : 0} size={84} tone="var(--chart-2)" ariaLabel="Homework submitted progress">
                              <span className="text-lg font-bold tabular-nums text-foreground">
                                {assignments.length ? uiText(Math.round((assignments.filter((a) => a.submissions.length > 0).length / assignments.length) * 100)) : uiText(0)}%
                              </span>
                            </ProgressRing>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{uiText("Homework submitted")}</p>
                              <p className="text-xs text-muted-foreground">{uiText(assignments.filter((a) => a.submissions.length > 0).length)}{uiText(" of ")}{uiText(assignments.length)}{uiText(" assignments")}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </StaggerItem>
                      <StaggerItem className="h-full">
                        <Card className="h-full rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-4 p-5">
                            <ProgressRing value={Math.min(100, completedCount * 10)} size={84} tone="var(--chart-4)" ariaLabel="Progress to next 10-lesson milestone">
                              <span className="text-lg font-bold tabular-nums text-foreground">{uiText(completedCount)}</span>
                            </ProgressRing>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{uiText("Next milestone")}</p>
                              <p className="text-xs text-muted-foreground">{uiText(10 - (completedCount % 10))}{uiText(" more lessons to reach ")}{uiText(Math.ceil((completedCount + 1) / 10) * 10)}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </StaggerItem>
                    </Stagger>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-teal-600 dark:text-teal-300" aria-hidden/>{uiText(" Learning goals")}</CardTitle></CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder={uiText("Add a goal, e.g. Reach B1 Spanish\u2026")} onKeyDown={(e) => e.key === 'Enter' && addGoal()}/>
                            <Button onClick={addGoal} className="h-9 shrink-0 bg-teal-600 hover:bg-teal-700">{uiText("Add")}</Button>
                          </div>
                          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="mt-4 space-y-2">
                            {goals.length === 0 ? uiText((<EmptyState compact icon={Target} title={uiText("No goals yet")} hint={uiText("Add your first learning goal above.")}/>)) : uiText(goals.map((g) => (<motion.div key={g.id} variants={fadeUpItem} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-teal-200 dark:hover:border-teal-900/60">
                                <div>
                                  <p className={`text-sm font-medium ${g.status === 'ACHIEVED' ? 'text-muted-foreground/70 line-through' : 'text-foreground'}`}>{uiText(g.title)}</p>
                                  {g.tutorName && <p className="text-xs text-muted-foreground/70">{uiText("with ")}{uiText(g.tutorName)}</p>}
                                </div>
                                {g.status === 'ACHIEVED'
                    ? <Badge className="border-0 bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">{uiText("Achieved")}</Badge>
                    : <Badge variant="secondary">{uiText("In progress")}</Badge>}
                              </motion.div>)))}
                          </motion.div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Your stats")}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{uiText("Lessons completed")}</span><strong>{uiText(completedCount)}</strong></div>
                            <AnimatedProgress value={Math.min(100, completedCount * 10)} className="mt-1" aria-label={uiText("Lessons completed progress")}/>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{uiText("Goals achieved")}</span><strong>{uiText(goals.filter((g) => g.status === 'ACHIEVED').length)}/{uiText(goals.length)}</strong></div>
                            <AnimatedProgress value={goals.length ? (goals.filter((g) => g.status === 'ACHIEVED').length / goals.length) * 100 : 0} className="mt-1" aria-label={uiText("Goals achieved progress")}/>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{uiText("Homework submitted")}</span><strong>{uiText(assignments.filter((a) => a.submissions.length > 0).length)}/{uiText(assignments.length)}</strong></div>
                            <AnimatedProgress value={assignments.length ? (assignments.filter((a) => a.submissions.length > 0).length / assignments.length) * 100 : 0} className="mt-1" aria-label={uiText("Homework submitted progress")}/>
                          </div>
                          <p className="text-xs text-muted-foreground/70">{uiText("Total learning time: ")}{uiText(hours)}{uiText("h across ")}{uiText(completedCount)}{uiText(" lessons with ")}{uiText(myTutors.length)}{uiText(" tutors.")}</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabPanel>
                </TabsContent>

                <TabsContent value="homework" className="mt-6"><StudentHomework /></TabsContent>
                <TabsContent value="notifications" className="mt-6"><NotificationsPanel /></TabsContent>

                {/* ============ SETTINGS ============ */}
                <TabsContent value="settings" className="mt-6">
                  <TabPanel>
                    <StudentSettings />
                  </TabPanel>
                </TabsContent>
              </Tabs>

              {/* Review dialog */}
              <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{uiText("Rate your lesson")}</DialogTitle>
                    <DialogDescription>{uiText("Your verified review helps other students.")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-center gap-1">
                      {uiText([1, 2, 3, 4, 5].map((i) => (<button key={i} onClick={() => setReviewRating(i)} aria-label={uiText("{{value1}} stars", { value1: i })} className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:scale-100">
                          <Star className={cn('h-8 w-8 transition-colors', i <= reviewRating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200 dark:fill-stone-700 dark:text-stone-700')} aria-hidden/>
                        </button>)))}
                    </div>
                    <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder={uiText("What went well? What could be better?")} rows={3}/>
                    <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={submitReview}>{uiText("Submit review")}</Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Homework dialog */}
              <Dialog open={!!submitFor} onOpenChange={(o) => !o && setSubmitFor(null)}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{uiText(submitFor?.title)}</DialogTitle>
                    <DialogDescription>{uiText(submitFor?.description)}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Label>{uiText("Your submission")}</Label>
                    <Textarea value={submitText} onChange={(e) => setSubmitText(e.target.value)} rows={5} placeholder={uiText("Paste your answer, link or notes\u2026")}/>
                    {submitFor?.submissions[0]?.feedback && uiText((<div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200">
                        <strong>{uiText("Tutor feedback:")}</strong> {uiText(submitFor.submissions[0].feedback)}
                      </div>))}
                    <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={submitHomework} disabled={!submitText.trim()}>{uiText("Submit homework")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>)}
        </AnimatePresence>
      </div>
    </MotionConfig>);
}
/** Fades/slides a tab panel in when it mounts (0.2s, transform/opacity only). */
function TabPanel({ children, className }: {
    children: React.ReactNode;
    className?: string;
}) {
    return (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>);
}
/** Skeleton layout mirroring the real dashboard (hero + stat row + two section cards). */
function DashboardSkeleton() {
    return (<div className="space-y-6" role="status" aria-label={uiText("Loading your dashboard")}>
      <Skeleton className="h-40 rounded-3xl"/>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {uiText([0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl"/>))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl"/>
        <Skeleton className="h-72 rounded-2xl"/>
      </div>
      <span className="sr-only">{uiText("Loading your dashboard\u2026")}</span>
    </div>);
}
/** Progress bar that animates its width on mount and on value change (respects reduced motion). */
function AnimatedProgress({ value, className, 'aria-label': ariaLabel }: {
    value: number;
    className?: string;
    'aria-label'?: string;
}) {
    const reduced = useReducedMotion();
    const mv = useMotionValue(0);
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        const controls = animate(mv, value, { duration: reduced ? 0 : 0.7, ease: 'easeOut' });
        return () => controls.stop();
    }, [value, reduced, mv]);
    useMotionValueEvent(mv, 'change', (v) => setCurrent(v));
    return (<Progress value={reduced ? value : current} aria-label={uiText(ariaLabel)} className={cn('[&_[data-slot=progress-indicator]]:duration-700 [&_[data-slot=progress-indicator]]:ease-out', className)}/>);
}
function StatCard({ icon: Icon, label, value, countTo, format, tone = 'teal', footer }: {
    icon: React.ComponentType<{
        className?: string;
    }>;
    label: string;
    value: string;
    /** Numeric target for the mount count-up animation; when absent the static `value` is shown. */
    countTo?: number;
    format?: (n: number) => string;
    tone?: StatTone;
    footer?: React.ReactNode;
}) {
    const reduced = useReducedMotion();
    const fmtFn = format ?? String;
    const progress = useMotionValue(0);
    const [animated, setAnimated] = useState<number | null>(countTo != null ? 0 : null);
    useEffect(() => {
        if (countTo == null)
            return;
        const controls = animate(progress, countTo, {
            duration: reduced ? 0 : 0.9,
            ease: 'easeOut',
            onComplete: () => setAnimated(null),
        });
        return () => controls.stop();
    }, [countTo, reduced, progress]);
    useMotionValueEvent(progress, 'change', (v) => setAnimated(Math.round(v)));
    const shown = animated != null ? fmtFn(animated) : value;
    return (<Card className={cn('h-full rounded-2xl border-border', HOVER_LIFT)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{uiText(label)}</p>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONE_CHIP[tone])}>
            <Icon className="h-4 w-4" aria-hidden/>
          </span>
        </div>
        <p className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">{uiText(shown)}</p>
        {footer && <div className="mt-3">{uiText(footer)}</div>}
      </CardContent>
    </Card>);
}
function EmptyState({ icon: Icon, title, hint, actionLabel, onAction, compact = false }: {
    icon: React.ComponentType<{
        className?: string;
    }>;
    title: string;
    hint?: string;
    actionLabel?: string;
    onAction?: () => void;
    compact?: boolean;
}) {
    return (<div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 text-center', compact ? 'py-6' : 'py-10')}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
        <Icon className="h-6 w-6" aria-hidden/>
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{uiText(title)}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{uiText(hint)}</p>}
      {actionLabel && onAction && uiText((<Button size="sm" className="mt-4 h-11 bg-teal-600 px-4 hover:bg-teal-700" onClick={onAction}>{uiText(actionLabel)}</Button>))}
    </div>);
}
function BookingRow({ b, myTz, otherLabel, onJoin, onCancel, showActions, fmt }: {
    b: Booking;
    myTz: string;
    otherLabel: string;
    onJoin?: () => void;
    onCancel?: () => void;
    showActions?: boolean;
    fmt: (c: number) => string;
}) {
    return (<div className="student-booking-row flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 transition-[border-color,box-shadow] hover:border-teal-200 hover:shadow-sm dark:hover:border-teal-900/60">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {b.isTrial && <Badge className="me-1.5 border-0 bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-950 dark:text-amber-300">{uiText("TRIAL")}</Badge>}
          {b.subject?.name ?? uiText("Lesson")} · {uiText(otherLabel)}
        </p>
        <p className="text-xs text-muted-foreground">{uiText(formatInTz(new Date(b.startUtc), myTz))} · {uiText(fmt(b.priceCents))}</p>
        {['CONFIRMED', 'RESCHEDULED'].includes(b.status) && <p className="mt-1.5 text-[10px] text-muted-foreground">{uiText("Video & screen sharing included")}{!onJoin && new Date(b.startUtc).getTime() > Date.now() ? uiText(" \u00B7 Classroom opens 15 minutes before") : ''}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary" className={`border-0 ${STATUS_COLORS[b.status] ?? ''}`}>{uiText(b.status)}</Badge>
        {['CONFIRMED', 'RESCHEDULED'].includes(b.status) && <Button size="sm" disabled={!onJoin} className="bg-teal-600 hover:bg-teal-700" onClick={onJoin}><Video className="me-1 h-3.5 w-3.5" aria-hidden/>{uiText(" Enter classroom")}</Button>}
        {showActions && onCancel && <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300" onClick={onCancel}>{uiText("Cancel")}</Button>}
      </div>
    </div>);
}
function StudentSettings() {
    const { user, refreshMe, logout, publicData } = useApp();
    const { toast } = useToast();
    const [name, setName] = useState(user?.name ?? '');
    const [country, setCountry] = useState(user?.country ?? '');
    const deviceTimezone = useDeviceTimezone();
    const [timezone, setTimezone] = useState(user?.timezone || deviceTimezone);
    const [language, setLanguage] = useState(user?.language ?? 'en');
    const [currency, setCurrency] = useState(user?.currency ?? 'USD');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    if (!user)
        return null;
    const save = async () => {
        setSaving(true);
        try {
            await api('/api/me', { method: 'PUT', json: { name, country: country || undefined, timezone, language, currency } });
            await refreshMe();
            toast({ title: 'Profile updated' });
        }
        catch (err) {
            toast({ title: 'Update failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setSaving(false);
        }
    };
    const changePassword = async () => {
        try {
            await api('/api/me', { method: 'PUT', json: { currentPassword, newPassword } });
            toast({ title: 'Password changed' });
            setCurrentPassword('');
            setNewPassword('');
        }
        catch (err) {
            toast({ title: 'Could not change password', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const deleteAccount = async () => {
        if (!window.confirm('Delete your account? Your profile will be deactivated and anonymized. This cannot be undone.'))
            return;
        try {
            await api('/api/me', { method: 'DELETE' });
            await logout();
            toast({ title: 'Account deleted' });
        }
        catch (err) {
            toast({ title: 'Could not delete account', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    return (<div className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Personal information")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>{uiText("Full name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)}/></div>
          <div className="space-y-1.5"><Label>{uiText("Email")}</Label><Input value={user.email} disabled/></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{uiText("Country")}</Label>
              <Select value={country || undefined} onValueChange={(value) => { setCountry(value); setTimezone(timezoneForCountry(value, deviceTimezone)); }}><SelectTrigger><SelectValue placeholder={uiText("Select")}/></SelectTrigger>
                <SelectContent>{uiText(ALL_COUNTRY_NAMES.map((c) => <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>{uiText("Time zone")}</Label>
              <select className="feature-select" value={timezone} aria-label={uiText("Country suggested timezone")} onChange={e => setTimezone(e.target.value)}>{uiText([...new Set([timezone, ...zonesForCountry(country)])].map(zone => <option key={zone} value={zone}>{uiText(zone)}</option>))}</select><p className="mt-1 text-xs text-muted-foreground">{uiText("Detected automatically from your device\u2019s location and time settings.")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{uiText("Language")}</Label>
              <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{uiText(LANGUAGES.filter(item => !publicData?.settings.enabledLanguages || publicData.settings.enabledLanguages.includes(item.code)).map((l) => <SelectItem key={l.code} value={l.code}>{uiText(l.label)}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>{uiText("Currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{uiText(['USD', 'EUR', 'GBP', 'GHS', 'IQD', 'TRY'].filter(item => !publicData?.settings.enabledCurrencies || publicData.settings.enabledCurrencies.includes(item)).map((c) => <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>))}</SelectContent></Select>
            </div>
          </div>
          <StudentLanguages />
          <Button onClick={save} disabled={saving} className="bg-teal-600 hover:bg-teal-700">{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden/>}{uiText(" Save changes")}</Button>
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card className="rounded-2xl border-border shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Password & security")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>{uiText("Current password")}</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}/></div>
            <div className="space-y-1.5"><Label>{uiText("New password")}</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/></div>
            <Button variant="outline" onClick={changePassword} disabled={!currentPassword || newPassword.length < 8}>{uiText("Change password")}</Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-200 shadow-sm transition-shadow hover:shadow-md dark:border-rose-900/50">
          <CardHeader className="pb-2"><CardTitle className="text-base text-rose-700 dark:text-rose-400">{uiText("Danger zone")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{uiText("Deleting your account anonymizes your data in line with our privacy policy.")}</p>
            <Button variant="destructive" className="mt-3" onClick={deleteAccount}>{uiText("Delete my account")}</Button>
          </CardContent>
        </Card>
      </div>
    </div>);
}
