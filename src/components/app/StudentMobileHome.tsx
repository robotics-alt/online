'use client';
import { uiText } from "@/lib/ui-text";
import { useT } from '@/lib/i18n';
import { useState } from 'react';
import { ArrowRight, Bell, BookOpen, CalendarDays, ChevronRight, Clock, GraduationCap, Grid2X2, Search, Settings, Target, Users, Video, Wallet } from 'lucide-react';
import { useApp } from '@/lib/store';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { canJoinLesson } from '@/lib/lesson-access';
import { formatInTz } from '@/lib/tz';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { TutorAvatar } from './TutorCard';
const TOOLS = [
    { key: 'lessons', label: 'My lessons', icon: CalendarDays },
    { key: 'tutors', label: 'My tutors', icon: Users },
    { key: 'homework', label: 'My homework', icon: BookOpen },
    { key: 'progress', label: 'Progress', icon: Target },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'settings', label: 'Account settings', icon: Settings },
];
export function StudentMobileToolbar({ tab }: {
    tab: string;
}) {
    const { user, go, language } = useApp();
    const t = useT(language);
    const [open, setOpen] = useState(false);
    return <div className="student-mobile-toolbar">
    <div>{tab === 'overview' ? <><p>{t('learningSpace')}</p><h1>{uiText("Hi, ")}{user?.name.split(' ')[0]}.</h1><span>{t('wallet')}: {uiText(useApp.getState().fmt(user?.walletCents || 0))}</span></> : <><p>{t('learningSpace')}</p><h1>{t(({ lessons: 'myLessons', tutors: 'myTutors', homework: 'homework', progress: 'progress', notifications: 'notifications', settings: 'accountSettings' } as Record<string, string>)[tab] || 'learningSpace')}</h1></>}</div>
    <Button variant="outline" size="icon" aria-label={uiText("Learning tools")} onClick={() => setOpen(true)}><Grid2X2 size={19}/></Button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 max-h-[85dvh] overflow-y-auto"><SheetTitle>{uiText("Learning tools")}</SheetTitle><SheetDescription>{uiText("Everything else, when you need it.")}</SheetDescription><div className="student-tools-grid">{uiText(TOOLS.map((tool) => <button key={tool.key} onClick={() => { setOpen(false); go('student', { tab: tool.key }); }}><tool.icon size={22}/><span>{t(({ lessons: 'myLessons', tutors: 'myTutors', homework: 'homework', progress: 'progress', notifications: 'notifications', settings: 'accountSettings' } as Record<string, string>)[tool.key])}</span></button>))}</div></SheetContent></Sheet>
  </div>;
}
interface MobileBooking {
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isTrial: boolean;
    tutor: {
        name: string;
        avatarUrl: string | null;
    };
    subject: {
        name: string;
    } | null;
}
export default function StudentMobileHome({ upcoming, completedCount, now }: {
    upcoming: MobileBooking[];
    completedCount: number;
    now: number;
}) {
    const { user, go, fmt } = useApp();
    const timezone = useDeviceTimezone();
    const next = upcoming[0];
    return <div className="student-mobile-home">
    <div className="student-local-time"><Clock size={13}/><span>{uiText("Times in ")}{uiText(timezone.replaceAll('_', ' '))}</span><span>{uiText("Auto")}</span></div>
    {next ? <section className="student-next-lesson">
      <div className="student-card-eyebrow"><span>{canJoinLesson(next, now) ? uiText("READY TO JOIN") : uiText("YOUR NEXT LESSON")}</span>{next.isTrial && <span>{uiText("TRIAL")}</span>}</div>
      <div className="student-next-person"><TutorAvatar name={next.tutor.name} url={next.tutor.avatarUrl} className="size-12"/><div><h2>{next.subject?.name || uiText("Private lesson")}</h2><p>{uiText("with ")}{next.tutor.name}</p></div></div>
      <p className="student-next-time"><CalendarDays size={16}/>{uiText(formatInTz(new Date(next.startUtc), timezone))}</p>
      <Button className="w-full" onClick={() => go(canJoinLesson(next, now) ? 'classroom' : 'student', canJoinLesson(next, now) ? { bookingId: next.id } : { tab: 'lessons' })}>{canJoinLesson(next, now) ? <Video size={17}/> : <BookOpen size={17}/>}{canJoinLesson(next, now) ? uiText("Enter classroom") : uiText("View lesson")}<ArrowRight size={16}/></Button>
      <p className="student-classroom-note">{uiText("Video call, chat & shared screen. Opens 15 minutes before.")}</p>
    </section> : <section className="student-next-lesson"><GraduationCap size={32}/><h2>{uiText("Your next chapter starts here.")}</h2><p>{uiText("Meet a tutor and book your first lesson.")}</p><Button className="w-full mt-5" onClick={() => go('search')}><Search size={17}/>{uiText("Find a tutor")}<ArrowRight size={16}/></Button></section>}
    <div className="student-quick-links"><button onClick={() => go('search')}><span><Search size={20}/></span><strong>{uiText("Find a tutor")}</strong><ChevronRight size={16}/></button><button onClick={() => go('packages')}><span><Wallet size={20}/></span><div><strong>{uiText("Lesson packages")}</strong><small>{uiText(fmt(user?.walletCents || 0))}</small></div><ChevronRight size={16}/></button></div>
    {upcoming.length > 1 && <section className="student-up-next"><div><h2>{uiText("Coming up")}</h2><button onClick={() => go('student', { tab: 'lessons' })}>{uiText("See all")}</button></div>{upcoming.slice(1, 3).map((lesson) => <button className="student-compact-lesson" key={lesson.id} onClick={() => go('student', { tab: 'lessons' })}><TutorAvatar name={lesson.tutor.name} url={lesson.tutor.avatarUrl} className="size-9"/><span><strong>{lesson.tutor.name}</strong><small>{uiText(formatInTz(new Date(lesson.startUtc), timezone))}</small></span><ChevronRight size={16}/></button>)}</section>}
    <p className="student-progress-line"><BookOpen size={15}/><strong>{uiText(completedCount)}</strong>{uiText(" lessons completed")}<span>{uiText("Keep going, you\u2019re making progress.")}</span></p>
  </div>;
}
