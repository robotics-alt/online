'use client';
import { uiText } from "@/lib/ui-text";
import { useT } from '@/lib/i18n';
import DeleteAction from './admin/DeleteAction';
import { readDesignedPage, pageDocument } from '@/lib/cms-content';
import PlatformLogo from './PlatformLogo';
import IdentitySettings from './admin/IdentitySettings';
import { FinanceWorkspace, UserAccountDetails } from './admin/AccountWorkspace';
import DashboardNotificationBell from './DashboardNotificationBell';
import NotificationsPanel from './NotificationsPanel';
import GameDetailsEditor from './admin/GameDetailsEditor';
import { Bell } from 'lucide-react';
import { CatalogManager, HomepageManager, AnnouncementsManager, PromotionsManager, ReviewEditor } from './admin/BusinessPanels';
import ProfileChangesPanel from './admin/ProfileChangesPanel';
import ProfessionalSummary from './ProfessionalSummary';
import GroupEnrollmentApprovals from './admin/GroupEnrollmentApprovals';
import BrandColourSettings from './admin/BrandColourSettings';
import LanguageTypographySettings from './admin/LanguageTypographySettings';
import BookingApprovalDialog from './admin/BookingApprovalDialog';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { ArrowRight, ArrowUpRight, ChevronRight, Menu, PanelLeftClose, X, BadgeCheck, Banknote, BookOpen, CalendarCheck, CalendarDays, ChevronDown, CircleDollarSign, ClipboardCheck, DollarSign, Eye, EyeOff, FileText, Gamepad2, GraduationCap, Hourglass, Inbox, LayoutDashboard, Loader2, LogOut, Minus, MoreHorizontal, Percent, Plus, Receipt, RefreshCw, RotateCcw, ScrollText, Search, Settings as SettingsIcon, ShieldBan, ShieldCheck, Star, TrendingUp, Ticket, Trash2, TriangleAlert, UserCog, Users, Wallet, type LucideIcon, } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { api, useApp } from '@/lib/store';
import ThemeToggle from './ThemeToggle';
import MobileNavigation from './MobileNavigation';
import type { AdminSettingsResponse } from '@/lib/admin-settings-contract';
import './admin/admin-console.css';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import GameAdminSection from './admin/GameAdminSection';
import { Stagger, StaggerItem } from './MotionKit';
import { CHART_COLORS, CountUp, DataTableShell, DeltaChip, EmptyState, ModuleTransition, Panel, PanelHeader, SectionHeader, SkeletonTable, STAT_ICON_TONES, StatCard, StatGrid, TableScroll, chartTooltipBase, type StatTone, } from './admin/AdminWidgets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */
const fmtMoney = (cents: number) => useApp.getState().fmt(cents);
const fmtDateTime = (x: string | null | undefined) => x ? new Date(x).toLocaleString() : '—';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const titleCase = (s: string) => s.length ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ') : s;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const TONES: Record<string, string> = {
    teal: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    stone: 'border-border bg-muted text-muted-foreground',
};
type Tone = keyof typeof TONES;
function statusTone(s: string): Tone {
    const up = s.toUpperCase();
    if (['APPROVED', 'PAID', 'COMPLETED', 'ACTIVE', 'PUBLISHED', 'CONFIRMED', 'EARNING', 'TOPUP', 'OK', 'CONFIGURED', 'CONNECTED', 'CREDITED'].includes(up))
        return 'teal';
    if (['PENDING', 'REQUESTED', 'PROCESSING', 'DRAFT', 'PACKAGE', 'BONUS', 'ADJUSTMENT', 'NOT_CONFIGURED', 'PARTIAL', 'UNVERIFIED', 'REQUIRES_ACTION'].includes(up))
        return 'amber';
    if (['REJECTED', 'CANCELLED', 'SUSPENDED', 'REFUND', 'FAILED', 'HIDDEN', 'EXPIRED', 'DELETED'].includes(up))
        return 'red';
    return 'stone';
}
function StatusBadge({ status }: {
    status: string;
}) {
    return (<Badge variant="outline" className={`${TONES[statusTone(status)]} whitespace-nowrap`}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current"/>
      {uiText(titleCase(status))}
    </Badge>);
}
function Stars({ rating }: {
    rating: number;
}) {
    const clamped = Math.max(0, Math.min(5, Math.round(rating)));
    return (<span className="whitespace-nowrap text-amber-500 dark:text-amber-400" aria-label={uiText("Rated {{value1}} out of 5", { value1: clamped })}>
      {uiText('★'.repeat(clamped))}
      {uiText('☆'.repeat(Math.max(0, 5 - clamped)))}
    </span>);
}
function metaText(meta: unknown): string {
    if (meta == null)
        return '';
    try {
        const s = typeof meta === 'string' ? meta : JSON.stringify(meta);
        return typeof s === 'string' && s.length > 100 ? `${s.slice(0, 100)}…` : (s ?? '');
    }
    catch {
        return '';
    }
}
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/* ------------------------------------------------------------------ */
/* Data-loading pattern (manual SWR-like)                              */
/* ------------------------------------------------------------------ */
interface Resource<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}
function useResource<T>(fetcher: (() => Promise<T>) | null): Resource<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!fetcher)
            return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const d = await fetcher();
                if (!cancelled) {
                    setData(d);
                    setError(null);
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(errMsg(e));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [fetcher, tick]);
    const refresh = useCallback(() => setTick((t) => t + 1), []);
    return { data, loading, error, refresh };
}
function useDebounced<T>(value: T, delay = 300): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
}
/* ------------------------------------------------------------------ */
/* Small shared presentational pieces                                  */
/* (StatCard, SectionHeader, EmptyState and table shells live in       */
/*  ./admin/AdminWidgets — logic-free animated primitives.)            */
/* ------------------------------------------------------------------ */
function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return (<div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {uiText(label)}
      </div>
      <div className="mt-0.5 text-sm break-words">{children}</div>
    </div>);
}
function LoadError({ message, onRetry }: {
    message: string;
    onRetry: () => void;
}) {
    return (<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
        <TriangleAlert className="size-5" aria-hidden/>
      </span>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="max-sm:min-h-11">{uiText("Try again")}</Button>
    </div>);
}
function StatusFilterSelect({ value, onChange, options, className, }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    className?: string;
}) {
    return (<Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'w-44'}>
        <SelectValue placeholder={uiText("Filter")}/>
      </SelectTrigger>
      <SelectContent>
        {uiText(options.map((o) => (<SelectItem key={o} value={o}>
            {o === 'ALL' ? uiText("All") : uiText(titleCase(o))}
          </SelectItem>)))}
      </SelectContent>
    </Select>);
}
/* ------------------------------------------------------------------ */
/* API response types                                                  */
/* ------------------------------------------------------------------ */
interface OverviewStats {
    cards: {
        totalStudents: number;
        totalTutors: number;
        activeTutors: number;
        pendingApplications: number;
        totalBookings: number;
        completedLessons: number;
        cancelledLessons: number;
        newStudentsThisMonth: number;
        activeSubscriptions: number;
        grossVolumeCents: number;
        platformRevenueCents: number;
        tutorPayableCents: number;
        pendingWithdrawalsCents: number;
        refundsCents: number;
        walletLiabilityCents: number;
    };
    bookings30: {
        date: string;
        count: number;
        revenueCents: number;
    }[];
    revenue6: {
        month: string;
        revenueCents: number;
        grossCents: number;
    }[];
    subjectDist: {
        name: string;
        count: number;
    }[];
}
interface TutorApplication {
    languageItems?: string;
    experienceItems?: string;
    skillItems?: string;
    id: string;
    userId: string;
    headline: string;
    about: string;
    experience: string;
    education: string;
    certifications: string;
    methodology: string;
    videoUrl: string | null;
    languages: string;
    yearsExperience: number;
    hourlyRateCents: number;
    trialRateCents: number;
    status: string;
    rejectionReason: string | null;
    identityVerified: boolean;
    user: {
        id: string;
        name: string;
        email: string;
        country: string | null;
        createdAt: string;
    };
    subjects: {
        subject: {
            name: string;
        };
    }[];
    verifications: {
        id: string;
        type: string;
        label: string;
        fileUrl: string;
        status: string;
        note: string | null;
    }[];
    rules: {
        weekday: number;
        startMin: number;
        endMin: number;
    }[];
}
interface AdminUserRow {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    country: string | null;
    createdAt: string;
    walletCents: number;
    emailVerified: boolean;
    tutorProfile: {
        id: string;
        status: string;
        headline: string;
        commissionPercent: number;
        lessonsCompleted: number;
    } | null;
}
interface BookingRow {
    lessonFormat?: string;
    privateDetails?: {
        phone: string | null;
        email: string | null;
        location: string | null;
        paymentReference: string | null;
    } | null;
    id: string;
    student: {
        name: string;
        email: string;
    };
    tutor: {
        name: string;
        email: string;
    };
    subject: {
        name: string;
    } | null;
    startUtc: string;
    endUtc: string;
    durationMin: number;
    status: string;
    isTrial: boolean;
    priceCents: number;
    commissionCents: number;
    tutorNetCents: number;
    paymentMethod: string | null;
    createdAt: string;
}
interface FinanceEntry {
    id: string;
    user: {
        name: string;
        email: string;
        role: string;
    };
    type: string;
    amountCents: number;
    balanceAfterCents: number;
    refType: string | null;
    refId: string | null;
    description: string;
    createdAt: string;
}
interface PaymentRow {
    id: string;
    user: {
        name: string;
        email: string;
    };
    amountCents: number;
    method: string;
    status: string;
    purpose: string;
    description: string;
    createdAt: string;
}
interface FinanceData {
    entries: FinanceEntry[];
    payments: PaymentRow[];
    totals: {
        commissionCents: number;
        processedVolumeCents: number;
        refundsCents: number;
        payoutsCents: number;
    };
}
interface PayoutRow {
    id: string;
    amountCents: number;
    method: string;
    details: string;
    status: string;
    note: string | null;
    createdAt: string;
    processedAt: string | null;
    tutor: {
        id: string;
        user: {
            name: string;
            email: string;
            walletCents: number;
        };
    };
}
interface ReviewRow {
    id: string;
    rating: number;
    comment: string;
    response: string | null;
    status: string;
    createdAt: string;
    student: {
        name: string;
    };
    tutor: {
        user: {
            name: string;
        };
    } | null;
    booking: {
        startUtc: string;
    } | null;
}
interface SubjectRow {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string;
    icon: string;
    active: boolean;
    _count: {
        tutors: number;
    };
}
interface CouponRow {
    id: string;
    code: string;
    percentOff: number;
    active: boolean;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
}
interface PackageRow {
    id: string;
    name: string;
    lessons: number;
    priceCents: number;
    description: string | null;
    active: boolean;
    _count: {
        credits: number;
    };
}
interface CmsPage {
    id: string;
    slug: string;
    title: string;
    content: string;
    published: boolean;
    showInFooter: boolean;
    updatedAt: string;
}
interface CmsFaq {
    id: string;
    question: string;
    answer: string;
    order: number;
    published: boolean;
}
interface CmsTestimonial {
    id: string;
    name: string;
    role: string;
    country: string | null;
    content: string;
    rating: number;
    published: boolean;
}
interface CmsPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    published: boolean;
}
interface CmsData {
    pages: CmsPage[];
    faqs: CmsFaq[];
    testimonials: CmsTestimonial[];
    posts: CmsPost[];
}
interface AdminSettings {
    platformName: string;
    tagline: string;
    heroTitle: string;
    heroSubtitle: string;
    contactEmail: string;
    defaultCurrency: string;
    defaultLanguage: string;
    commissionPercent: number;
    trialLessonEnabled: boolean;
    trialCommissionPercent: number;
    minCancelNoticeHours: number;
    bookingNoticeHours: number;
    bookingHorizonDays: number;
    slotDurationMin: number;
    payoutMinCents: number;
    maintenanceMode: boolean;
    allowRegistrations: boolean;
    fxRates: Record<string, number>;
    paymentProviders: Record<string, boolean>;
    videoProvider: string;
}
type AdminSettingsData = AdminSettingsResponse;
interface AuditLogRow {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    meta: unknown;
    createdAt: string;
    actor: {
        name: string;
        email: string;
        role: string;
    } | null;
}
/* ------------------------------------------------------------------ */
/* Overview tab                                                        */
/* ------------------------------------------------------------------ */
/** Quick-jump destinations rendered as animated cards on the overview. */
const QUICK_ACTIONS: {
    tab: string;
    icon: LucideIcon;
    label: string;
    desc: string;
    tone: StatTone;
}[] = [
    { tab: 'applications', icon: ClipboardCheck, label: 'Review applications', desc: 'Approve tutor applications', tone: 'amber' },
    { tab: 'users', icon: Users, label: 'Manage users', desc: 'Suspend or restore accounts', tone: 'violet' },
    { tab: 'finance', icon: CircleDollarSign, label: 'Finance', desc: 'Ledger, revenue & refunds', tone: 'teal' },
    { tab: 'payouts', icon: Banknote, label: 'Payouts', desc: 'Approve withdrawals', tone: 'emerald' },
    { tab: 'games', icon: Gamepad2, label: 'Games', desc: 'Game center settings', tone: 'default' },
    { tab: 'cms', icon: ScrollText, label: 'Content', desc: 'Pages, FAQs & posts', tone: 'default' },
];
function OverviewTab({ stats, loading, error, refresh, onNavigate, }: {
    stats: OverviewStats | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
    onNavigate?: (tab: string) => void;
}) {
    if (error)
        return <LoadError message={error} onRetry={refresh}/>;
    if (!stats)
        return <SkeletonTable rows={8}/>;
    const c = stats.cards;
    const maxSubject = Math.max(1, ...stats.subjectDist.map((s) => s.count));
    const subjects = [...stats.subjectDist].sort((a, b) => b.count - a.count);
    // Derived, real metrics for the animated rings + sparklines.
    const finishedLessons = c.completedLessons + c.cancelledLessons;
    const completionRate = finishedLessons > 0 ? Math.round((c.completedLessons / finishedLessons) * 100) : 0;
    const activeTutorRate = c.totalTutors > 0 ? Math.round((c.activeTutors / c.totalTutors) * 100) : 0;
    return (<div className="space-y-6">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">{uiText("YOUR PLATFORM AT A GLANCE")}</p><h1>{uiText("Overview")}</h1><p>{uiText("Welcome back. Here\u2019s what\u2019s happening across your platform.")}</p></div>
        <div className="admin-page-actions"><span className="admin-period"><CalendarDays size={15}/>{uiText("All-time metrics")}</span><Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={cn('size-4', loading && 'animate-spin')}/>{uiText("Refresh")}</Button></div>
      </div>
      <StatGrid className="admin-kpi-grid">
        <StatCard icon={GraduationCap} label={uiText("Total students")} tone="teal" index={0} value={<CountUp value={c.totalStudents}/>} delta={<DeltaChip icon={TrendingUp} tone="emerald">+{uiText(c.newStudentsThisMonth)}{uiText(" this month")}</DeltaChip>}/>
        <StatCard icon={Users} label={uiText("Total tutors")} tone="violet" index={1} value={<CountUp value={c.totalTutors}/>} hint={uiText("{{value1}} active on the platform", { value1: c.activeTutors })}/>
        <StatCard icon={CalendarDays} label={uiText("Total bookings")} tone="default" index={2} value={<CountUp value={c.totalBookings}/>} hint={uiText("{{value1}} completed lessons", { value1: c.completedLessons })}/>
        <StatCard icon={CircleDollarSign} label={uiText("Platform revenue")} tone="teal" index={3} value={<CountUp value={c.platformRevenueCents} format={fmtMoney}/>} hint={uiText("All-time earned commission")}/>
      </StatGrid>
      <div className="admin-operations">
        <div className="admin-operations-intro"><span className="admin-operation-icon"><ClipboardCheck size={21}/></span><div><h2>{uiText("Needs your attention")}</h2><p>{uiText("Keep your platform moving forward.")}</p></div></div>
        <button onClick={() => onNavigate?.('applications')}><span className="admin-attention-number">{uiText(c.pendingApplications)}</span><span>{uiText("Tutor applications")}<small>{uiText("Awaiting your review")}</small></span><ArrowUpRight size={18}/></button>
        <button onClick={() => onNavigate?.('payouts')}><span className="admin-attention-money">{uiText(fmtMoney(c.pendingWithdrawalsCents))}</span><span>{uiText("Pending payouts")}<small>{uiText("Ready to process")}</small></span><ArrowUpRight size={18}/></button>
      </div>
      <div className="admin-health-strip">
        <span><i />{uiText("Platform snapshot")}</span>
        <span>{uiText("Lesson completion ")}<strong>{uiText(completionRate)}%</strong></span>
        <span>{uiText("Active tutors ")}<strong>{uiText(activeTutorRate)}%</strong></span>
        <span>{uiText("Gross volume ")}<strong>{uiText(fmtMoney(c.grossVolumeCents))}</strong></span>
        <span>{uiText("Wallet liability ")}<strong>{uiText(fmtMoney(c.walletLiabilityCents))}</strong></span>
      </div>

      {/* Quick actions */}
      <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {uiText(QUICK_ACTIONS.map((a) => (<StaggerItem key={a.tab} className="h-full">
            <button type="button" onClick={() => onNavigate?.(a.tab)} className="group flex h-full w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-start shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span className="flex min-w-0 items-center gap-3">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100', STAT_ICON_TONES[a.tone])}>
                  <a.icon className="size-4" aria-hidden/>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{uiText(a.label)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{uiText(a.desc)}</span>
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-teal-600 dark:group-hover:text-teal-400 rtl:rotate-180 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden/>
            </button>
          </StaggerItem>)))}
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{uiText("Bookings \u2014 last 30 days")}</CardTitle>
            <CardDescription>{uiText("Lessons booked per day")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.bookings30} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-bookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28}/>
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} minTickGap={24} tickFormatter={(v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v).slice(5) : String(v))}/>
                <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} allowDecimals={false} width={32}/>
                <Tooltip cursor={{ stroke: CHART_COLORS.muted, strokeOpacity: 0.35, strokeDasharray: '4 4' }} formatter={(value: number | string) => `${value} bookings`} {...chartTooltipBase}/>
                <Area type="monotone" dataKey="count" name="Bookings" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#grad-bookings)" activeDot={{ r: 4, strokeWidth: 0 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{uiText("Revenue \u2014 last 6 months")}</CardTitle>
            <CardDescription>{uiText("Gross volume vs platform revenue")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.revenue6} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => fmtMoney(v)}/>
                <Tooltip cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }} formatter={(value: number | string) => fmtMoney(Number(value))} {...chartTooltipBase}/>
                <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.muted }} iconType="circle" iconSize={8}/>
                <Bar dataKey="grossCents" name="Gross volume" fill={CHART_COLORS.muted} fillOpacity={0.45} radius={[6, 6, 0, 0]} maxBarSize={36}/>
                <Bar dataKey="revenueCents" name="Platform revenue" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={36}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{uiText("Subject distribution")}</CardTitle>
          <CardDescription>{uiText("Bookings per subject")}</CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? uiText((<EmptyState icon={BookOpen} label={uiText("No booking data yet.")}/>)) : (<div className="space-y-3 overflow-y-auto scroll-slim pe-1">
              {subjects.map((s, i) => (<div key={s.name} className="group flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm font-medium" title={s.name}>
                    {s.name}
                  </span>
                  <Progress value={(s.count / maxSubject) * 100} className="h-2 flex-1 rounded-full [&>div]:rounded-full [&>div]:bg-gradient-to-r [&>div]:from-teal-500 [&>div]:to-teal-600 dark:[&>div]:from-teal-500 dark:[&>div]:to-teal-400" style={{ transitionDelay: `${Math.min(i, 12) * 40}ms` }}/>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground transition-colors group-hover:text-foreground">
                    {uiText(s.count)}
                  </span>
                </div>))}
            </div>)}
        </CardContent>
      </Card>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Applications tab                                                    */
/* ------------------------------------------------------------------ */
function ApplicationsTab({ active, onStatsChanged, }: {
    active: boolean;
    onStatsChanged: () => void;
}) {
    const { toast } = useToast();
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [busyId, setBusyId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [dialog, setDialog] = useState<{
        app: TutorApplication;
        action: 'reject' | 'request_changes';
    } | null>(null);
    const [reason, setReason] = useState('');
    const fetcher = useMemo(() => active
        ? () => api<{
            applications: TutorApplication[];
        }>(`/api/admin/applications?status=${statusFilter}`)
        : null, [active, statusFilter]);
    const { data, loading, error, refresh } = useResource<{
        applications: TutorApplication[];
    }>(fetcher);
    async function decide(app: TutorApplication, action: 'approve' | 'reject' | 'request_changes', why?: string) {
        setBusyId(app.id);
        try {
            await api('/api/admin/applications', {
                method: 'POST',
                json: { tutorProfileId: app.id, action, ...(why ? { reason: why } : {}) },
            });
            toast({
                title: action === 'approve'
                    ? 'Application approved'
                    : action === 'reject'
                        ? 'Application rejected'
                        : 'Changes requested',
                description: `${app.user.name} has been notified.`,
            });
            refresh();
            onStatsChanged();
        }
        catch (e) {
            toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    async function submitDialog() {
        if (!dialog)
            return;
        if (!reason.trim())
            return;
        setSubmitting(true);
        await decide(dialog.app, dialog.action, reason.trim());
        setSubmitting(false);
        setDialog(null);
        setReason('');
    }
    const list = data?.applications ?? [];
    return (<div className="space-y-4">
      <ProfileChangesPanel />
      <SectionHeader title={uiText("Tutor applications")} description={uiText("Review tutor profiles, verification documents and availability.")} onRefresh={refresh}>
        <StatusFilterSelect value={statusFilter} onChange={setStatusFilter} options={['PENDING', 'APPROVED', 'REJECTED']} className="w-44"/>
      </SectionHeader>

      {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={4}/>)) : list.length === 0 ? uiText((<Card className="rounded-2xl">
          <EmptyState icon={ClipboardCheck} label={uiText("No {{value1}} applications.", { value1: statusFilter.toLowerCase() })}/>
        </Card>)) : (<div className="space-y-4 overflow-y-auto scroll-slim pe-1">
          {list.map((a) => {
                const isOpen = !!open[a.id];
                const sortedRules = [...a.rules].sort((x, y) => x.weekday - y.weekday || x.startMin - y.startMin);
                return (<Card key={a.id} className="group rounded-2xl transition-shadow duration-200 hover:shadow-md">
                <button type="button" className="flex w-full flex-wrap items-center gap-2 p-4 text-left" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [a.id]: !o[a.id] }))}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.user.name}</span>
                      <span className="text-sm text-muted-foreground">{a.user.email}</span>
                      <StatusBadge status={a.status}/>
                      {a.identityVerified ? uiText((<Badge variant="outline" className={TONES.teal}>{uiText("identity verified")}</Badge>)) : uiText((<Badge variant="outline" className={TONES.stone}>{uiText("not verified")}</Badge>))}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                      <span className="truncate">{uiText(a.headline)}</span>
                      <span>·</span>
                      <span className="tabular-nums">{uiText(fmtMoney(a.hourlyRateCents))}/h</span>
                      {a.subjects.length > 0 ? (<>
                          <span>·</span>
                          {a.subjects.slice(0, 4).map((s, i) => (<Badge key={`${s.subject.name}-${i}`} variant="secondary" className="text-xs">
                              {s.subject.name}
                            </Badge>))}
                          {a.subjects.length > 4 ? <span>+{uiText(a.subjects.length - 4)}{uiText(" more")}</span> : uiText(null)}
                        </>) : uiText(null)}
                    </div>
                  </div>
                  <ChevronDown className={`size-4 shrink-0 text-muted-foreground/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden/>
                </button>

                {isOpen ? uiText((<div className="space-y-4 border-t px-4 pb-4 pt-4">
                    {a.status === 'REJECTED' && a.rejectionReason ? uiText((<p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                        <span className="font-medium">{uiText("Rejection reason:")}</span> {uiText(a.rejectionReason)}
                      </p>)) : uiText(null)}

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label={uiText("Country")}>{a.user.country || '—'}</Field>
                      <Field label={uiText("Languages")}>{a.languages || '—'}</Field>
                      <Field label={uiText("Experience")}>
                        <span className="tabular-nums">{uiText(a.yearsExperience)}</span>{uiText(" years")}</Field>
                      <Field label={uiText("Hourly rate")}>{uiText(fmtMoney(a.hourlyRateCents))}</Field>
                      <Field label={uiText("Trial rate")}>{uiText(fmtMoney(a.trialRateCents))}</Field>
                      <Field label={uiText("Applied")}>
                        {uiText(new Date(a.user.createdAt).toLocaleString())}
                      </Field>
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={uiText("About")}>{a.about || '—'}</Field>
                      <Field label={uiText("Methodology")}>{a.methodology || '—'}</Field>
                      <Field label={uiText("Experience")}>{a.experience || '—'}</Field>
                      <Field label={uiText("Education")}>{a.education || '—'}</Field>
                      <Field label={uiText("Certifications")}>{a.certifications || '—'}</Field>
                      <Field label={uiText("Intro video")}>
                        {a.videoUrl ? uiText((<a href={a.videoUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300">
                            {uiText(a.videoUrl)}
                          </a>)) : uiText(('—'))}
                      </Field>
                    </div>

                    <Separator />

                    <ProfessionalSummary data={a} review/>
                    <Field label={uiText("Verification documents")}>
                      {a.verifications.length === 0 ? uiText((<span className="text-muted-foreground">{uiText("No documents uploaded.")}</span>)) : uiText((<div className="mt-2 space-y-2">
                          {uiText(a.verifications.map((v) => (<div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                              <div className="min-w-0">
                                <div className="font-medium">
                                  {uiText(v.label)} <span className="font-normal text-muted-foreground">({uiText(v.type)})</span>
                                </div>
                                {v.note ? <div className="text-xs text-muted-foreground">{uiText(v.note)}</div> : uiText(null)}
                              </div>
                              <div className="flex items-center gap-2">
                                <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300">{uiText("View file")}</a>
                                <StatusBadge status={v.status}/>
                              </div>
                            </div>)))}
                        </div>))}
                    </Field>

                    <Field label={uiText("Weekly availability")}>
                      {sortedRules.length === 0 ? uiText((<span className="text-muted-foreground">{uiText("No availability set.")}</span>)) : uiText((<div className="mt-2 flex flex-wrap gap-1.5">
                          {uiText(sortedRules.map((r, i) => (<Badge key={i} variant="outline" className="border-border bg-muted/40 text-muted-foreground">
                              {WEEKDAYS[r.weekday] ?? '?'} {uiText(fmtMin(r.startMin))}–{uiText(fmtMin(r.endMin))}
                            </Badge>)))}
                        </div>))}
                    </Field>

                    {a.status === 'PENDING' ? uiText((<div className="flex flex-wrap gap-2">
                        <Button disabled={busyId === a.id} onClick={() => void decide(a, 'approve')}>
                          {busyId === a.id ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <BadgeCheck className="size-4" aria-hidden/>}{uiText("Approve")}</Button>
                        <Button variant="outline" disabled={busyId === a.id} onClick={() => {
                                setDialog({ app: a, action: 'request_changes' });
                                setReason('');
                            }}>{uiText("Request changes")}</Button>
                        <Button variant="destructive" disabled={busyId === a.id} onClick={() => {
                                setDialog({ app: a, action: 'reject' });
                                setReason('');
                            }}>{uiText("Reject")}</Button>
                      </div>)) : uiText((<p className="text-sm text-muted-foreground">{uiText("This application has already been processed.")}</p>))}
                  </div>)) : uiText(null)}
              </Card>);
            })}
        </div>)}

      <Dialog open={!!dialog} onOpenChange={(o) => {
            if (!o)
                setDialog(null);
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.action === 'reject' ? uiText("Reject application") : uiText("Request changes")}</DialogTitle>
            <DialogDescription>
              {dialog?.app.user.name}{uiText(" will be notified")}{dialog?.action === 'reject' ? uiText(" that their application was rejected") : uiText(" and can re-submit their profile")}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="app-reason">{uiText("Reason (required)")}</Label>
            <Textarea id="app-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={uiText("Explain what needs to change or why the application is rejected\u2026")}/>
            {!reason.trim() ? <p className="text-xs text-red-600">{uiText("A reason is required.")}</p> : uiText(null)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button variant={dialog?.action === 'reject' ? 'destructive' : 'default'} disabled={!reason.trim() || submitting} onClick={() => void submitDialog()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}
              {dialog?.action === 'reject' ? uiText("Reject application") : uiText("Send request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Users tab                                                           */
/* ------------------------------------------------------------------ */
type UserActionKind = 'grant_credits' | 'remove_credits' | 'suspend' | 'activate' | 'set_commission' | 'change_role';
const USER_ACTION_META: Record<UserActionKind, {
    title: string;
    cta: string;
    description: string;
}> = {
    grant_credits: { title: 'Grant wallet credits', cta: 'Grant credits', description: 'Adds credits to the user wallet. Recorded in the finance ledger.' },
    remove_credits: { title: 'Remove wallet credits', cta: 'Remove credits', description: 'Deducts credits from the user wallet (enter a positive amount).' },
    suspend: { title: 'Suspend user', cta: 'Suspend', description: 'The user will be blocked from booking and teaching.' },
    activate: { title: 'Activate user', cta: 'Activate', description: 'Restores full access to the platform.' },
    set_commission: { title: 'Set tutor commission', cta: 'Save commission', description: 'Percent of lesson price kept by the platform for this tutor.' },
    change_role: { title: 'Change role', cta: 'Change role', description: 'Changes the permissions of this account immediately.' },
};
const ROLE_BADGE: Record<string, string> = {
    STUDENT: TONES.stone,
    TUTOR: TONES.teal,
    ADMIN: TONES.amber,
    SUPPORT: TONES.stone,
};
function UsersTab({ active, onStatsChanged, onOpenDetails }: {
    active: boolean;
    onStatsChanged: () => void;
    onOpenDetails: (id: string) => void;
}) {
    const { toast } = useToast();
    const [q, setQ] = useState('');
    const dq = useDebounced(q);
    const [role, setRole] = useState('ALL');
    const [status, setStatus] = useState('ALL');
    const [action, setAction] = useState<{
        user: AdminUserRow;
        kind: UserActionKind;
    } | null>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [percent, setPercent] = useState('');
    const [rolePick, setRolePick] = useState('STUDENT');
    const [submitting, setSubmitting] = useState(false);
    const fetcher = useMemo(() => {
        if (!active)
            return null;
        const params = new URLSearchParams();
        if (dq.trim())
            params.set('q', dq.trim());
        if (role !== 'ALL')
            params.set('role', role);
        if (status !== 'ALL')
            params.set('status', status);
        return () => api<{
            users: AdminUserRow[];
        }>(`/api/admin/users?${params.toString()}`);
    }, [active, dq, role, status]);
    const { data, loading, error, refresh } = useResource<{
        users: AdminUserRow[];
    }>(fetcher);
    useEffect(() => { const reload = () => refresh(); window.addEventListener('admin-accounts-updated', reload); return () => window.removeEventListener('admin-accounts-updated', reload); }, [refresh]);
    function openAction(u: AdminUserRow, kind: UserActionKind) {
        setAction({ user: u, kind });
        setAmount('');
        setNote('');
        setPercent(u.tutorProfile ? String(u.tutorProfile.commissionPercent) : '');
        setRolePick(u.role);
    }
    const amountCents = Math.round((parseFloat(amount) || 0) * 100);
    const amountValid = amountCents > 0;
    const percentNum = parseFloat(percent);
    const percentValid = !isNaN(percentNum) && percentNum >= 0 && percentNum <= 100;
    const submitDisabled = action?.kind === 'grant_credits' || action?.kind === 'remove_credits'
        ? !amountValid
        : action?.kind === 'set_commission'
            ? !percentValid
            : false;
    async function submitUserAction() {
        if (!action)
            return;
        const { user, kind } = action;
        setSubmitting(true);
        try {
            let json: Record<string, unknown>;
            if (kind === 'grant_credits' || kind === 'remove_credits') {
                json = { action: 'grant_credits', amountCents: kind === 'remove_credits' ? -amountCents : amountCents, ...(note.trim() ? { note: note.trim() } : {}) };
            }
            else if (kind === 'suspend') {
                json = { action: 'suspend', ...(note.trim() ? { note: note.trim() } : {}) };
            }
            else if (kind === 'activate') {
                json = { action: 'activate', ...(note.trim() ? { note: note.trim() } : {}) };
            }
            else if (kind === 'set_commission') {
                json = { action: 'set_commission', commissionPercent: percentNum };
            }
            else {
                json = { action: 'change_role', role: rolePick };
            }
            await api(`/api/admin/users/${user.id}`, { method: 'POST', json });
            toast({ title: 'User updated', description: `${user.name}: ${USER_ACTION_META[kind].cta.toLowerCase()} applied.` });
            setAction(null);
            refresh();
            onStatsChanged();
        }
        catch (e) {
            toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    const list = data?.users ?? [];
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Users")} description={uiText("Manage accounts, wallets, roles and tutor commissions.")} onRefresh={refresh}>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" aria-hidden/>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={uiText("Search name or email\u2026")} className="w-56 ps-8"/>
        </div>
        <StatusFilterSelect value={role} onChange={setRole} options={['ALL', 'STUDENT', 'TUTOR', 'ADMIN', 'SUPPORT']} className="w-36"/>
        <StatusFilterSelect value={status} onChange={setStatus} options={['ALL', 'ACTIVE', 'SUSPENDED']} className="w-36"/>
      </SectionHeader>

      <DataTableShell>
        {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={6}/>)) : list.length === 0 ? uiText((<EmptyState icon={Users} label={uiText("No users match the current filters.")}/>)) : (<Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("User")}</TableHead>
                <TableHead>{uiText("Role")}</TableHead>
                <TableHead>{uiText("Status")}</TableHead>
                <TableHead>{uiText("Country")}</TableHead>
                <TableHead className="text-right">{uiText("Wallet")}</TableHead>
                <TableHead>{uiText("Tutor")}</TableHead>
                <TableHead className="text-right">{uiText("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {list.map((u) => (<TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{uiText("Joined ")}{uiText(new Date(u.createdAt).toLocaleString())} ·{' '}
                        {u.emailVerified ? uiText((<Badge variant="outline" className={`${TONES.teal} px-1 py-0 text-[10px]`}>{uiText("email verified")}</Badge>)) : uiText((<Badge variant="outline" className={`${TONES.stone} px-1 py-0 text-[10px]`}>{uiText("unverified")}</Badge>))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE[u.role] ?? TONES.stone}>
                        {uiText(titleCase(u.role))}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status}/>
                    </TableCell>
                    <TableCell className="text-sm">{u.country || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{uiText(fmtMoney(u.walletCents))}</TableCell>
                    <TableCell>
                      {u.tutorProfile ? uiText((<div className="text-xs">
                          <StatusBadge status={u.tutorProfile.status}/>
                          <div className="mt-1 text-muted-foreground">
                            <span className="tabular-nums">{uiText(u.tutorProfile.commissionPercent)}%</span>{uiText(" commission \u00B7")}{' '}
                            <span className="tabular-nums">{uiText(u.tutorProfile.lessonsCompleted)}</span>{uiText(" lessons")}</div>
                        </div>)) : uiText((<span className="text-sm text-muted-foreground">—</span>))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" onClick={() => onOpenDetails(u.id)} aria-label={uiText("Details for {{value1}}", { value1: u.name })}><Eye className="size-4"/>{uiText("Details")}</Button><DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={uiText("Actions for {{value1}}", { value1: u.name })} className="size-9 max-sm:size-11">
                            <MoreHorizontal className="size-4" aria-hidden/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>{uiText("User actions")}</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => openAction(u, 'grant_credits')}>
                            <Plus className="size-4" aria-hidden/>{uiText(" Grant credits")}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openAction(u, 'remove_credits')}>
                            <Minus className="size-4" aria-hidden/>{uiText(" Remove credits")}</DropdownMenuItem>
                          {u.tutorProfile ? uiText((<DropdownMenuItem onSelect={() => openAction(u, 'set_commission')}>
                              <Percent className="size-4" aria-hidden/>{uiText(" Set commission")}</DropdownMenuItem>)) : uiText(null)}
                          <DropdownMenuItem onSelect={() => openAction(u, 'change_role')}>
                            <UserCog className="size-4" aria-hidden/>{uiText(" Change role")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.status === 'SUSPENDED' ? uiText((<DropdownMenuItem onSelect={() => openAction(u, 'activate')}>
                              <ShieldCheck className="size-4" aria-hidden/>{uiText(" Activate")}</DropdownMenuItem>)) : uiText((<DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => openAction(u, 'suspend')}>
                              <ShieldBan className="size-4" aria-hidden/>{uiText(" Suspend")}</DropdownMenuItem>))}
                        </DropdownMenuContent>
                      </DropdownMenu></div>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>)}
      </DataTableShell>

      <Dialog open={!!action} onOpenChange={(o) => {
            if (!o)
                setAction(null);
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{action ? uiText(USER_ACTION_META[action.kind].title) : ''}</DialogTitle>
            <DialogDescription>
              {action ? uiText("{{value1}} \u2014 {{value2}} ({{value3}})", { value1: USER_ACTION_META[action.kind].description, value2: action.user.name, value3: action.user.email }) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(action?.kind === 'grant_credits' || action?.kind === 'remove_credits') && uiText((<>
                <div className="space-y-1.5">
                  <Label htmlFor="credit-amount">{uiText("Amount (USD)")}</Label>
                  <Input id="credit-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10.00"/>
                  {amount && !amountValid ? <p className="text-xs text-red-600">{uiText("Enter an amount greater than 0.")}</p> : uiText(null)}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="credit-note">{uiText("Note (optional)")}</Label>
                  <Input id="credit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={uiText("Reason for adjustment")}/>
                </div>
              </>))}

            {(action?.kind === 'suspend' || action?.kind === 'activate') && uiText((<div className="space-y-1.5">
                <Label htmlFor="user-note">{uiText("Note (optional)")}</Label>
                <Input id="user-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={uiText("Audit note")}/>
              </div>))}

            {action?.kind === 'set_commission' && uiText((<div className="space-y-1.5">
                <Label htmlFor="commission-percent">{uiText("Commission percent")}</Label>
                <Input id="commission-percent" type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)}/>
                {percent && !percentValid ? <p className="text-xs text-red-600">{uiText("Must be between 0 and 100.")}</p> : uiText(null)}
              </div>))}

            {action?.kind === 'change_role' && uiText((<div className="space-y-1.5">
                <Label>{uiText("Role")}</Label>
                <Select value={rolePick} onValueChange={setRolePick}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uiText(['STUDENT', 'TUTOR', 'ADMIN', 'SUPPORT'].map((r) => (<SelectItem key={r} value={r}>
                        {uiText(titleCase(r))}
                      </SelectItem>)))}
                  </SelectContent>
                </Select>
              </div>))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button variant={action?.kind === 'suspend' ? 'destructive' : 'default'} disabled={submitDisabled || submitting} onClick={() => void submitUserAction()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}
              {action ? uiText(USER_ACTION_META[action.kind].cta) : uiText("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Bookings tab                                                        */
/* ------------------------------------------------------------------ */
function BookingsTab({ active }: {
    active: boolean;
}) {
    const [reviewBooking, setReviewBooking] = useState<BookingRow | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [q, setQ] = useState('');
    const dq = useDebounced(q);
    const fetcher = useMemo(() => {
        if (!active)
            return null;
        const params = new URLSearchParams();
        if (statusFilter !== 'ALL')
            params.set('status', statusFilter);
        if (dq.trim())
            params.set('q', dq.trim());
        return () => api<{
            bookings: BookingRow[];
        }>(`/api/admin/bookings?${params.toString()}`);
    }, [active, statusFilter, dq]);
    const { data, loading, error, refresh } = useResource<{
        bookings: BookingRow[];
    }>(fetcher);
    const list = data?.bookings ?? [];
    return (<div className="space-y-4">
      <GroupEnrollmentApprovals />
      <SectionHeader title={uiText("Bookings")} description={uiText("Every lesson booked on the platform.")} onRefresh={refresh}>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" aria-hidden/>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={uiText("Search student or tutor\u2026")} className="w-56 ps-8"/>
        </div>
        <StatusFilterSelect value={statusFilter} onChange={setStatusFilter} options={['ALL', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED']} className="w-44"/>
      </SectionHeader>

      <DataTableShell>
        {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={6}/>)) : list.length === 0 ? uiText((<EmptyState icon={CalendarDays} label={uiText("No bookings match the current filters.")}/>)) : (<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{uiText("When")}</TableHead>
                  <TableHead>{uiText("Student")}</TableHead>
                  <TableHead>{uiText("Tutor")}</TableHead>
                  <TableHead>{uiText("Subject")}</TableHead>
                  <TableHead className="text-right">{uiText("Price")}</TableHead>
                  <TableHead className="text-right">{uiText("Commission")}</TableHead>
                  <TableHead className="text-right">{uiText("Tutor net")}</TableHead>
                  <TableHead>{uiText("Payment")}</TableHead>
                  <TableHead>{uiText("Status")}</TableHead>
                  <TableHead>{uiText("Approval / private details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((b) => (<TableRow key={b.id}>
                    <TableCell>
                      <div className="text-sm">{uiText(new Date(b.startUtc).toLocaleString(undefined, { timeZone: "UTC" }))} <span className="text-[10px] text-muted-foreground">{uiText("UTC")}</span></div>
                      <div className="text-xs text-muted-foreground">
                        <span className="tabular-nums">{uiText(b.durationMin)}</span>{uiText(" min")}{b.isTrial ? uiText(" \u00B7 trial") : ''}
                        <span className="block">{b.lessonFormat === 'FACE_TO_FACE' ? uiText("Face to face") : uiText("Online")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{b.student.name}</div>
                      <div className="text-xs text-muted-foreground">{b.student.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{b.tutor.name}</div>
                      <div className="text-xs text-muted-foreground">{b.tutor.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{b.subject?.name ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{uiText(fmtMoney(b.priceCents))}</TableCell>
                    <TableCell className="text-right tabular-nums text-teal-700 dark:text-teal-400">{uiText(fmtMoney(b.commissionCents))}</TableCell>
                    <TableCell className="text-right tabular-nums">{uiText(fmtMoney(b.tutorNetCents))}</TableCell>
                    <TableCell>
                      {b.paymentMethod ? <Badge variant="outline" className={TONES.stone}>{uiText(titleCase(b.paymentMethod))}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={b.status}/>
                        {b.isTrial ? <Badge variant="outline" className={TONES.amber}>{uiText("Trial")}</Badge> : uiText(null)}
                      </div>
                    </TableCell>
                    <TableCell><Button size="sm" variant={b.status === 'PENDING_PAYMENT' ? 'default' : 'outline'} onClick={() => setReviewBooking(b)}>{b.status === 'PENDING_PAYMENT' ? uiText("Review payment") : uiText("Details")}</Button></TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>)}
      </DataTableShell>
      {reviewBooking && <BookingApprovalDialog key={reviewBooking.id} booking={reviewBooking} onClose={() => setReviewBooking(null)} onUpdated={refresh}/>}
      {loading && data ? uiText((<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3 animate-spin" aria-hidden/>{uiText("Refreshing\u2026")}</p>)) : uiText(null)}
    </div>);
}
/* ------------------------------------------------------------------ */
/* Finance tab                                                         */
/* ------------------------------------------------------------------ */
function FinanceTab({ active }: {
    active: boolean;
}) {
    const [typeFilter, setTypeFilter] = useState('ALL');
    const fetcher = useMemo(() => {
        if (!active)
            return null;
        const suffix = typeFilter !== 'ALL' ? `?type=${typeFilter}` : '';
        return () => api<FinanceData>(`/api/admin/finance${suffix}`);
    }, [active, typeFilter]);
    const { data, error, refresh } = useResource<FinanceData>(fetcher);
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Finance")} description={uiText("Wallet ledger and payment records.")} onRefresh={refresh}>
        <StatusFilterSelect value={typeFilter} onChange={setTypeFilter} options={['ALL', 'SPEND', 'EARNING', 'REFUND', 'PAYOUT', 'TOPUP', 'PACKAGE', 'ADJUSTMENT', 'BONUS']} className="w-44"/>
      </SectionHeader>

      {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={6}/>)) : (<>
          <StatGrid className="grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Percent} label={uiText("Commission earned")} tone="teal" index={0} value={<CountUp value={data.totals.commissionCents} format={fmtMoney}/>}/>
            <StatCard icon={Receipt} label={uiText("Processed volume")} index={1} value={<CountUp value={data.totals.processedVolumeCents} format={fmtMoney}/>}/>
            <StatCard icon={RotateCcw} label={uiText("Refunds")} tone="rose" index={2} value={<CountUp value={data.totals.refundsCents} format={fmtMoney}/>}/>
            <StatCard icon={Banknote} label={uiText("Payouts")} tone="violet" index={3} value={<CountUp value={data.totals.payoutsCents} format={fmtMoney}/>}/>
          </StatGrid>

          <Panel>
            <PanelHeader icon={Wallet} title={uiText("Wallet ledger")} description={uiText("Every credit and debit across user wallets")}/>
            {data.entries.length === 0 ? uiText((<EmptyState icon={Wallet} label={uiText("No ledger entries for this filter.")}/>)) : (<TableScroll>
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{uiText("Time")}</TableHead>
                        <TableHead>{uiText("User")}</TableHead>
                        <TableHead>{uiText("Type")}</TableHead>
                        <TableHead>{uiText("Description")}</TableHead>
                        <TableHead className="text-right">{uiText("Amount")}</TableHead>
                        <TableHead className="text-right">{uiText("Balance after")}</TableHead>
                        <TableHead>{uiText("Ref")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.entries.map((e) => (<TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {uiText(new Date(e.createdAt).toLocaleString())}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{e.user.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {e.user.email} · {uiText(titleCase(e.user.role))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={e.type}/>
                          </TableCell>
                          <TableCell className="max-w-64 text-sm" title={uiText(e.description)}>
                            <span className="line-clamp-2">{uiText(e.description)}</span>
                          </TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${e.amountCents >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                            {e.amountCents >= 0 ? '+' : '-'}
                            {uiText(fmtMoney(Math.abs(e.amountCents)))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{uiText(fmtMoney(e.balanceAfterCents))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {e.refType ? uiText("{{value1}} {{value2}}", { value1: titleCase(e.refType), value2: e.refId ? `#${e.refId.slice(0, 8)}` : '' }) : '—'}
                          </TableCell>
                        </TableRow>))}
                    </TableBody>
                  </Table>
              </TableScroll>)}
          </Panel>

          <Panel>
            <PanelHeader icon={Receipt} title={uiText("Payments")} description={uiText("External payment attempts and their status")}/>
            {data.payments.length === 0 ? uiText((<EmptyState icon={Receipt} label={uiText("No payment records yet.")}/>)) : (<TableScroll>
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{uiText("Time")}</TableHead>
                        <TableHead>{uiText("User")}</TableHead>
                        <TableHead className="text-right">{uiText("Amount")}</TableHead>
                        <TableHead>{uiText("Method")}</TableHead>
                        <TableHead>{uiText("Status")}</TableHead>
                        <TableHead>{uiText("Purpose")}</TableHead>
                        <TableHead>{uiText("Description")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payments.map((p) => (<TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {uiText(new Date(p.createdAt).toLocaleString())}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{p.user.name}</div>
                            <div className="text-xs text-muted-foreground">{p.user.email}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{uiText(fmtMoney(p.amountCents))}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={TONES.stone}>
                              {uiText(titleCase(p.method))}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status}/>
                          </TableCell>
                          <TableCell className="text-sm">{uiText(titleCase(p.purpose))}</TableCell>
                          <TableCell className="max-w-56 text-xs text-muted-foreground" title={uiText(p.description)}>
                            <span className="line-clamp-2">{p.description || '—'}</span>
                          </TableCell>
                        </TableRow>))}
                    </TableBody>
                  </Table>
              </TableScroll>)}
          </Panel>
        </>)}
    </div>);
}
/* ------------------------------------------------------------------ */
/* Payouts tab                                                         */
/* ------------------------------------------------------------------ */
function PayoutsTab({ active, onStatsChanged }: {
    active: boolean;
    onStatsChanged: () => void;
}) {
    const { toast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<PayoutRow | null>(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const fetcher = useMemo(() => (active ? () => api<{
        payouts: PayoutRow[];
    }>('/api/admin/payouts') : null), [active]);
    const { data, error, refresh } = useResource<{
        payouts: PayoutRow[];
    }>(fetcher);
    async function payoutAction(p: PayoutRow, action: 'approve' | 'mark_paid' | 'reject', extra?: Record<string, unknown>) {
        setBusyId(p.id);
        try {
            await api('/api/admin/payouts', { method: 'POST', json: { payoutId: p.id, action, ...(extra ?? {}) } });
            toast({
                title: action === 'approve' ? 'Payout approved' : 'Payout marked as paid',
                description: `${fmtMoney(p.amountCents)} for ${p.tutor.user.name}.`,
            });
            refresh();
            onStatsChanged();
        }
        catch (e) {
            toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    async function submitReject() {
        if (!rejecting)
            return;
        setSubmitting(true);
        await payoutAction(rejecting, 'reject', note.trim() ? { note: note.trim() } : {});
        setSubmitting(false);
        setRejecting(null);
        setNote('');
    }
    const list = data?.payouts ?? [];
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Withdrawal requests")} description={uiText("Review, approve and settle tutor payouts.")} onRefresh={refresh}/>

      <DataTableShell>
        {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={5}/>)) : list.length === 0 ? uiText((<EmptyState icon={Banknote} label={uiText("No payout requests yet.")}/>)) : (<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{uiText("Requested")}</TableHead>
                  <TableHead>{uiText("Tutor")}</TableHead>
                  <TableHead className="text-right">{uiText("Wallet")}</TableHead>
                  <TableHead className="text-right">{uiText("Amount")}</TableHead>
                  <TableHead>{uiText("Method")}</TableHead>
                  <TableHead>{uiText("Details")}</TableHead>
                  <TableHead>{uiText("Status")}</TableHead>
                  <TableHead className="text-right">{uiText("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (<TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {uiText(new Date(p.createdAt).toLocaleString())}
                      {p.processedAt ? uiText((<div>{uiText("Processed ")}{uiText(new Date(p.processedAt).toLocaleString())}</div>)) : uiText(null)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{p.tutor.user.name}</div>
                      <div className="text-xs text-muted-foreground">{p.tutor.user.email}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{uiText(fmtMoney(p.tutor.user.walletCents))}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{uiText(fmtMoney(p.amountCents))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TONES.stone}>
                        {uiText(titleCase(p.method))}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-40 text-xs text-muted-foreground" title={uiText(p.details)}>
                      <span className="line-clamp-2">{p.details || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status}/>
                      {p.note ? <div className="mt-1 max-w-32 text-xs text-muted-foreground" title={uiText(p.note)}><span className="line-clamp-2">{uiText(p.note)}</span></div> : uiText(null)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === 'REQUESTED' || p.status === 'APPROVED' ? uiText((<div className="flex justify-end gap-2">
                          {p.status === 'REQUESTED' ? uiText((<Button size="sm" disabled={busyId === p.id} onClick={() => void payoutAction(p, 'approve')}>
                              {busyId === p.id ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Approve")}</Button>)) : uiText((<Button size="sm" disabled={busyId === p.id} onClick={() => void payoutAction(p, 'mark_paid')}>
                              {busyId === p.id ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Mark paid")}</Button>))}
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" disabled={busyId === p.id} onClick={() => {
                        setRejecting(p);
                        setNote('');
                    }}>{uiText("Reject")}</Button>
                        </div>)) : uiText((<span className="text-xs text-muted-foreground">—</span>))}
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>)}
      </DataTableShell>

      <Dialog open={!!rejecting} onOpenChange={(o) => {
            if (!o)
                setRejecting(null);
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{uiText("Reject payout")}</DialogTitle>
            <DialogDescription>
              {rejecting
            ? uiText("{{value1}} will be returned to {{value2}}'s wallet and they will be notified.", { value1: fmtMoney(rejecting.amountCents), value2: rejecting.tutor.user.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="payout-note">{uiText("Note (optional)")}</Label>
            <Textarea id="payout-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={uiText("Why is this payout rejected?")}/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button variant="destructive" disabled={submitting} onClick={() => void submitReject()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Reject payout")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Reviews tab                                                         */
/* ------------------------------------------------------------------ */
function ReviewsTab({ active }: {
    active: boolean;
}) {
    const { toast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<ReviewRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const fetcher = useMemo(() => (active ? () => api<{
        reviews: ReviewRow[];
    }>('/api/admin/reviews') : null), [active]);
    const { data, error, refresh } = useResource<{
        reviews: ReviewRow[];
    }>(fetcher);
    async function reviewAction(r: ReviewRow, action: 'hide' | 'publish') {
        setBusyId(r.id);
        try {
            await api('/api/admin/reviews', { method: 'POST', json: { reviewId: r.id, action } });
            toast({ title: action === 'hide' ? 'Review hidden' : 'Review published' });
            refresh();
        }
        catch (e) {
            toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    async function doDelete() {
        if (!toDelete)
            return;
        setDeleting(true);
        try {
            await api('/api/admin/reviews', { method: 'POST', json: { reviewId: toDelete.id, action: 'delete' } });
            toast({ title: 'Review deleted' });
            setToDelete(null);
            refresh();
        }
        catch (e) {
            toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setDeleting(false);
        }
    }
    const list = data?.reviews ?? [];
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Reviews")} description={uiText("Moderate lesson reviews left by students.")} onRefresh={refresh}/>

      {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={5}/>)) : list.length === 0 ? uiText((<Card className="rounded-2xl">
          <EmptyState icon={Star} label={uiText("No reviews yet.")}/>
        </Card>)) : (<Card className="rounded-2xl">
          <div className="divide-y divide-border overflow-y-auto scroll-slim">
            {list.map((r) => (<div key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars rating={r.rating}/>
                  <span className="font-medium">{r.student.name}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{r.tutor?.user.name ?? uiText("Unknown tutor")}</span>
                  <StatusBadge status={r.status}/>
                  {r.booking ? uiText((<span className="text-xs text-muted-foreground">{uiText("Lesson ")}{uiText(new Date(r.booking.startUtc).toLocaleString(undefined, { timeZone: "UTC" }))}{uiText(" UTC")}</span>)) : uiText(null)}
                  <span className="ms-auto text-xs text-muted-foreground">{uiText(new Date(r.createdAt).toLocaleString())}</span>
                </div>
                <p className="mt-2 text-sm">{r.comment}</p>
                {r.response ? uiText((<div className="mt-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    <span className="font-medium">{uiText("Tutor response:")}</span> {uiText(r.response)}
                  </div>)) : uiText(null)}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => void reviewAction(r, r.status === 'PUBLISHED' ? 'hide' : 'publish')}>
                    {r.status === 'PUBLISHED' ? <EyeOff className="size-4" aria-hidden/> : <Eye className="size-4" aria-hidden/>}
                    {r.status === 'PUBLISHED' ? uiText("Hide") : uiText("Publish")}
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setToDelete(r)}>
                    <Trash2 className="size-4" aria-hidden/>{uiText("Delete")}</Button>
                </div>
              </div>))}
          </div>
        </Card>)}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => {
            if (!o)
                setToDelete(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Delete this review?")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("This permanently removes the review from the platform. This action cannot be undone.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={(e) => {
            e.preventDefault();
            void doDelete();
        }}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Delete review")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Subjects tab                                                        */
/* ------------------------------------------------------------------ */
function SubjectsTab({ active }: {
    active: boolean;
}) {
    const { toast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toDelete, setToDelete] = useState<SubjectRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const fetcher = useMemo(() => (active ? () => api<{
        subjects: SubjectRow[];
    }>('/api/admin/subjects') : null), [active]);
    const { data, error, refresh } = useResource<{
        subjects: SubjectRow[];
    }>(fetcher);
    async function toggleActive(s: SubjectRow, next: boolean) {
        setBusyId(s.id);
        try {
            await api('/api/admin/subjects', { method: 'PUT', json: { id: s.id, active: next } });
            toast({ title: next ? `${s.name} enabled` : `${s.name} disabled` });
            refresh();
        }
        catch (e) {
            toast({ title: 'Update failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    async function doDelete() {
        if (!toDelete)
            return;
        setDeleting(true);
        try {
            const res = await api<{
                message?: string;
            }>(`/api/admin/subjects?id=${toDelete.id}`, { method: 'DELETE' });
            toast({
                title: res?.message ?? `${toDelete.name} deleted`,
                description: res?.message ? 'The list has been refreshed.' : undefined,
            });
            setToDelete(null);
            refresh();
        }
        catch (e) {
            toast({ title: 'Delete failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setDeleting(false);
        }
    }
    async function createSubject() {
        if (!name.trim())
            return;
        setSubmitting(true);
        try {
            await api('/api/admin/subjects', {
                method: 'POST',
                json: { name: name.trim(), category: category.trim(), ...(description.trim() ? { description: description.trim() } : {}) },
            });
            toast({ title: 'Subject created', description: name.trim() });
            setCreateOpen(false);
            setName('');
            setCategory('');
            setDescription('');
            refresh();
        }
        catch (e) {
            toast({ title: 'Could not create subject', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    const list = data?.subjects ?? [];
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Subjects")} description={uiText("Catalog of subjects available to tutors and students.")} onRefresh={refresh}>
        <Button size="sm" onClick={() => {
            setName('');
            setCategory('');
            setDescription('');
            setCreateOpen(true);
        }}>
          <Plus className="size-4" aria-hidden/>{uiText("New subject")}</Button>
      </SectionHeader>

      <DataTableShell>
        {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={6}/>)) : list.length === 0 ? uiText((<EmptyState icon={BookOpen} label={uiText("No subjects defined yet.")}/>)) : (<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{uiText("Subject")}</TableHead>
                  <TableHead>{uiText("Slug")}</TableHead>
                  <TableHead>{uiText("Category")}</TableHead>
                  <TableHead>{uiText("Description")}</TableHead>
                  <TableHead className="text-right">{uiText("Tutors")}</TableHead>
                  <TableHead>{uiText("Active")}</TableHead>
                  <TableHead className="text-right">{uiText("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (<TableRow key={s.id} className={s.active ? '' : 'opacity-60'}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <span aria-hidden>{s.icon || '📘'}</span>
                        {s.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
                    <TableCell className="text-sm">{s.category || '—'}</TableCell>
                    <TableCell className="max-w-56 text-xs text-muted-foreground" title={uiText(s.description)}>
                      <span className="line-clamp-2">{s.description || '—'}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s._count?.tutors ?? uiText(0)}</TableCell>
                    <TableCell>
                      <Switch checked={s.active} disabled={busyId === s.id} onCheckedChange={(v) => void toggleActive(s, v)} aria-label={uiText("{{value1}} {{value2}}", { value1: s.active ? 'Disable' : 'Enable', value2: s.name })}/>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setToDelete(s)}>
                        <Trash2 className="size-4" aria-hidden/>{uiText("Delete")}</Button>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>)}
      </DataTableShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{uiText("New subject")}</DialogTitle>
            <DialogDescription>{uiText("Add a subject to the public catalog.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject-name">{uiText("Name (required)")}</Label>
              <Input id="subject-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={uiText("e.g. Mathematics")}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-category">{uiText("Category")}</Label>
              <Input id="subject-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={uiText("e.g. Sciences")}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-desc">{uiText("Description")}</Label>
              <Textarea id="subject-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={uiText("Short public description")}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button disabled={!name.trim() || submitting} onClick={() => void createSubject()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Create subject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => {
            if (!o)
                setToDelete(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Delete \u201C")}{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>{uiText("Subjects linked to existing tutors cannot be deleted \u2014 they will be deactivated instead.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={(e) => {
            e.preventDefault();
            void doDelete();
        }}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Coupons & Packages tab                                              */
/* ------------------------------------------------------------------ */
function CouponsPackagesTab({ active }: {
    active: boolean;
}) {
    const { toast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [couponOpen, setCouponOpen] = useState(false);
    const [code, setCode] = useState('');
    const [percentOff, setPercentOff] = useState('');
    const [maxUses, setMaxUses] = useState('');
    const [pkgOpen, setPkgOpen] = useState(false);
    const [pkgName, setPkgName] = useState('');
    const [pkgLessons, setPkgLessons] = useState('');
    const [pkgPrice, setPkgPrice] = useState('');
    const [pkgDesc, setPkgDesc] = useState('');
    const [toDelete, setToDelete] = useState<{
        kind: 'coupon' | 'package';
        id: string;
        label: string;
    } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const fetcher = useMemo(() => (active ? () => api<{
        coupons: CouponRow[];
        packages: PackageRow[];
    }>('/api/admin/coupons') : null), [active]);
    const { data, error, refresh } = useResource<{
        coupons: CouponRow[];
        packages: PackageRow[];
    }>(fetcher);
    async function couponPost(json: Record<string, unknown>, okTitle: string) {
        await api('/api/admin/coupons', { method: 'POST', json });
        toast({ title: okTitle });
        refresh();
    }
    async function toggle(kind: 'coupon' | 'package', id: string, next: boolean) {
        setBusyId(id);
        try {
            await couponPost({ kind, op: 'update', id, active: next }, kind === 'coupon' ? 'Coupon updated' : 'Package updated');
        }
        catch (e) {
            toast({ title: 'Update failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    async function doDelete() {
        if (!toDelete)
            return;
        setDeleting(true);
        try {
            await couponPost({ kind: toDelete.kind, op: 'delete', id: toDelete.id }, `${toDelete.label} deleted`);
            setToDelete(null);
        }
        catch (e) {
            toast({ title: 'Delete failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setDeleting(false);
        }
    }
    async function createCoupon() {
        const p = Math.round(parseFloat(percentOff) || 0);
        if (!code.trim() || p < 1 || p > 100)
            return;
        const uses = Math.round(parseFloat(maxUses) || 0);
        setSubmitting(true);
        try {
            await couponPost({ kind: 'coupon', op: 'create', code: code.trim().toUpperCase(), percentOff: p, ...(uses > 0 ? { maxUses: uses } : {}) }, 'Coupon created');
            setCouponOpen(false);
            setCode('');
            setPercentOff('');
            setMaxUses('');
        }
        catch (e) {
            toast({ title: 'Could not create coupon', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    async function createPackage() {
        const lessons = Math.round(parseFloat(pkgLessons) || 0);
        const priceCents = Math.round((parseFloat(pkgPrice) || 0) * 100);
        if (!pkgName.trim() || lessons < 1 || priceCents <= 0)
            return;
        setSubmitting(true);
        try {
            await couponPost({
                kind: 'package',
                op: 'create',
                name: pkgName.trim(),
                lessons,
                priceCents,
                ...(pkgDesc.trim() ? { description: pkgDesc.trim() } : {}),
            }, 'Package created');
            setPkgOpen(false);
            setPkgName('');
            setPkgLessons('');
            setPkgPrice('');
            setPkgDesc('');
        }
        catch (e) {
            toast({ title: 'Could not create package', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    const coupons = data?.coupons ?? [];
    const packages = data?.packages ?? [];
    const couponValid = !!code.trim() && (parseFloat(percentOff) || 0) >= 1 && (parseFloat(percentOff) || 0) <= 100;
    const pkgValid = !!pkgName.trim() && (parseFloat(pkgLessons) || 0) >= 1 && Math.round((parseFloat(pkgPrice) || 0) * 100) > 0;
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Coupons & packages")} description={uiText("Discount codes and prepaid lesson bundles.")} onRefresh={refresh}>
        <Button size="sm" variant="outline" onClick={() => {
            setCode('');
            setPercentOff('');
            setMaxUses('');
            setCouponOpen(true);
        }}>
          <Plus className="size-4" aria-hidden/>{uiText("New coupon")}</Button>
        <Button size="sm" onClick={() => {
            setPkgName('');
            setPkgLessons('');
            setPkgPrice('');
            setPkgDesc('');
            setPkgOpen(true);
        }}>
          <Plus className="size-4" aria-hidden/>{uiText("New package")}</Button>
      </SectionHeader>

      {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={6}/>)) : (<>
          <Panel>
            <PanelHeader icon={Ticket} title={uiText("Coupons")} description={uiText("Percent-off codes applied at checkout")}/>
            {coupons.length === 0 ? uiText((<EmptyState icon={Ticket} label={uiText("No coupons yet.")}/>)) : uiText((<TableScroll>
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{uiText("Code")}</TableHead>
                        <TableHead className="text-right">{uiText("Discount")}</TableHead>
                        <TableHead className="text-right">{uiText("Uses")}</TableHead>
                        <TableHead>{uiText("Expires")}</TableHead>
                        <TableHead>{uiText("Active")}</TableHead>
                        <TableHead className="text-right">{uiText("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uiText(coupons.map((c) => (<TableRow key={c.id} className={c.active ? '' : 'opacity-60'}>
                          <TableCell className="font-mono font-medium">{c.code}</TableCell>
                          <TableCell className="text-right tabular-nums">{uiText(c.percentOff)}%</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {uiText(c.usedCount)} / {c.maxUses ?? '∞'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.expiresAt ? uiText(new Date(c.expiresAt).toLocaleString()) : uiText("No expiry")}
                          </TableCell>
                          <TableCell>
                            <Switch checked={c.active} disabled={busyId === c.id} onCheckedChange={(v) => void toggle('coupon', c.id, v)} aria-label={uiText("{{value1}} coupon {{value2}}", { value1: c.active ? 'Disable' : 'Enable', value2: c.code })}/>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setToDelete({ kind: 'coupon', id: c.id, label: `Coupon ${c.code}` })}>
                              <Trash2 className="size-4" aria-hidden/>{uiText("Delete")}</Button>
                          </TableCell>
                        </TableRow>)))}
                    </TableBody>
                  </Table>
              </TableScroll>))}
          </Panel>

          <Panel>
            <PanelHeader icon={Ticket} title={uiText("Packages")} description={uiText("Prepaid lesson bundles sold as wallet credits")}/>
            {packages.length === 0 ? uiText((<EmptyState icon={Ticket} label={uiText("No packages yet.")}/>)) : (<TableScroll>
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{uiText("Name")}</TableHead>
                        <TableHead className="text-right">{uiText("Lessons")}</TableHead>
                        <TableHead className="text-right">{uiText("Price")}</TableHead>
                        <TableHead className="text-right">{uiText("Sold")}</TableHead>
                        <TableHead>{uiText("Description")}</TableHead>
                        <TableHead>{uiText("Active")}</TableHead>
                        <TableHead className="text-right">{uiText("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packages.map((p) => (<TableRow key={p.id} className={p.active ? '' : 'opacity-60'}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{uiText(p.lessons)}</TableCell>
                          <TableCell className="text-right tabular-nums">{uiText(fmtMoney(p.priceCents))}</TableCell>
                          <TableCell className="text-right tabular-nums">{p._count?.credits ?? uiText(0)}</TableCell>
                          <TableCell className="max-w-48 text-xs text-muted-foreground" title={p.description ?? ''}>
                            <span className="line-clamp-2">{p.description || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <Switch checked={p.active} disabled={busyId === p.id} onCheckedChange={(v) => void toggle('package', p.id, v)} aria-label={uiText("{{value1}} package {{value2}}", { value1: p.active ? 'Disable' : 'Enable', value2: p.name })}/>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setToDelete({ kind: 'package', id: p.id, label: `Package ${p.name}` })}>
                              <Trash2 className="size-4" aria-hidden/>{uiText("Delete")}</Button>
                          </TableCell>
                        </TableRow>))}
                    </TableBody>
                  </Table>
              </TableScroll>)}
          </Panel>
        </>)}

      <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{uiText("New coupon")}</DialogTitle>
            <DialogDescription>{uiText("Students enter this code at checkout for a percent discount.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">{uiText("Code (required)")}</Label>
              <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={uiText("WELCOME10")} className="font-mono uppercase"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-percent">{uiText("Percent off (1\u2013100)")}</Label>
              <Input id="coupon-percent" type="number" min="1" max="100" value={percentOff} onChange={(e) => setPercentOff(e.target.value)} placeholder="10"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-max">{uiText("Max uses (optional \u2014 empty for unlimited)")}</Label>
              <Input id="coupon-max" type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="100"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponOpen(false)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button disabled={!couponValid || submitting} onClick={() => void createCoupon()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Create coupon")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{uiText("New package")}</DialogTitle>
            <DialogDescription>{uiText("A bundle of lessons students purchase upfront.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-name">{uiText("Name (required)")}</Label>
              <Input id="pkg-name" value={pkgName} onChange={(e) => setPkgName(e.target.value)} placeholder={uiText("Starter pack")}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-lessons">{uiText("Lessons")}</Label>
                <Input id="pkg-lessons" type="number" min="1" value={pkgLessons} onChange={(e) => setPkgLessons(e.target.value)} placeholder="5"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-price">{uiText("Price (USD)")}</Label>
                <Input id="pkg-price" type="number" min="0.01" step="0.01" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} placeholder="49.00"/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-desc">{uiText("Description (optional)")}</Label>
              <Textarea id="pkg-desc" rows={2} value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value)} placeholder={uiText("Shown on the packages page")}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgOpen(false)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button disabled={!pkgValid || submitting} onClick={() => void createPackage()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Create package")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => {
            if (!o)
                setToDelete(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Delete ")}{uiText(toDelete?.label.toLowerCase())}?</AlertDialogTitle>
            <AlertDialogDescription>{uiText("This permanently removes it from the platform. This action cannot be undone.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={(e) => {
            e.preventDefault();
            void doDelete();
        }}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
/* ------------------------------------------------------------------ */
/* CMS tab                                                             */
/* ------------------------------------------------------------------ */
function PagesSection({ pages, onChanged }: {
    pages: CmsPage[];
    onChanged: () => void;
}) {
    const { toast } = useToast();
    const [dlg, setDlg] = useState<{
        mode: 'create';
    } | {
        mode: 'edit';
        page: CmsPage;
    } | null>(null);
    const [slug, setSlug] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [format, setFormat] = useState('text'), [css, setCss] = useState('');
    const [published, setPublished] = useState(true);
    const [showInFooter, setShowInFooter] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    function openCreate() {
        setSlug('');
        setTitle('');
        setContent('');
        setCss('');
        setFormat('text');
        setPublished(true);
        setShowInFooter(true);
        setDlg({ mode: 'create' });
    }
    function openEdit(page: CmsPage) {
        setSlug(page.slug);
        setTitle(page.title);
        const designed = readDesignedPage(page.content);
        setContent(designed?.html ?? page.content);
        setCss(designed?.css || '');
        setFormat(designed ? 'html' : 'text');
        setPublished(page.published);
        setShowInFooter(page.showInFooter);
        setDlg({ mode: 'edit', page });
    }
    async function submit() {
        if (!dlg)
            return;
        if (dlg.mode === 'create' && !slug.trim())
            return;
        if (!title.trim())
            return;
        setSubmitting(true);
        try {
            const json = dlg.mode === 'create'
                ? { type: 'page', op: 'create', slug: slugify(slug), title: title.trim(), content: format === 'html' ? JSON.stringify({ format: 'html', html: content, css }) : content, published, showInFooter }
                : { type: 'page', op: 'update', id: dlg.page.id, title: title.trim(), content: format === 'html' ? JSON.stringify({ format: 'html', html: content, css }) : content, published, showInFooter };
            await api('/api/admin/cms', { method: 'POST', json });
            toast({ title: dlg.mode === 'create' ? 'Page created' : 'Page saved' });
            setDlg(null);
            onChanged();
        }
        catch (e) {
            toast({ title: 'Save failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    return (<div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="size-4" aria-hidden/>{uiText("New page")}</Button>
      </div>
      {pages.length === 0 ? uiText((<EmptyState icon={FileText} label={uiText("No CMS pages yet.")}/>)) : uiText((<div className="space-y-2 overflow-y-auto scroll-slim pe-1">
          {uiText(pages.map((p) => (<div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{uiText(p.title)}</span>
                  <span className="font-mono text-xs text-muted-foreground">/{p.slug}</span>
                  {p.published ? uiText((<Badge variant="outline" className={TONES.teal}>{uiText("published")}</Badge>)) : uiText((<Badge variant="outline" className={TONES.amber}>{uiText("draft")}</Badge>))}
                  {p.showInFooter ? <Badge variant="outline" className={TONES.stone}>{uiText("in footer")}</Badge> : uiText(null)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{uiText("Updated ")}{uiText(new Date(p.updatedAt).toLocaleString())}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(p)}>{uiText("Edit")}</Button><DeleteAction label={uiText("page")} onDelete={async () => { await api('/api/admin/cms', { method: 'POST', json: { type: 'page', op: 'delete', id: p.id } }); onChanged(); }}/>
            </div>)))}
        </div>))}

      <Dialog open={!!dlg} onOpenChange={(o) => {
            if (!o)
                setDlg(null);
        }}>
        <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dlg?.mode === 'create' ? uiText("New CMS page") : uiText("Edit page")}</DialogTitle>
            <DialogDescription>
              {dlg?.mode === 'create' ? uiText("Create a static page (slug and title). Content can be edited afterwards.") : uiText("Update the page content and visibility.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dlg?.mode === 'create' ? uiText((<div className="space-y-1.5">
                <Label htmlFor="page-slug">{uiText("Slug (required)")}</Label>
                <Input id="page-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={uiText("about-us")}/>
              </div>)) : uiText(null)}
            <div className="space-y-1.5">
              <Label htmlFor="page-title">{uiText("Title (required)")}</Label>
              <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={uiText("About us")}/>
            </div>
            {dlg ? uiText((<>
                <div className="space-y-1.5">
                  <label className="grid gap-2 text-sm">{uiText("Content format")}<select className="feature-select" value={format} onChange={e => setFormat(e.target.value)}><option value="text">{uiText("Text / Markdown")}</option><option value="html">{uiText("HTML & CSS")}</option></select></label><Label htmlFor="page-content">{format === 'html' ? uiText("HTML") : uiText("Content")}</Label>
                  <Textarea id="page-content" className={format === 'html' ? 'font-mono' : ''} rows={8} value={content} onChange={(e) => setContent(e.target.value)}/>{format === 'html' && <><Label htmlFor="page-css">{uiText("CSS")}</Label><Textarea id="page-css" className="font-mono" rows={6} value={css} onChange={e => setCss(e.target.value)}/><p className="text-xs text-muted-foreground">{uiText("HTML and CSS render in an isolated page. Scripts and forms are disabled.")}</p><iframe title={uiText("Page design preview")} sandbox="" srcDoc={pageDocument(content, css)} className="h-80 w-full rounded-xl border bg-white"/></>}
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch id="page-published" checked={published} onCheckedChange={setPublished}/>
                    <Label htmlFor="page-published">{uiText("Published")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="page-footer" checked={showInFooter} onCheckedChange={setShowInFooter}/>
                    <Label htmlFor="page-footer">{uiText("Show in footer")}</Label>
                  </div>
                </div>
              </>)) : uiText(null)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button disabled={submitting || !title.trim() || (dlg?.mode === 'create' && !slug.trim())} onClick={() => void submit()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}
              {dlg?.mode === 'create' ? uiText("Create page") : uiText("Save changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
function FaqsSection({ faqs, onChanged }: {
    faqs: CmsFaq[];
    onChanged: () => void;
}) {
    const { toast } = useToast();
    const [dlg, setDlg] = useState<{
        mode: 'create';
    } | {
        mode: 'edit';
        faq: CmsFaq;
    } | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [order, setOrder] = useState('0');
    const [submitting, setSubmitting] = useState(false);
    const [toDelete, setToDelete] = useState<CmsFaq | null>(null);
    const [deleting, setDeleting] = useState(false);
    function openDlg(faq?: CmsFaq) {
        setQuestion(faq?.question ?? '');
        setAnswer(faq?.answer ?? '');
        setOrder(String(faq?.order ?? 0));
        setDlg(faq ? { mode: 'edit', faq } : { mode: 'create' });
    }
    async function submit() {
        if (!dlg || !question.trim() || !answer.trim())
            return;
        setSubmitting(true);
        try {
            const json = dlg.mode === 'create'
                ? { type: 'faq', op: 'create', question: question.trim(), answer: answer.trim(), order: Math.round(parseFloat(order) || 0) }
                : { type: 'faq', op: 'update', id: dlg.faq.id, question: question.trim(), answer: answer.trim(), order: Math.round(parseFloat(order) || 0) };
            await api('/api/admin/cms', { method: 'POST', json });
            toast({ title: dlg.mode === 'create' ? 'FAQ created' : 'FAQ saved' });
            setDlg(null);
            onChanged();
        }
        catch (e) {
            toast({ title: 'Save failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    async function doDelete() {
        if (!toDelete)
            return;
        setDeleting(true);
        try {
            await api('/api/admin/cms', { method: 'POST', json: { type: 'faq', op: 'delete', id: toDelete.id } });
            toast({ title: 'FAQ deleted' });
            setToDelete(null);
            onChanged();
        }
        catch (e) {
            toast({ title: 'Delete failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setDeleting(false);
        }
    }
    return (<div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => openDlg()}>
          <Plus className="size-4" aria-hidden/>{uiText("New FAQ")}</Button>
      </div>
      {faqs.length === 0 ? uiText((<EmptyState icon={FileText} label={uiText("No FAQs yet.")}/>)) : uiText((<div className="space-y-2 overflow-y-auto scroll-slim pe-1">
          {uiText(faqs.map((f) => (<div key={f.id} className="flex flex-wrap items-start gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{uiText(f.question)}</span>
                  <Badge variant="outline" className={TONES.stone}>{uiText("order ")}{uiText(f.order)}</Badge>
                  {f.published ? uiText((<Badge variant="outline" className={TONES.teal}>{uiText("published")}</Badge>)) : uiText((<Badge variant="outline" className={TONES.amber}>{uiText("hidden")}</Badge>))}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{uiText(f.answer)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openDlg(f)}>{uiText("Edit")}</Button>
                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setToDelete(f)}>
                  <Trash2 className="size-4" aria-hidden/>{uiText("Delete")}</Button>
              </div>
            </div>)))}
        </div>))}

      <Dialog open={!!dlg} onOpenChange={(o) => {
            if (!o)
                setDlg(null);
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dlg?.mode === 'create' ? uiText("New FAQ") : uiText("Edit FAQ")}</DialogTitle>
            <DialogDescription>{uiText("Questions are shown in the help section, ordered by the order field.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="faq-question">{uiText("Question (required)")}</Label>
              <Input id="faq-question" value={question} onChange={(e) => setQuestion(e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-answer">{uiText("Answer (required)")}</Label>
              <Textarea id="faq-answer" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-order">{uiText("Order")}</Label>
              <Input id="faq-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button disabled={submitting || !question.trim() || !answer.trim()} onClick={() => void submit()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}
              {dlg?.mode === 'create' ? uiText("Create FAQ") : uiText("Save changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => {
            if (!o)
                setToDelete(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Delete this FAQ?")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("This removes the question from the help section permanently.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={(e) => {
            e.preventDefault();
            void doDelete();
        }}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
function TestimonialsSection({ testimonials, onChanged }: {
    testimonials: CmsTestimonial[];
    onChanged: () => void;
}) {
    const { toast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<CmsTestimonial | null>(null);
    const [deleting, setDeleting] = useState(false);
    async function toggle(t: CmsTestimonial, published: boolean) {
        setBusyId(t.id);
        try {
            await api('/api/admin/cms', { method: 'POST', json: { type: 'testimonial', op: 'update', id: t.id, published } });
            toast({ title: published ? 'Testimonial published' : 'Testimonial hidden' });
            onChanged();
        }
        catch (e) {
            toast({ title: 'Update failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    async function doDelete() {
        if (!toDelete)
            return;
        setDeleting(true);
        try {
            await api('/api/admin/cms', { method: 'POST', json: { type: 'testimonial', op: 'delete', id: toDelete.id } });
            toast({ title: 'Testimonial deleted' });
            setToDelete(null);
            onChanged();
        }
        catch (e) {
            toast({ title: 'Delete failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setDeleting(false);
        }
    }
    return (<div className="space-y-3">
      {testimonials.length === 0 ? uiText((<EmptyState icon={Star} label={uiText("No testimonials yet.")}/>)) : (<div className="space-y-2 overflow-y-auto scroll-slim pe-1">
          {testimonials.map((t) => (<div key={t.id} className="flex flex-wrap items-start gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {uiText(t.role)}
                    {t.country ? uiText(" \u00B7 {{value1}}", { value1: t.country }) : ''}
                  </span>
                  <Stars rating={t.rating}/>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.content}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={t.published} disabled={busyId === t.id} onCheckedChange={(v) => void toggle(t, v)} aria-label={uiText("{{value1}} testimonial by {{value2}}", { value1: t.published ? 'Hide' : 'Publish', value2: t.name })}/>
                  <span className="text-xs text-muted-foreground">{t.published ? uiText("Published") : uiText("Hidden")}</span>
                </div>
                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setToDelete(t)}>
                  <Trash2 className="size-4" aria-hidden/>{uiText("Delete")}</Button>
              </div>
            </div>))}
        </div>)}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => {
            if (!o)
                setToDelete(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Delete this testimonial?")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("This removes it from the landing page permanently.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={(e) => {
            e.preventDefault();
            void doDelete();
        }}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
function PostsSection({ posts, onChanged }: {
    posts: CmsPost[];
    onChanged: () => void;
}) {
    const { toast } = useToast();
    const [dlg, setDlg] = useState<CmsPost | null>(null);
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [content, setContent] = useState('');
    const [published, setPublished] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    function openEdit(post: CmsPost) {
        setTitle(post.title);
        setExcerpt(post.excerpt);
        setContent(post.content);
        setPublished(post.published);
        setDlg(post);
    }
    async function submit() {
        if (!dlg || !title.trim())
            return;
        setSubmitting(true);
        try {
            await api('/api/admin/cms', {
                method: 'POST',
                json: { type: 'post', op: 'update', id: dlg.id, title: title.trim(), excerpt, content, published },
            });
            toast({ title: 'Post saved' });
            setDlg(null);
            onChanged();
        }
        catch (e) {
            toast({ title: 'Save failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSubmitting(false);
        }
    }
    async function togglePublish(post: CmsPost, next: boolean) {
        setBusyId(post.id);
        try {
            await api('/api/admin/cms', { method: 'POST', json: { type: 'post', op: 'update', id: post.id, published: next } });
            toast({ title: next ? 'Post published' : 'Post unpublished' });
            onChanged();
        }
        catch (e) {
            toast({ title: 'Update failed', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setBusyId(null);
        }
    }
    return (<div className="space-y-3">
      {posts.length === 0 ? uiText((<EmptyState icon={FileText} label={uiText("No blog posts yet.")}/>)) : uiText((<div className="space-y-2 overflow-y-auto scroll-slim pe-1">
          {uiText(posts.map((p) => (<div key={p.id} className="flex flex-wrap items-start gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{uiText(p.title)}</span>
                  <span className="font-mono text-xs text-muted-foreground">/{p.slug}</span>
                  {p.published ? uiText((<Badge variant="outline" className={TONES.teal}>{uiText("published")}</Badge>)) : uiText((<Badge variant="outline" className={TONES.amber}>{uiText("draft")}</Badge>))}
                </div>
                {p.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{uiText(p.excerpt)}</p> : uiText(null)}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={p.published} disabled={busyId === p.id} onCheckedChange={(v) => void togglePublish(p, v)} aria-label={uiText("{{value1}} {{value2}}", { value1: p.published ? 'Unpublish' : 'Publish', value2: p.title })}/>
                  <span className="text-xs text-muted-foreground">{p.published ? uiText("Live") : uiText("Draft")}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>{uiText("Edit")}</Button>
              </div>
            </div>)))}
        </div>))}

      <Dialog open={!!dlg} onOpenChange={(o) => {
            if (!o)
                setDlg(null);
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{uiText("Edit post")}</DialogTitle>
            <DialogDescription>{dlg ? uiText(`/${dlg.slug}`) : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-title">{uiText("Title (required)")}</Label>
              <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-excerpt">{uiText("Excerpt")}</Label>
              <Textarea id="post-excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-content">{uiText("Content")}</Label>
              <Textarea id="post-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)}/>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="post-published" checked={published} onCheckedChange={setPublished}/>
              <Label htmlFor="post-published">{uiText("Published")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)} disabled={submitting}>{uiText("Cancel")}</Button>
            <Button disabled={submitting || !title.trim()} onClick={() => void submit()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Save changes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
function CmsTab({ active }: {
    active: boolean;
}) {
    const [subTab, setSubTab] = useState('pages');
    const fetcher = useMemo(() => (active ? () => api<CmsData>('/api/admin/cms') : null), [active]);
    const { data, error, refresh } = useResource<CmsData>(fetcher);
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Content management")} description={uiText("Pages, FAQs, testimonials and blog posts shown on the public site.")} onRefresh={refresh}/>

      {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={5}/>)) : uiText((<Card className="rounded-2xl">
          <CardContent className="p-4 md:p-6">
            <Tabs value={subTab} onValueChange={setSubTab}>
              <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto scroll-slim">
                <TabsTrigger value="pages" className="shrink-0">{uiText("Pages")}</TabsTrigger>
                <TabsTrigger value="faqs" className="shrink-0">{uiText("FAQs")}</TabsTrigger>
                <TabsTrigger value="testimonials" className="shrink-0">{uiText("Testimonials")}</TabsTrigger>
                <TabsTrigger value="posts" className="shrink-0">{uiText("Posts")}</TabsTrigger>
              </TabsList>
              <TabsContent value="pages">
                <PagesSection pages={data.pages} onChanged={refresh}/>
              </TabsContent>
              <TabsContent value="faqs">
                <FaqsSection faqs={data.faqs} onChanged={refresh}/>
              </TabsContent>
              <TabsContent value="testimonials">
                <TestimonialsSection testimonials={data.testimonials} onChanged={refresh}/>
              </TabsContent>
              <TabsContent value="posts">
                <PostsSection posts={data.posts} onChanged={refresh}/>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>))}
    </div>);
}
/* ------------------------------------------------------------------ */
/* Settings tab                                                        */
/* ------------------------------------------------------------------ */
interface FxRow {
    key: string;
    value: string;
}
interface SettingsFormState {
    platformName: string;
    tagline: string;
    heroTitle: string;
    heroSubtitle: string;
    contactEmail: string;
    defaultCurrency: string;
    defaultLanguage: string;
    commissionPercent: string;
    trialLessonEnabled: boolean;
    trialCommissionPercent: string;
    payoutMin: string;
    minCancelNoticeHours: string;
    bookingNoticeHours: string;
    bookingHorizonDays: string;
    slotDurationMin: string;
    maintenanceMode: boolean;
    allowRegistrations: boolean;
    fxRows: FxRow[];
    paymentProviders: Record<string, boolean>;
}
function settingsToForm(s: AdminSettings): SettingsFormState {
    return {
        platformName: s.platformName ?? '',
        tagline: s.tagline ?? '',
        heroTitle: s.heroTitle ?? '',
        heroSubtitle: s.heroSubtitle ?? '',
        contactEmail: s.contactEmail ?? '',
        defaultCurrency: s.defaultCurrency ?? 'USD',
        defaultLanguage: s.defaultLanguage ?? 'en',
        commissionPercent: String(s.commissionPercent ?? 0),
        trialLessonEnabled: !!s.trialLessonEnabled,
        trialCommissionPercent: String(s.trialCommissionPercent ?? 0),
        payoutMin: String((s.payoutMinCents ?? 0) / 100),
        minCancelNoticeHours: String(s.minCancelNoticeHours ?? 0),
        bookingNoticeHours: String(s.bookingNoticeHours ?? 0),
        bookingHorizonDays: String(s.bookingHorizonDays ?? 0),
        slotDurationMin: String(s.slotDurationMin ?? 60),
        maintenanceMode: !!s.maintenanceMode,
        allowRegistrations: !!s.allowRegistrations,
        fxRows: Object.entries(s.fxRates ?? {}).map(([key, value]) => ({ key, value: String(value) })),
        paymentProviders: { ...(s.paymentProviders ?? {}) },
    };
}
function SettingsTab({ active }: {
    active: boolean;
}) {
    const { toast } = useToast();
    const [form, setForm] = useState<SettingsFormState | null>(null);
    const [saving, setSaving] = useState(false);
    const fetcher = useMemo(() => (active ? () => api<AdminSettingsData>('/api/admin/settings') : null), [active]);
    const { data, loading, error, refresh } = useResource<AdminSettingsData>(fetcher);
    useEffect(() => {
        if (data && !form)
            setForm(settingsToForm(data.settings));
    }, [data, form]);
    function set<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
        setForm((f) => (f ? { ...f, [key]: value } : f));
    }
    function setFxRow(idx: number, field: keyof FxRow, value: string) {
        setForm((f) => f ? { ...f, fxRows: f.fxRows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) } : f);
    }
    async function toggleProvider(name: string, enabled: boolean) {
        if (!form)
            return;
        const prev = form.paymentProviders;
        const next = { ...prev, [name]: enabled };
        setForm({ ...form, paymentProviders: next });
        try {
            await api('/api/admin/settings', { method: 'PUT', json: { paymentProviders: next } });
            toast({ title: `${titleCase(name)} ${enabled ? 'enabled' : 'disabled'}` });
        }
        catch (e) {
            setForm((f) => (f ? { ...f, paymentProviders: prev } : f));
            toast({ title: 'Could not update provider', description: errMsg(e), variant: 'destructive' });
        }
    }
    async function save() {
        if (!form)
            return;
        setSaving(true);
        try {
            await api('/api/admin/settings', {
                method: 'PUT',
                json: {
                    platformName: form.platformName.trim(),
                    tagline: form.tagline.trim(),
                    heroTitle: form.heroTitle.trim(),
                    heroSubtitle: form.heroSubtitle.trim(),
                    contactEmail: form.contactEmail.trim(),
                    commissionPercent: Number(form.commissionPercent) || 0,
                    trialLessonEnabled: form.trialLessonEnabled,
                    trialCommissionPercent: Number(form.trialCommissionPercent) || 0,
                    payoutMinCents: Math.round((parseFloat(form.payoutMin) || 0) * 100),
                    minCancelNoticeHours: Number(form.minCancelNoticeHours) || 0,
                    bookingNoticeHours: Number(form.bookingNoticeHours) || 0,
                    bookingHorizonDays: Number(form.bookingHorizonDays) || 0,
                    slotDurationMin: Number(form.slotDurationMin) || 0,
                    maintenanceMode: form.maintenanceMode,
                    allowRegistrations: form.allowRegistrations,
                    fxRates: Object.fromEntries(form.fxRows.filter((r) => r.key.trim()).map((r) => [r.key.trim().toUpperCase(), Number(r.value) || 0])),
                    paymentProviders: form.paymentProviders,
                },
            });
            toast({ title: 'Settings saved', description: 'Changes are live on the public site.' });
            refresh();
        }
        catch (e) {
            toast({ title: 'Could not save settings', description: errMsg(e), variant: 'destructive' });
        }
        finally {
            setSaving(false);
        }
    }
    if (error)
        return <LoadError message={error} onRetry={refresh}/>;
    if (!data || !form) {
        return loading ? <SkeletonTable rows={8}/> : null;
    }
    const integrations = data.integrations;
    return (<div className="space-y-4"><IdentitySettings /><BrandColourSettings /><LanguageTypographySettings onSaved={refresh}/>
      <SectionHeader title={uiText("Platform settings")} description={uiText("Identity, commission, booking policy and integrations.")} onRefresh={refresh}/>

      <Card>
        <CardHeader>
          <CardTitle>{uiText("Homepage copy")}</CardTitle>
          <CardDescription>{uiText("Default hero copy and active locale defaults")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">


          <div className="space-y-1.5">
            <Label htmlFor="s-hero">{uiText("Hero title")}</Label>
            <Input id="s-hero" value={form.heroTitle} onChange={(e) => set('heroTitle', e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-herosub">{uiText("Hero subtitle")}</Label>
            <Input id="s-herosub" value={form.heroSubtitle} onChange={(e) => set('heroSubtitle', e.target.value)}/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-currency">{uiText("Currency")}</Label>
              <Input id="s-currency" value={data.settings.defaultCurrency} readOnly aria-label={uiText("Default currency managed above")}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-lang">{uiText("Language")}</Label>
              <Input id="s-lang" value={data.settings.defaultLanguage} readOnly aria-label={uiText("Default language managed above")}/>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{uiText("Commission & money")}</CardTitle>
          <CardDescription>{uiText("Revenue share and payout thresholds")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-comm">{uiText("Commission percent")}</Label>
              <Input id="s-comm" type="number" min="0" max="100" step="0.5" value={form.commissionPercent} onChange={(e) => set('commissionPercent', e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-trialcomm">{uiText("Trial commission percent")}</Label>
              <Input id="s-trialcomm" type="number" min="0" max="100" step="0.5" value={form.trialCommissionPercent} onChange={(e) => set('trialCommissionPercent', e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-payoutmin">{uiText("Minimum payout (USD)")}</Label>
              <Input id="s-payoutmin" type="number" min="0" step="0.01" value={form.payoutMin} onChange={(e) => set('payoutMin', e.target.value)}/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="s-trial" checked={form.trialLessonEnabled} onCheckedChange={(v) => set('trialLessonEnabled', v)}/>
            <Label htmlFor="s-trial">{uiText("Trial lessons enabled")}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{uiText("Booking policy")}</CardTitle>
          <CardDescription>{uiText("Rules that govern scheduling")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-cancel">{uiText("Min cancel notice (hours)")}</Label>
            <Input id="s-cancel" type="number" min="0" value={form.minCancelNoticeHours} onChange={(e) => set('minCancelNoticeHours', e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-notice">{uiText("Booking notice (hours)")}</Label>
            <Input id="s-notice" type="number" min="0" value={form.bookingNoticeHours} onChange={(e) => set('bookingNoticeHours', e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-horizon">{uiText("Booking horizon (days)")}</Label>
            <Input id="s-horizon" type="number" min="1" value={form.bookingHorizonDays} onChange={(e) => set('bookingHorizonDays', e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-slot">{uiText("Slot duration (minutes)")}</Label>
            <Input id="s-slot" type="number" min="5" step="5" value={form.slotDurationMin} onChange={(e) => set('slotDurationMin', e.target.value)}/>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{uiText("Access & maintenance")}</CardTitle>
          <CardDescription>{uiText("Feature flags for the whole platform")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch id="s-reg" checked={form.allowRegistrations} onCheckedChange={(v) => set('allowRegistrations', v)}/>
            <Label htmlFor="s-reg">{uiText("Allow new registrations")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="s-maint" checked={form.maintenanceMode} onCheckedChange={(v) => set('maintenanceMode', v)}/>
            <Label htmlFor="s-maint">{uiText("Maintenance mode")}</Label>
          </div>
          {form.maintenanceMode ? uiText((<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{uiText("Maintenance mode is ON \u2014 the public site shows a maintenance screen to visitors.")}</p>)) : uiText(null)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{uiText("FX rates")}</CardTitle>
          <CardDescription>{uiText("Conversion multipliers from USD (1 USD = rate)")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {uiText(form.fxRows.map((row, idx) => (<div key={idx} className="flex items-center gap-2">
              <Input value={row.key} onChange={(e) => setFxRow(idx, 'key', e.target.value)} placeholder={uiText("EUR")} aria-label={uiText("Currency code")} className="w-24 font-mono uppercase"/>
              <Input value={row.value} onChange={(e) => setFxRow(idx, 'value', e.target.value)} type="number" step="any" min="0" placeholder="1.00" aria-label={uiText("Rate")} className="w-32 tabular-nums"/>
              <Button variant="ghost" size="icon" aria-label={uiText("Remove rate")} className="size-9 max-sm:size-11" onClick={() => set('fxRows', form.fxRows.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-red-600 dark:text-red-400" aria-hidden/>
              </Button>
            </div>)))}
          <Button variant="outline" size="sm" onClick={() => set('fxRows', [...form.fxRows, { key: '', value: '1' }])}>
            <Plus className="size-4" aria-hidden/>{uiText("Add rate")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{uiText("Integrations")}</CardTitle>
          <CardDescription>{uiText("Live status of external services (notes from the server)")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border p-3 transition-colors hover:bg-muted/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{uiText("Video classroom")}</span>
              <StatusBadge status={integrations.video.status}/>
              <Badge variant="outline" className={TONES.stone}>{uiText(integrations.video.provider)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{uiText(integrations.video.note)}</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <span className="text-sm font-medium">{uiText("Payment providers")}</span>
            {integrations.payments.map((p) => {
            const key = p.name.toLowerCase();
            const checked = form.paymentProviders[key] ?? p.enabled;
            return (<div key={p.name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/30">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{titleCase(p.name)}</span>
                      <StatusBadge status={checked ? 'ACTIVE' : 'HIDDEN'}/>
                    </div>
                    {p.requiredCredentials.length > 0 ? uiText((<div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground">{uiText("Required credentials:")}</span>
                        {uiText(p.requiredCredentials.map((cred) => (<Badge key={cred} variant="outline" className="font-mono text-[10px]">
                            {uiText(cred)}
                          </Badge>)))}
                      </div>)) : uiText((<p className="mt-1 text-xs text-muted-foreground">{uiText("No credentials required.")}</p>))}
                  </div>
                  <Switch checked={checked} onCheckedChange={(v) => void toggleProvider(key, v)} aria-label={uiText("{{value1}} {{value2}}", { value1: checked ? 'Disable' : 'Enable', value2: p.name })}/>
                </div>);
        })}
          </div>

          <Separator />

          <div className="rounded-xl border p-3 transition-colors hover:bg-muted/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{uiText("Email")}</span>
              {integrations.email.smtpConfigured ? uiText((<Badge variant="outline" className={TONES.teal}>{uiText("SMTP configured")}</Badge>)) : uiText((<Badge variant="outline" className={TONES.amber}>{uiText("SMTP not configured")}</Badge>))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{integrations.email.note}</p>
          </div>

          <div className="rounded-xl border p-3 transition-colors hover:bg-muted/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{uiText("Google OAuth")}</span>
              {integrations.oauth.google ? uiText((<Badge variant="outline" className={TONES.teal}>{uiText("enabled")}</Badge>)) : uiText((<Badge variant="outline" className={TONES.stone}>{uiText("disabled")}</Badge>))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{uiText(integrations.oauth.note)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="admin-settings-save">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden/> : uiText(null)}{uiText("Save changes")}</Button>
          <Button variant="outline" disabled={saving} onClick={() => setForm(settingsToForm(data.settings))}>{uiText("Reset")}</Button>
          <p className="text-xs text-muted-foreground">{uiText("Provider switches save immediately; everything else saves with the button above.")}</p>
        </CardContent>
      </Card>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Audit log tab                                                       */
/* ------------------------------------------------------------------ */
function AuditTab({ active }: {
    active: boolean;
}) {
    const fetcher = useMemo(() => (active ? () => api<{
        logs: AuditLogRow[];
    }>('/api/admin/audit') : null), [active]);
    const { data, error, refresh } = useResource<{
        logs: AuditLogRow[];
    }>(fetcher);
    const list = data?.logs ?? [];
    return (<div className="space-y-4">
      <SectionHeader title={uiText("Audit log")} description={uiText("Every administrative action, newest first.")} onRefresh={refresh}/>

      <DataTableShell>
        {error ? uiText((<LoadError message={error} onRetry={refresh}/>)) : !data ? uiText((<SkeletonTable rows={8}/>)) : list.length === 0 ? uiText((<EmptyState icon={ScrollText} label={uiText("No audit entries yet.")}/>)) : (<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{uiText("Time")}</TableHead>
                  <TableHead>{uiText("Actor")}</TableHead>
                  <TableHead>{uiText("Action")}</TableHead>
                  <TableHead>{uiText("Entity")}</TableHead>
                  <TableHead>{uiText("Meta")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((l) => {
                const full = (() => {
                    try {
                        return l.meta == null ? '' : typeof l.meta === 'string' ? l.meta : JSON.stringify(l.meta);
                    }
                    catch {
                        return '';
                    }
                })();
                return (<TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {uiText(new Date(l.createdAt).toLocaleString())}
                      </TableCell>
                      <TableCell>
                        {l.actor ? (<div>
                            <div className="text-sm">{l.actor.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.actor.email} · {uiText(titleCase(l.actor.role))}
                            </div>
                          </div>) : uiText((<span className="text-sm text-muted-foreground">{uiText("System")}</span>))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TONES.amber}>
                          {uiText(l.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {uiText(l.entity)}
                        {l.entityId ? <span className="ms-1 font-mono text-xs text-muted-foreground">#{uiText(l.entityId.slice(0, 8))}</span> : uiText(null)}
                      </TableCell>
                      <TableCell className="max-w-64">
                        <span className="line-clamp-2 font-mono text-xs text-muted-foreground" title={uiText(full)}>
                          {metaText(l.meta) || '—'}
                        </span>
                      </TableCell>
                    </TableRow>);
            })}
              </TableBody>
            </Table>)}
      </DataTableShell>
    </div>);
}
/* ------------------------------------------------------------------ */
/* Root AdminDashboard                                                 */
/* ------------------------------------------------------------------ */
const SECTIONS: {
    value: string;
    label: string;
    icon: LucideIcon;
}[] = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'applications', label: 'Applications', icon: ClipboardCheck },
    { value: 'users', label: 'Users', icon: Users },
    { value: 'notifications', label: 'Inbox', icon: Bell },
    { value: 'bookings', label: 'Bookings', icon: CalendarDays },
    { value: 'finance', label: 'Finance', icon: Wallet },
    { value: 'payouts', label: 'Payouts', icon: Banknote },
    { value: 'reviews', label: 'Reviews', icon: Star },
    { value: 'subjects', label: 'Subjects', icon: BookOpen },
    { value: 'coupons', label: 'Coupons & Packages', icon: Ticket },
    { value: 'games', label: 'Brain Games', icon: Gamepad2 },
    { value: 'cms', label: 'CMS', icon: FileText },
    { value: 'homepage', label: 'Homepage & welcome credit', icon: LayoutDashboard },
    { value: 'announcements', label: 'Notifications & events', icon: Bell },
    { value: 'settings', label: 'Settings', icon: SettingsIcon },
    { value: 'audit', label: 'Audit Log', icon: ScrollText },
];
export default function AdminDashboard({ onExit, initialTab }: {
    onExit: () => void;
    initialTab?: string;
}) {
    const user = useApp((state) => state.user);
    const logout = useApp((state) => state.logout);
    const platformName = useApp((state) => state.publicData?.settings.platformName) || 'TutorSphere';
    const language = useApp(state => state.language), t = useT(language);
    const route = useApp(state => state.view);
    const [accountId, setAccountId] = useState(route.params?.accountId || ''), [accountOrigin, setAccountOrigin] = useState(route.params?.origin || 'users');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [compactSidebar, setCompactSidebar] = useState(false);
    const [navigationSearch, setNavigationSearch] = useState('');
    const [tab, setTab] = useState(() => SECTIONS.some((section) => section.value === initialTab) ? initialTab! : 'overview');
    const [visited, setVisited] = useState<Set<string>>(() => new Set(['overview', ...(initialTab ? [initialTab] : [])]));
    // Stats fetched once at mount: powers overview cards + pending applications badge.
    const stats = useResource(useCallback(() => api<OverviewStats>('/api/admin/stats'), []));
    const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
    useEffect(() => {
        const load = () => api<{
            counts: Record<string, number>;
        }>('/api/admin/pending').then(d => setPendingCounts(d.counts)).catch(() => { });
        void load();
        const timer = setInterval(load, 15000);
        window.addEventListener('focus', load);
        window.addEventListener('notifications-updated', load);
        return () => { clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('notifications-updated', load); };
    }, []);
    const pendingApps = (pendingCounts.applications ?? stats.data?.cards.pendingApplications ?? 0) + (pendingCounts['profile-changes'] || 0);
    const navCount = (key: string) => key === 'applications' ? pendingApps : key === 'bookings' ? (pendingCounts.bookings || 0) + (pendingCounts['group-enrollments'] || 0) + (pendingCounts['package-purchases'] || 0) : pendingCounts[key] || 0;
    useEffect(() => {
        const value = initialTab || 'overview';
        setTab(value);
        setVisited(previous => new Set([...previous, value]));
        setAccountId(route.params?.accountId || '');
        setAccountOrigin(route.params?.origin || 'users');
    }, [initialTab, route.params?.accountId, route.params?.origin]);
    function activate(value: string) {
        useApp.getState().go('admin', { tab: value });
        setTab(value);
        setSidebarOpen(false);
        setNavigationSearch('');
        setVisited((prev) => {
            if (prev.has(value))
                return prev;
            const next = new Set(prev);
            next.add(value);
            return next;
        });
    }
    function openAccount(id: string) { const origin = tab === 'account-details' ? accountOrigin : tab === 'finance' ? 'finance' : 'users'; setAccountOrigin(origin); setAccountId(id); setSidebarOpen(false); useApp.getState().go('admin', { tab: 'account-details', accountId: id, origin }); }
    const isActive = useCallback((key: string) => visited.has(key), [visited]);
    return (<MotionConfig reducedMotion="user">
      <div className={cn('admin-console', compactSidebar && 'admin-console--compact')}>
        <MobileNavigation adminTab={tab} onAdminNavigate={activate}/>
        <Tabs value={tab} onValueChange={activate} orientation="vertical" className="admin-layout">
          {sidebarOpen && <button className="admin-backdrop" aria-label={uiText("Close navigation")} onClick={() => setSidebarOpen(false)}/>}
          <aside id="admin-navigation" className={cn('admin-sidebar', sidebarOpen && 'admin-sidebar--open')} aria-label={uiText("Admin navigation")}>
            <div className="admin-brand">
              <span className="admin-brand-mark"><PlatformLogo size={30}/></span>
              <div className="admin-brand-copy"><strong>{platformName}</strong><span>{uiText("ADMIN WORKSPACE")}</span></div>
              <button className="admin-mobile-close" aria-label={uiText("Close navigation")} onClick={() => setSidebarOpen(false)}><X size={20}/></button>
            </div>
            <div className="admin-workspace-label"><span className="admin-workspace-dot"/><span>{uiText("Platform management")}</span><ShieldCheck size={14}/></div>
            <TabsList className="admin-nav" aria-label={uiText("Administration sections")}>
              {uiText([
            { label: 'WORKSPACE', keys: ['overview', 'applications', 'users', 'bookings', 'notifications'] },
            { label: 'BUSINESS', keys: ['finance', 'payouts', 'coupons'] },
            { label: 'PLATFORM', keys: ['reviews', 'subjects', 'homepage', 'announcements', 'games', 'cms', 'settings', 'audit'] },
        ].map((group) => (<div className="admin-nav-group" key={group.label}>
                  <p className="admin-nav-label">{uiText(group.label)}</p>
                  {uiText(group.keys.map((key) => {
                const section = SECTIONS.find((item) => item.value === key)!;
                return <TabsTrigger key={key} value={key} className="admin-nav-item" title={uiText(section.label)} aria-label={uiText(section.label)}>
                      <section.icon size={18} aria-hidden/><span className="admin-nav-text">{t('admin.' + section.value)}</span>
                      {navCount(key) > 0 && <span className="admin-nav-count" aria-label={uiText("{{value1}} pending", { value1: navCount(key) })}>{navCount(key) > 99 ? '99+' : uiText(navCount(key))}</span>}
                    </TabsTrigger>;
            }))}
                </div>)))}
            </TabsList>
            <div className="admin-sidebar-bottom">
              <button onClick={onExit} className="admin-site-link"><ArrowUpRight size={18}/><span>{uiText("View live website")}</span><ArrowUpRight size={14}/></button>
              <div className="admin-profile"><span className="admin-avatar">{user?.name.split(' ').map((part) => part[0]).slice(0, 2).join('') || uiText("AD")}</span><div><strong>{user?.name || uiText("Administrator")}</strong><span>{user?.role === 'SUPPORT' ? uiText("Support team") : uiText("Administrator")}</span></div><button onClick={() => void logout()} aria-label={uiText("Sign out")} title={uiText("Sign out")}><LogOut size={17}/></button></div>
            </div>
          </aside>
          <div className="admin-main">
            <header className="admin-toolbar">
              <div className="admin-toolbar-start">
                <button className="admin-mobile-menu admin-icon-button" aria-label={uiText("Open navigation")} aria-controls="admin-navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu size={20}/></button>
                <button className="admin-collapse admin-icon-button" aria-label={compactSidebar ? uiText("Expand sidebar") : uiText("Collapse sidebar")} aria-controls="admin-navigation" aria-expanded={!compactSidebar} onClick={() => setCompactSidebar(!compactSidebar)}><PanelLeftClose size={19}/></button>
                <span className="admin-breadcrumb">{uiText("Workspace ")}<ChevronRight size={14}/><strong>{tab === 'account-details' ? uiText("Account details") : uiText(SECTIONS.find((section) => section.value === tab)?.label)}</strong></span>
              </div>
              <div className="admin-toolbar-actions">
                <div className="admin-navigation-search"><Search size={16} aria-hidden/><input aria-label={uiText("Find an admin section")} placeholder={uiText("Find a section...")} value={navigationSearch} onChange={(event) => setNavigationSearch(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Escape')
                setNavigationSearch('');
        }}/>
                  {navigationSearch.trim() && <div className="admin-search-results">{uiText(SECTIONS.filter((section) => section.label.toLowerCase().includes(navigationSearch.trim().toLowerCase())).map((section) => <button key={section.value} onClick={() => activate(section.value)}><section.icon size={16}/>{uiText(section.label)}<ChevronRight size={14}/></button>))}{!SECTIONS.some((section) => section.label.toLowerCase().includes(navigationSearch.trim().toLowerCase())) && <p>{uiText("No matching sections")}</p>}</div>}
                </div>
                <DashboardNotificationBell onOpenInbox={() => activate('notifications')}/><ThemeToggle />
                <span className="admin-toolbar-divider"/>
                <span className="admin-access"><ShieldCheck size={15}/>{user?.role === 'SUPPORT' ? uiText("Support access") : uiText("Admin access")}</span>
              </div>
            </header>
            <div className="admin-content" id="admin-content">
            <TabsContent value="overview" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'overview'}>
                <OverviewTab stats={stats.data} loading={stats.loading} error={stats.error} refresh={stats.refresh} onNavigate={activate}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="applications" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'applications'}>
                <ApplicationsTab active={isActive('applications')} onStatsChanged={stats.refresh}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="users" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'users'}>
                <UsersTab active={isActive('users')} onStatsChanged={stats.refresh} onOpenDetails={openAccount}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="bookings" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'bookings'}>
                <BookingsTab active={isActive('bookings')}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="finance" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'finance'}>
                {isActive('finance') && <FinanceWorkspace onOpenAccount={openAccount}/>}
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="notifications" className="mt-0"><NotificationsPanel /></TabsContent>
            <TabsContent value="account-details" className="mt-0">{tab === 'account-details' && accountId && <UserAccountDetails key={accountId} userId={accountId} onBack={() => activate(accountOrigin)} onOpenAccount={openAccount} backLabel={accountOrigin === 'finance' ? 'Finance' : 'Users'}/>}</TabsContent>
            <TabsContent value="payouts" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'payouts'}>
                <PayoutsTab active={isActive('payouts')} onStatsChanged={stats.refresh}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="reviews" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'reviews'}>
                {isActive('reviews') && <ReviewEditor />}
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="subjects" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'subjects'}>
                {isActive('subjects') && <CatalogManager />}
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="coupons" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'coupons'}>
                {isActive('coupons') && <PromotionsManager />}
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="cms" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'cms'}>
                <CmsTab active={isActive('cms')}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="homepage" forceMount className="data-[state=inactive]:hidden">{isActive('homepage') && <HomepageManager />}</TabsContent>
            <TabsContent value="announcements" forceMount className="data-[state=inactive]:hidden">{isActive('announcements') && <AnnouncementsManager />}</TabsContent>
            <TabsContent value="settings" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'settings'}>
                <SettingsTab active={isActive('settings')}/>
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="games" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'games'}>
                <GameDetailsEditor /><GameAdminSection />
              </ModuleTransition>
            </TabsContent>
            <TabsContent value="audit" forceMount className="data-[state=inactive]:hidden">
              <ModuleTransition active={tab === 'audit'}>
                <AuditTab active={isActive('audit')}/>
              </ModuleTransition>
            </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </MotionConfig>);
}
