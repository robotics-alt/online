'use client';
import { uiText } from "@/lib/ui-text";
import { useT } from '@/lib/i18n';
import PlatformLogo from './PlatformLogo';
import NotificationsPanel from './NotificationsPanel';
import { Bell } from 'lucide-react';
import DashboardNotificationBell from './DashboardNotificationBell';
import TeacherAccount from './TeacherAccount';
import { TeacherHomework } from './HomeworkWorkspace';
import TeacherProfileForm from './TeacherProfileForm';
import { TeacherGroupClasses } from './GroupClasses';
import { useCallback, useEffect, useState } from 'react';
import { useApp, api, COUNTRY_OPTIONS } from '@/lib/store';
import { TutorAvatar, Stars } from './TutorCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { LayoutDashboard, CalendarDays, Users, Wallet, FileText, UserCog, Video, Loader2, ArrowLeft, ArrowUpRight, ChevronRight, Clock, History, Settings2, LogOut, Menu, MessageCircle, X, Plus, Trash2, Star, Send, GraduationCap, Eye, TrendingUp, Banknote, Moon, } from 'lucide-react';
import { formatInTz } from '@/lib/tz';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { useLessonClock } from '@/hooks/use-lesson-clock';
import { canJoinLesson } from '@/lib/lesson-access';
import MobileNavigation from './MobileNavigation';
import TutorRevenueChart from './TutorRevenueChart';
import TutorMonthlyCalendar from './TutorMonthlyCalendar';
import TeacherStudentPanel from './TeacherStudentPanel';
import MessagesView from './MessagesView';
import { callStudent } from '@/lib/call-client';
import './teacher-calendar.css';
import ThemeToggle from './ThemeToggle';
import './learning-workspace.css';
const WD_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
interface Booking {
    lessonFormat?: string;
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isTrial: boolean;
    priceCents: number;
    student: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
    subject: {
        name: string;
    } | null;
}
interface Rule {
    id?: string;
    weekday: number;
    startMin: number;
    endMin: number;
}
interface Exception {
    id: string;
    date: string;
    allDay: boolean;
    startMin: number | null;
    endMin: number | null;
    reason: string;
}
interface Profile {
    onlineEnabled: boolean;
    faceToFaceEnabled: boolean;
    id: string;
    headline: string;
    about: string;
    experience: string;
    education: string;
    certifications: string;
    methodology: string;
    languages: string;
    nativeLanguage: string | null;
    yearsExperience: number;
    hourlyRateCents: number;
    trialRateCents: number;
    status: string;
    rejectionReason: string | null;
    videoUrl: string | null;
    vacationMode: boolean;
    subjects: {
        subject: {
            id: string;
            name: string;
        };
    }[];
    verifications: {
        id: string;
        type: string;
        label: string;
        status: string;
    }[];
    user: {
        name: string;
        country: string | null;
        timezone: string;
    };
}
interface StudentRow {
    student: {
        id: string;
        name: string;
        avatarUrl: string | null;
        country: string | null;
    };
    completed: number;
    lessons: number;
    lastLesson: string | null;
    nextLesson: string | null;
    subjects: string[];
    goals: {
        id: string;
        title: string;
        status: string;
    }[];
    assignments: {
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        submissions: number;
    }[];
}
export default function TutorDashboard({ initialTab }: {
    initialTab?: string;
}) {
    const localTimezone = useDeviceTimezone();
    const now = useLessonClock();
    const [navigationOpen, setNavigationOpen] = useState(false);
    const [studentPanel, setStudentPanel] = useState<{
        student: {
            id: string;
            name: string;
            avatarUrl: string | null;
        };
        tab: 'history' | 'messages';
    } | null>(null);
    const [vacationFrom, setVacationFrom] = useState('');
    const [vacationTo, setVacationTo] = useState('');
    const [schedulingVacation, setSchedulingVacation] = useState(false);
    const { user, go, back, view, fmt, refreshMe, publicData } = useApp();
    const language = useApp(state => state.language), t = useT(language);
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const tab = initialTab ?? 'overview';
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [stats, setStats] = useState<{
        overview: Record<string, number>;
        monthly: {
            month: string;
            netCents: number;
            lessons: number;
        }[];
        upcoming: Booking[];
    } | null>(null);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [payouts, setPayouts] = useState<{
        id: string;
        amountCents: number;
        status: string;
        method: string;
        createdAt: string;
    }[]>([]);
    const [assignments, setAssignments] = useState<{
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        student: {
            name: string;
        };
        submissions: {
            id: string;
            content: string;
            status: string;
            feedback: string | null;
            student: {
                name: string;
            };
        }[];
    }[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [rules, setRules] = useState<Rule[]>([]);
    const [exceptions, setExceptions] = useState<Exception[]>([]);
    const [subjects, setSubjects] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [newAssignment, setNewAssignment] = useState({ studentId: '', title: '', description: '' });
    const [assignOpen, setAssignOpen] = useState(false);
    const [gradeFor, setGradeFor] = useState<{
        submissionId: string;
        studentName: string;
    } | null>(null);
    const [gradeText, setGradeText] = useState('');
    const [newExcDate, setNewExcDate] = useState('');
    const loadAll = useCallback(async () => {
        try {
            const [b, s, st, p, a, pr, av, subj] = await Promise.all([
                api<{
                    bookings: Booking[];
                }>('/api/bookings'),
                api<typeof stats>('/api/tutor/stats'),
                api<{
                    students: StudentRow[];
                }>('/api/tutor/students'),
                api<{
                    payouts: typeof payouts;
                    balanceCents: number;
                }>('/api/tutor/payouts'),
                api<{
                    assignments: typeof assignments;
                }>('/api/tutor/assignments'),
                api<{
                    profile: Profile;
                }>('/api/tutor/profile'),
                api<{
                    rules: Rule[];
                    exceptions: Exception[];
                }>('/api/tutor/availability'),
                api<{
                    subjects: {
                        id: string;
                        name: string;
                    }[];
                }>('/api/subjects'),
            ]);
            setBookings(b.bookings);
            setStats(s);
            setStudents(st.students);
            setPayouts(p.payouts);
            setAssignments(a.assignments);
            setProfile(pr.profile);
            setRules(av.rules.map((r) => ({ weekday: r.weekday, startMin: r.startMin, endMin: r.endMin })));
            setExceptions(av.exceptions);
            setSubjects(subj.subjects);
        }
        catch (err) {
            toast({ title: 'Could not load dashboard', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (user?.role === 'TUTOR')
            void loadAll();
    }, [user?.role, loadAll]);
    if (!user) {
        return <CenterMsg text="Log in to see your tutor dashboard" cta="Log in" onClick={() => go('auth', { mode: 'login' })}/>;
    }
    if (user.role !== 'TUTOR') {
        return <CenterMsg text="This is the tutor dashboard" cta="Become a tutor" onClick={() => go('onboarding-tutor')}/>;
    }
    const canJoin = (b: Booking) => canJoinLesson(b, now);
    const completeLesson = async (b: Booking) => {
        try {
            const res = await api<{
                tutorNetCents: number;
            }>(`/api/bookings/${b.id}/complete`, { method: 'POST' });
            toast({ title: 'Lesson completed', description: `You earned ${fmt(res.tutorNetCents)} (net).` });
            void loadAll();
            void refreshMe();
        }
        catch (err) {
            toast({ title: 'Could not complete lesson', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const requestPayout = async () => {
        try {
            await api('/api/tutor/payouts', { method: 'POST', json: { amount: payoutAmount } });
            toast({ title: 'Withdrawal requested', description: 'An administrator will process it shortly.' });
            setPayoutAmount('');
            void loadAll();
            void refreshMe();
        }
        catch (err) {
            toast({ title: 'Could not request payout', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const saveRules = async () => {
        try {
            await api('/api/tutor/availability', { method: 'PUT', json: { rules } });
            toast({ title: 'Availability saved' });
        }
        catch (err) {
            toast({ title: 'Could not save availability', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const toggleVacation = async (v: boolean) => {
        try {
            await api('/api/tutor/availability', { method: 'PUT', json: { vacationMode: v } });
            setProfile((p) => p ? { ...p, vacationMode: v } : p);
            toast({ title: v ? 'Vacation mode on — students cannot book' : 'Vacation mode off' });
        }
        catch {
            toast({ title: 'Could not update', variant: 'destructive' });
        }
    };
    const addException = async () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newExcDate)) {
            toast({ title: 'Pick a date first', variant: 'destructive' });
            return;
        }
        try {
            await api('/api/tutor/availability', { method: 'PUT', json: { addException: { date: newExcDate, allDay: true, reason: 'Blocked day' } } });
            setNewExcDate('');
            const av = await api<{
                rules: Rule[];
                exceptions: Exception[];
            }>('/api/tutor/availability');
            setExceptions(av.exceptions);
            toast({ title: 'Day blocked' });
        }
        catch {
            toast({ title: 'Could not block day', variant: 'destructive' });
        }
    };
    const removeException = async (id: string) => {
        try {
            await api('/api/tutor/availability', { method: 'PUT', json: { removeExceptionId: id } });
            setExceptions((ex) => ex.filter((e) => e.id !== id));
        }
        catch { /* noop */ }
    };
    const createAssignment = async () => {
        try {
            await api('/api/tutor/assignments', { method: 'POST', json: newAssignment });
            toast({ title: 'Homework assigned' });
            setAssignOpen(false);
            setNewAssignment({ studentId: '', title: '', description: '' });
            void loadAll();
        }
        catch (err) {
            toast({ title: 'Could not assign', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const gradeSubmission = async () => {
        if (!gradeFor)
            return;
        try {
            await api('/api/tutor/assignments', { method: 'POST', json: { action: 'grade', submissionId: gradeFor.submissionId, feedback: gradeText } });
            toast({ title: 'Feedback sent' });
            setGradeFor(null);
            setGradeText('');
            void loadAll();
        }
        catch (err) {
            toast({ title: 'Could not grade', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const ringStudent = async (bookingId: string) => {
        try {
            await callStudent(bookingId);
        }
        catch (err) {
            toast({ title: 'Could not start call', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const scheduleVacation = async () => {
        setSchedulingVacation(true);
        try {
            await api('/api/tutor/availability', { method: 'PUT', json: { vacationRange: { from: vacationFrom, to: vacationTo } } });
            const updated = await api<{
                exceptions: Exception[];
            }>('/api/tutor/availability');
            setExceptions(updated.exceptions);
            setVacationFrom('');
            setVacationTo('');
            toast({ title: 'Vacation scheduled', description: 'New bookings are blocked on those dates. Existing lessons remain scheduled.' });
        }
        catch (err) {
            toast({ title: 'Could not schedule vacation', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setSchedulingVacation(false);
        }
    };
    if (loading)
        return <div className="flex items-center justify-center py-32 text-muted-foreground/70"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Loading dashboard\u2026")}</div>;
    const o = stats?.overview ?? {};
    const upcoming = bookings.filter((b) => ['CONFIRMED', 'RESCHEDULED'].includes(b.status) && new Date(b.endUtc) > new Date());
    const awaiting = bookings.filter((b) => ['CONFIRMED', 'RESCHEDULED'].includes(b.status) && new Date(b.endUtc) <= new Date());
    return (<div className="teacher-workspace">
      <MobileNavigation />
      {studentPanel && <TeacherStudentPanel key={studentPanel.student.id + studentPanel.tab} student={studentPanel.student} initialTab={studentPanel.tab} onClose={() => setStudentPanel(null)}/>}
      <Tabs value={tab} onValueChange={(value) => { setNavigationOpen(false); go('tutor-dash', { tab: value }); }} className="teacher-layout" orientation="vertical">
        {navigationOpen && <button className="teacher-backdrop" aria-label={uiText("Close navigation")} onClick={() => setNavigationOpen(false)}/>}
        <aside className={navigationOpen ? 'teacher-sidebar is-open' : 'teacher-sidebar'}>
          <div className="teacher-brand"><span><PlatformLogo size={30}/></span><div><strong>{publicData?.settings.platformName || uiText("TutorSphere")}</strong><small>{uiText("TEACHING STUDIO")}</small></div><button className="teacher-close-menu" onClick={() => setNavigationOpen(false)} aria-label={uiText("Close navigation")}><X size={19}/></button></div>
          <div className="teacher-workspace-label"><span />{uiText("Your teaching workspace")}</div>
          <p className="teacher-nav-label">{uiText("WORKSPACE")}</p>
          <TabsList className="teacher-nav" aria-label={uiText("Teaching sections")}>
            {uiText([{ value: 'overview', label: 'Overview', icon: LayoutDashboard }, { value: 'calendar', label: 'My calendar', icon: CalendarDays }, { value: 'schedule-settings', label: 'Availability & time off', icon: Settings2 }, { value: 'students', label: 'My students', icon: Users }, { value: 'messages', label: 'Messages', icon: MessageCircle }, { value: 'notifications', label: 'Notifications & events', icon: Bell }, { value: 'earnings', label: 'Earnings', icon: Wallet }, { value: 'classes', label: 'Group classes', icon: Users }, { value: 'assignments', label: 'Homework', icon: FileText }, { value: 'profile', label: 'My account', icon: UserCog }].map((item) => <TabsTrigger value={item.value} key={item.value} className="teacher-nav-item" data-section={item.value}><item.icon size={18}/><span>{t('teacher.' + item.value)}</span>{item.value === 'students' && <small>{uiText(students.length)}</small>}</TabsTrigger>))}
          </TabsList>
          <div className="teacher-sidebar-support"><Video size={20}/><strong>{uiText("Your next great lesson")}</strong><p>{uiText("Manage your schedule and meet your students in the classroom.")}</p><button onClick={() => { setNavigationOpen(false); go('tutor-dash', { tab: 'calendar' }); }}>{uiText("Open calendar")}<ChevronRight size={15}/></button></div>
          <div className="teacher-sidebar-bottom"><button onClick={() => go('landing')}><ArrowUpRight size={17}/>{uiText("View website")}</button><div><TutorAvatar name={user.name} url={user.avatarUrl} className="size-9"/><span><strong>{user.name}</strong><small>{uiText("Teacher account")}</small></span><button onClick={() => void useApp.getState().logout()} aria-label={uiText("Sign out")}><LogOut size={17}/></button></div></div>
        </aside>
        <div className="teacher-main">
          <header className="teacher-toolbar"><div><button className="teacher-open-menu" aria-label={uiText("Open teaching navigation")} onClick={() => setNavigationOpen(true)}><Menu size={21}/></button><span>{uiText("Teaching studio")}<ChevronRight size={14}/><strong>{uiText(({ overview: 'Overview', calendar: 'My calendar', 'schedule-settings': 'Calendar settings', messages: 'Messages', students: 'My students', earnings: 'Earnings', assignments: 'Homework', profile: 'My account' } as Record<string, string>)[tab])}</strong></span></div><div><span className="teacher-timezone"><Clock size={14}/>{uiText(localTimezone.replaceAll('_', ' '))}</span><DashboardNotificationBell onOpenInbox={() => go('tutor-dash', { tab: 'notifications' })}/><ThemeToggle /><Button variant="ghost" size="icon" aria-label={uiText("Messages")} onClick={() => go('tutor-dash', { tab: 'messages' })}><MessageCircle size={19}/></Button></div></header>
          <div className="teacher-content">
            {tab !== 'profile' && <div className="teacher-page-heading"><div className="teacher-section-title">{tab === 'schedule-settings' && view.params?.from === 'account' && <Button variant="ghost" size="icon" aria-label={uiText("Back to my account")} onClick={() => window.history.state?.tsDepth > 0 ? back() : go('tutor-dash', { tab: 'profile' })}><ArrowLeft size={22}/></Button>}<h1>{tab === 'overview' ? uiText("Welcome back, {{value1}}.", { value1: user.name.split(' ')[0] }) : uiText(({ calendar: 'My calendar', 'schedule-settings': 'Availability & time off', notifications: 'Notifications & events', messages: 'Messages', students: 'My students', earnings: 'Earnings', assignments: 'Homework', classes: 'Group classes' } as Record<string, string>)[tab])}</h1></div></div>}

        {['calendar', 'schedule-settings'].includes(tab) && <p className="teacher-mobile-timezone"><Clock size={13}/>{uiText("Local time: ")}{uiText(localTimezone.replaceAll('_', ' '))}<span>{uiText("Auto")}</span></p>}
        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="teacher-stat-grid grid gap-4 grid-cols-2 md:grid-cols-4">
            <Stat icon={Banknote} label={uiText("Total earnings (net)")} value={fmt(o.netCents ?? 0)}/>
            <Stat icon={Users} label={uiText("Students taught")} value={String(o.totalStudents ?? 0)}/>
            <Stat icon={Star} label={uiText("Average rating")} value={o.averageRating != null ? `${o.averageRating} ★` : 'New'} sub={`${o.reviewCount ?? 0} reviews`}/>
            <Stat icon={Video} label={uiText("Lessons completed")} value={String(o.completedLessons ?? 0)} sub={`${o.upcomingLessons ?? 0} upcoming`}/>
          </div>

          <div className="teacher-overview-focus">
            <section className="teacher-next-session"><div><span className="teacher-session-icon"><Video size={22}/></span><span>{uiText("YOUR NEXT SESSION")}</span>{upcoming[0]?.isTrial && <small>{uiText("TRIAL LESSON")}</small>}</div>{upcoming[0] ? <><h2>{upcoming[0].student.name}</h2><p>{upcoming[0].subject?.name || uiText("Private lesson")} · {uiText(formatInTz(new Date(upcoming[0].startUtc), localTimezone))}</p><Button onClick={() => upcoming[0].lessonFormat === 'FACE_TO_FACE' ? go('tutor-dash', { tab: 'calendar' }) : void ringStudent(upcoming[0].id)}>{upcoming[0].lessonFormat === 'FACE_TO_FACE' ? uiText("Face-to-face appointment") : uiText("Call student")}<ChevronRight size={16}/></Button><small>{upcoming[0].lessonFormat === 'FACE_TO_FACE' ? uiText("Arrangements coordinated by admin") : uiText("Video, chat, whiteboard & screen sharing")}</small></> : <><h2>{uiText("Ready for your next student.")}</h2><p>{uiText("Set your availability so students can find their next lesson with you.")}</p><Button onClick={() => go('tutor-dash', { tab: 'calendar' })}>{uiText("Open your calendar")}<ChevronRight size={16}/></Button></>}</section>
            <TutorRevenueChart monthly={stats?.monthly || []}/>
          </div>
          {awaiting.length > 0 && (<Card className="rounded-2xl border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2"><CardTitle className="text-base text-amber-800">{uiText("Lessons to complete (past their start time)")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {awaiting.map((b) => (<div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-card p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{b.subject?.name ?? uiText("Lesson")} · {b.student.name}</p>
                      <p className="text-xs text-muted-foreground">{uiText(formatInTz(new Date(b.startUtc), localTimezone))} · {uiText(fmt(b.priceCents))}</p>
                    </div>
                    <div className="flex gap-2">
                      {canJoin(b) && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => void ringStudent(b.id)}><Video className="mr-1 h-3.5 w-3.5"/>{uiText(" Join")}</Button>}
                      <Button size="sm" variant="outline" onClick={() => completeLesson(b)}>{uiText("Mark completed")}</Button>
                    </div>
                  </div>))}
              </CardContent>
            </Card>)}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Upcoming lessons")}</CardTitle></CardHeader>
              <CardContent>
                {upcoming.length === 0 ? <p className="text-sm text-muted-foreground/70">{uiText("No upcoming lessons. Keep your calendar open so students can book!")}</p> : (<div className="space-y-3">
                    {upcoming.slice(0, 6).map((b) => (<div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{b.subject?.name ?? uiText("Lesson")} · {b.student.name} {b.isTrial && <Badge className="ml-1 bg-amber-100 text-amber-800 border-0 text-[10px]">{uiText("TRIAL")}</Badge>}</p>
                          <p className="text-xs text-muted-foreground">{uiText(formatInTz(new Date(b.startUtc), localTimezone))}</p>
                        </div>
                        {canJoin(b) && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => void ringStudent(b.id)}>{uiText("Join")}</Button>}
                      </div>))}
                  </div>)}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Performance")}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label={uiText("Profile views")} value={String(o.profileViews ?? 0)}/>
                <Row label={uiText("Booking conversion")} value={o.conversionRate != null ? `${o.conversionRate}%` : '—'}/>
                <Row label={uiText("Attendance rate")} value={`${o.attendanceRate ?? 100}%`}/>
                <Row label={uiText("Student retention")} value={`${o.retentionRate ?? 0}%`}/>
                <Row label={uiText("Gross revenue")} value={fmt(o.grossCents ?? 0)}/>
                <Row label={uiText("Platform commission paid")} value={fmt(o.commissionCents ?? 0)}/>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar" className="mt-6"><TutorMonthlyCalendar onStudent={(student, panelTab) => setStudentPanel({ student, tab: panelTab })}/></TabsContent>
        <TabsContent value="notifications"><NotificationsPanel compact/></TabsContent>
        <TabsContent value="schedule-settings" className="mt-6 space-y-6">
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">{uiText("Weekly availability ")}<span className="text-xs font-normal text-muted-foreground/70">{uiText("Schedule timezone: ")}{user.timezone}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.length === 0 && <p className="text-sm text-amber-700">{uiText("You have no availability yet \u2014 students cannot book you. Add slots below.")}</p>}
              {uiText(rules.map((r, i) => (<div key={i} className="flex flex-wrap items-center gap-2">
                  <Select value={String(r.weekday)} onValueChange={(v) => setRules((rs) => rs.map((x, j) => j === i ? { ...x, weekday: Number(v) } : x))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{uiText(WD_NAMES.map((d, di) => <SelectItem key={di} value={String(di)}>{uiText(d)}</SelectItem>))}</SelectContent>
                  </Select>
                  <Input type="time" value={minToTime(r.startMin)} onChange={(e) => setRules((rs) => rs.map((x, j) => j === i ? { ...x, startMin: timeToMin(e.target.value) } : x))} className="w-32" aria-label={uiText("Start time")}/>
                  <span className="text-muted-foreground/70">–</span>
                  <Input type="time" value={minToTime(r.endMin)} onChange={(e) => setRules((rs) => rs.map((x, j) => j === i ? { ...x, endMin: timeToMin(e.target.value) } : x))} className="w-32" aria-label={uiText("End time")}/>
                  <Button variant="ghost" size="icon" aria-label={uiText("Remove slot")} onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-500"/></Button>
                </div>)))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRules((rs) => [...rs, { weekday: 1, startMin: 540, endMin: 1020 }])}><Plus className="mr-1 h-4 w-4"/>{uiText(" Add weekly slot")}</Button>
                <Button size="sm" onClick={saveRules} className="bg-teal-600 hover:bg-teal-700">{uiText("Save availability")}</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Moon className="h-4 w-4 text-teal-600"/>{uiText(" Vacation mode")}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{uiText("Pause new bookings while you are away. Existing lessons stay.")}</p>
                  <Switch checked={profile?.vacationMode ?? false} onCheckedChange={toggleVacation}/>
                </div>
                <div className="teacher-vacation-range"><div><Label htmlFor="vacation-from">{uiText("Vacation starts")}</Label><Input id="vacation-from" type="date" value={vacationFrom} onChange={(event) => setVacationFrom(event.target.value)}/></div><div><Label htmlFor="vacation-to">{uiText("Vacation ends")}</Label><Input id="vacation-to" type="date" min={vacationFrom} value={vacationTo} onChange={(event) => setVacationTo(event.target.value)}/></div></div>
                <Button variant="outline" onClick={() => void scheduleVacation()} disabled={schedulingVacation || !vacationFrom || !vacationTo}>{schedulingVacation ? uiText("Saving\u2026") : uiText("Schedule vacation")}</Button>
                <p className="text-xs text-muted-foreground">{uiText("Dates follow your teaching schedule timezone. Existing lessons are not cancelled.")}</p>
                <div className="teacher-vacation-dates">{uiText(exceptions.filter((exception) => exception.reason === 'Vacation').map((exception) => <Badge key={exception.id} variant="secondary">{uiText(exception.date)}<button onClick={() => removeException(exception.id)} aria-label={uiText("Remove vacation on {{value1}}", { value1: exception.date })}><Trash2 size={12}/></button></Badge>))}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Blocked days")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input type="date" value={newExcDate} onChange={(e) => setNewExcDate(e.target.value)} className="w-44" aria-label={uiText("Date to block")}/>
                  <Button variant="outline" size="sm" onClick={addException}>{uiText("Block day")}</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uiText(exceptions.filter((exception) => exception.reason !== 'Vacation').map((e) => (<Badge key={e.id} variant="secondary" className="gap-1 bg-muted border-0">
                      {uiText(e.date)} {e.reason && uiText("\u00B7 {{value1}}", { value1: e.reason })}
                      <button onClick={() => removeException(e.id)} aria-label={uiText("Remove blocked day")}><Trash2 className="h-3 w-3 text-red-500"/></button>
                    </Badge>)))}
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
        <TabsContent value="messages" className="mt-6"><MessagesView /></TabsContent>

        {/* STUDENTS */}
        <TabsContent value="students" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setAssignOpen(true)} className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1 h-4 w-4"/>{uiText(" Assign homework")}</Button>
          </div>
          {students.length === 0 ? <p className="text-sm text-muted-foreground/70">{uiText("No students yet.")}</p> : (<div className="grid gap-4 md:grid-cols-2">
              {students.map((s) => (<Card key={s.student.id} className="rounded-2xl border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <TutorAvatar name={s.student.name} url={s.student.avatarUrl} className="h-11 w-11"/>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{s.student.name}</p>
                        <p className="text-xs text-muted-foreground">{uiText(s.completed)}/{uiText(s.lessons)}{uiText(" completed")}{s.lastLesson ? uiText(" \u00B7 last {{value1}}", { value1: new Date(s.lastLesson).toLocaleDateString() }) : ''}</p>
                      </div>
                    </div>
                    {s.nextLesson && <p className="mt-2 text-xs font-medium text-teal-700">{uiText("Next lesson: ")}{uiText(formatInTz(new Date(s.nextLesson), localTimezone))}</p>}
                    {s.goals.length > 0 && uiText((<div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground">{uiText("GOALS")}</p>
                        {uiText(s.goals.map((g) => <p key={g.id} className="text-sm text-muted-foreground">• {uiText(g.title)} {g.status === 'ACHIEVED' && '✓'}</p>))}
                      </div>))}
                    {s.assignments.length > 0 && uiText((<div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground">{uiText("HOMEWORK")}</p>
                        {uiText(s.assignments.map((a) => <p key={a.id} className="text-sm text-muted-foreground">• {uiText(a.title)} <Badge variant="secondary" className="ml-1 text-[10px] border-0 bg-muted">{uiText(a.status)}</Badge></p>))}
                      </div>))}
                    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setStudentPanel({ student: s.student, tab: 'history' })}><History size={14}/>{uiText("Lesson history")}</Button><Button size="sm" variant="outline" onClick={() => setStudentPanel({ student: s.student, tab: 'messages' })}><Send size={14}/>{uiText("Message student")}</Button></div>
                  </CardContent>
                </Card>))}
            </div>)}
        </TabsContent>

        {/* EARNINGS */}
        <TabsContent value="earnings" className="mt-6 space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Stat icon={Wallet} label={uiText("Available balance")} value={fmt(user.walletCents)}/>
            <Stat icon={TrendingUp} label={uiText("Gross revenue")} value={fmt(o.grossCents ?? 0)}/>
            <Stat icon={Banknote} label={uiText("Commission paid")} value={fmt(o.commissionCents ?? 0)}/>
            <Stat icon={Eye} label={uiText("Net earnings")} value={fmt(o.netCents ?? 0)}/>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Monthly net earnings")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {uiText((stats?.monthly ?? []).map((m) => (<div key={m.month} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{uiText(m.month)}</span>
                      <span className="font-medium text-foreground">{uiText(fmt(m.netCents))} <span className="text-xs text-muted-foreground/70">({uiText(m.lessons)}{uiText(" lessons)")}</span></span>
                    </div>)))}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Withdraw funds")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{uiText("Minimum withdrawal ")}{uiText(fmt(2000))}{uiText(". Requests are approved by administrators and paid to your payout account.")}</p>
                <div className="flex gap-2">
                  <Input type="number" min={20} step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder={uiText("Amount in USD")} aria-label={uiText("Withdrawal amount")}/>
                  <Button onClick={requestPayout} disabled={!payoutAmount || Number(payoutAmount) <= 0} className="bg-teal-600 hover:bg-teal-700 shrink-0">{uiText("Request")}</Button>
                </div>
                <div className="mt-2">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">{uiText("HISTORY")}</p>
                  {payouts.length === 0 ? <p className="text-sm text-muted-foreground/70">{uiText("No withdrawals yet.")}</p> : uiText((<div className="space-y-2">
                      {uiText(payouts.map((p) => (<div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{uiText(new Date(p.createdAt).toLocaleDateString())} · {uiText(p.method)}</span>
                          <span className="flex items-center gap-2">
                            <strong>{uiText(fmt(p.amountCents))}</strong>
                            <Badge variant="secondary" className={`border-0 ${p.status === 'PAID' ? 'bg-teal-100 text-teal-800' : p.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{uiText(p.status)}</Badge>
                          </span>
                        </div>)))}
                    </div>))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignments" className="mt-6"><TeacherHomework /></TabsContent>

        {/* PROFILE */}
        <TabsContent value="classes" className="mt-6"><TeacherGroupClasses /></TabsContent>
        <TabsContent value="profile" className="mt-6">
          {profile && <TeacherAccount onSaved={loadAll}/>}
        </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* New assignment dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{uiText("Assign homework")}</DialogTitle><DialogDescription>{uiText("Students are notified instantly.")}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{uiText("Student")}</Label>
              <Select value={newAssignment.studentId} onValueChange={(v) => setNewAssignment((s) => ({ ...s, studentId: v }))}>
                <SelectTrigger><SelectValue placeholder={uiText("Select student")}/></SelectTrigger>
                <SelectContent>{students.map((s) => <SelectItem key={s.student.id} value={s.student.id}>{s.student.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{uiText("Title")}</Label><Input value={newAssignment.title} onChange={(e) => setNewAssignment((s) => ({ ...s, title: e.target.value }))} placeholder={uiText("Essay: My weekend")}/></div>
            <div className="space-y-1.5"><Label>{uiText("Instructions")}</Label><Textarea rows={3} value={newAssignment.description} onChange={(e) => setNewAssignment((s) => ({ ...s, description: e.target.value }))}/></div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={createAssignment} disabled={!newAssignment.studentId || !newAssignment.title}>{uiText("Assign")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade dialog */}
      <Dialog open={!!gradeFor} onOpenChange={(o) => !o && setGradeFor(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{uiText("Grade ")}{uiText(gradeFor?.studentName)}{uiText("'s submission")}</DialogTitle></DialogHeader>
          <Textarea rows={4} value={gradeText} onChange={(e) => setGradeText(e.target.value)} placeholder={uiText("Your feedback\u2026")}/>
          <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={gradeSubmission} disabled={!gradeText.trim()}>{uiText("Send feedback")}</Button>
        </DialogContent>
      </Dialog>
    </div>);
}
function Row({ label, value }: {
    label: string;
    value: string;
}) {
    return <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0"><span className="text-muted-foreground">{uiText(label)}</span><strong className="text-foreground">{value}</strong></div>;
}
function Stat({ icon: Icon, label, value, sub }: {
    icon: React.ComponentType<{
        className?: string;
    }>;
    label: string;
    value: string;
    sub?: string;
}) {
    return (<Card className="rounded-2xl border-border"><CardContent className="p-5">
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{uiText(label)}</p><Icon className="h-4 w-4 text-teal-600"/></div>
      <p className="mt-1 text-xl font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground/70">{uiText(sub)}</p>}
    </CardContent></Card>);
}
function CenterMsg({ text, cta, onClick }: {
    text: string;
    cta: string;
    onClick: () => void;
}) {
    return (<div className="mx-auto max-w-md px-4 py-24 text-center">
      <GraduationCap className="mx-auto h-10 w-10 text-stone-300"/>
      <p className="mt-3 font-semibold text-foreground/90">{text}</p>
      <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={onClick}>{uiText(cta)}</Button>
    </div>);
}
function minToTime(min: number): string {
    const h = Math.floor(min / 60), m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function timeToMin(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}
function TutorProfileEditor({ profile, subjects, onSaved }: {
    profile: Profile;
    subjects: {
        id: string;
        name: string;
    }[];
    onSaved: () => void | Promise<void>;
}) {
    const { user, refreshMe } = useApp();
    const { toast } = useToast();
    const [form, setForm] = useState({
        headline: profile.headline, about: profile.about, experience: profile.experience,
        education: profile.education, certifications: profile.certifications, methodology: profile.methodology,
        languages: profile.languages, yearsExperience: profile.yearsExperience,
        hourlyRate: (profile.hourlyRateCents / 100).toString(), trialRate: (profile.trialRateCents / 100).toString(),
        onlineEnabled: profile.onlineEnabled ?? true, faceToFaceEnabled: profile.faceToFaceEnabled ?? false,
    });
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(profile.subjects.map((s) => s.subject.id));
    const [saving, setSaving] = useState(false);
    const save = async (submit = false) => {
        setSaving(true);
        try {
            await api('/api/tutor/profile', { method: 'PUT', json: {
                    ...form,
                    yearsExperience: Number(form.yearsExperience) || 0,
                    hourlyRate: Number(form.hourlyRate) || 20,
                    trialRate: Number(form.trialRate) || 5,
                    subjectIds: selectedSubjects,
                    action: submit ? 'submit' : 'save',
                    country: user?.country ?? undefined,
                } });
            await refreshMe();
            toast({ title: submit ? 'Application submitted! 🎉' : 'Profile saved' });
            await onSaved();
        }
        catch (err) {
            toast({ title: 'Could not save', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Professional information")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">{uiText("Lesson formats")}</legend><p className="text-xs text-muted-foreground">{uiText("Choose how students can book you. Full lessons appear in your calendar after admin payment approval.")}</p><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.onlineEnabled} onChange={(e) => setForm((f) => ({ ...f, onlineEnabled: e.target.checked }))}/>{uiText("Online video lessons")}</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.faceToFaceEnabled} onChange={(e) => setForm((f) => ({ ...f, faceToFaceEnabled: e.target.checked }))}/>{uiText("Face-to-face lessons")}</label><p className="text-xs text-muted-foreground">{uiText("Face-to-face contact details stay with administrators, who coordinate arrangements.")}</p></fieldset>
            <div className="space-y-1.5"><Label>{uiText("Headline")}</Label><Input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder={uiText("Certified English teacher \u2014 IELTS specialist")}/></div>
            <div className="space-y-1.5"><Label>{uiText("About you (min 80 chars)")}</Label><Textarea rows={4} value={form.about} onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{uiText("Years of experience")}</Label><Input type="number" min={0} value={form.yearsExperience} onChange={(e) => setForm((f) => ({ ...f, yearsExperience: Number(e.target.value) }))}/></div>
              <div className="space-y-1.5"><Label>{uiText("Languages you teach in")}</Label><Input value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} placeholder={uiText("English, Arabic")}/></div>
            </div>
            <div className="space-y-1.5"><Label>{uiText("Education")}</Label><Input value={form.education} onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}/></div>
            <div className="space-y-1.5"><Label>{uiText("Certifications")}</Label><Input value={form.certifications} onChange={(e) => setForm((f) => ({ ...f, certifications: e.target.value }))}/></div>
            <div className="space-y-1.5"><Label>{uiText("Teaching methodology")}</Label><Textarea rows={2} value={form.methodology} onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))}/></div>
            <div>
              <Label>{uiText("Subjects")}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {subjects.map((s) => {
            const active = selectedSubjects.includes(s.id);
            return (<button key={s.id} onClick={() => setSelectedSubjects((ss) => active ? ss.filter((x) => x !== s.id) : [...ss, s.id])} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? 'border-teal-600 bg-teal-600 text-white' : 'border-border text-muted-foreground hover:border-teal-400'}`}>
                      {s.name}
                    </button>);
        })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Pricing")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>{uiText("Hourly rate (USD)")}</Label><Input type="number" min={1} step="0.5" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}/></div>
            <div className="space-y-1.5"><Label>{uiText("Trial lesson price (USD)")}</Label><Input type="number" min={0} step="0.5" value={form.trialRate} onChange={(e) => setForm((f) => ({ ...f, trialRate: e.target.value }))}/></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">{uiText("Verification")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uiText(profile.verifications.map((v) => (<div key={v.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{v.type === 'IDENTITY' ? uiText("Identity document") : uiText(v.label)}</span>
                  <Badge variant="secondary" className={`border-0 ${v.status === 'APPROVED' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>{uiText(v.status)}</Badge>
                </div>)))}
              {profile.verifications.length === 0 && <p className="text-sm text-muted-foreground/70">{uiText("No documents uploaded yet.")}</p>}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-2">
          <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => save(false)} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{uiText("Save profile")}</Button>
          {['DRAFT', 'REJECTED'].includes(profile.status) && uiText((<Button variant="outline" className="w-full" onClick={() => save(true)} disabled={saving}>{uiText("Submit application for review")}</Button>))}
        </div>
      </div>
    </div>);
}
