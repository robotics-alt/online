'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { CalendarCheck, CalendarDays, CalendarX2, Clock, History, Loader2, ReceiptText, Search, Star, Video } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { canJoinLesson } from '@/lib/lesson-access';
import { useToast } from '@/hooks/use-toast';
import { TutorAvatar } from './TutorCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import './student-experience.css';
export interface StudentLesson {
    lessonFormat?: string;
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isTrial: boolean;
    priceCents: number;
    durationMin?: number;
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
export default function StudentLessons({ bookings, timezone, now, onUpdated, onReview }: {
    bookings: StudentLesson[];
    timezone: string;
    now: number;
    onUpdated: () => void;
    onReview: (lesson: StudentLesson) => void;
}) {
    const [section, setSection] = useState<'upcoming' | 'history'>('upcoming');
    const [cancelFor, setCancelFor] = useState<StudentLesson | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const { go, fmt } = useApp();
    const { toast } = useToast();
    const isUpcoming = (lesson: StudentLesson) => ['CONFIRMED', 'RESCHEDULED', 'PENDING_PAYMENT'].includes(lesson.status) && Date.parse(lesson.endUtc) + 45 * 60000 > now;
    const upcoming = bookings.filter(isUpcoming).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    const history = bookings.filter((lesson) => !isUpcoming(lesson)).sort((a, b) => b.startUtc.localeCompare(a.startUtc));
    const lessons = section === 'upcoming' ? upcoming : history;
    const cancel = async () => {
        if (!cancelFor || cancelling)
            return;
        setCancelling(true);
        try {
            await api(`/api/bookings/${cancelFor.id}/cancel`, { method: 'POST', json: { reason: 'Cancelled by student' } });
            setCancelFor(null);
            onUpdated();
            toast({ title: 'Lesson cancelled' });
        }
        catch (err) {
            toast({ title: 'Could not cancel', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setCancelling(false);
        }
    };
    return <div className="student-lessons-view"><div className="student-lesson-segments" role="tablist" aria-label={uiText("Lesson list")}><button role="tab" aria-selected={section === 'upcoming'} onClick={() => setSection('upcoming')}><CalendarCheck size={17}/>{uiText("Upcoming")}<span>{uiText(upcoming.length)}</span></button><button role="tab" aria-selected={section === 'history'} onClick={() => setSection('history')}><History size={17}/>{uiText("History")}<span>{uiText(history.length)}</span></button></div><p className="student-lessons-timezone"><Clock size={13}/>{uiText("Your local time \u00B7 ")}{uiText(timezone.replaceAll('_', ' '))}</p>
    {!lessons.length ? <div className="student-lessons-empty"><CalendarDays size={34}/><h2>{section === 'upcoming' ? uiText("Your next lesson is waiting.") : uiText("Your story starts here.")}</h2><p>{section === 'upcoming' ? uiText("Find a teacher and choose a time that works for you.") : uiText("Past lessons and your ratings will appear here.")}</p><Button onClick={() => go('search')}><Search size={16}/>{uiText("Find a teacher")}</Button></div> : <div className="student-lesson-list">{lessons.map((lesson, index) => {
                const date = new Date(lesson.startUtc);
                const month = date.toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: timezone });
                const previousMonth = index > 0 ? new Date(lessons[index - 1].startUtc).toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: timezone }) : '';
                const joinable = canJoinLesson(lesson, now);
                const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone });
                const day = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone });
                return <div key={lesson.id}>{month !== previousMonth && <h2 className="student-lesson-month">{uiText(month)}</h2>}<article className={`student-lesson-card ${section === 'history' ? 'is-history' : ''}`}><div className="student-lesson-person"><TutorAvatar name={lesson.tutor.name} url={lesson.tutor.avatarUrl} className="size-12"/><div><h3>{lesson.tutor.name}</h3><p>{lesson.lessonFormat === 'FACE_TO_FACE' ? uiText("Face to face") : lesson.subject?.name || uiText("Online lesson")}{lesson.isTrial && <span>{uiText("Trial")}</span>}</p></div><span className={`student-lesson-status status-${lesson.status.toLowerCase()}`}>{lesson.status === 'PENDING_PAYMENT' ? uiText("Awaiting admin approval") : uiText(lesson.status.toLowerCase().replaceAll('_', ' '))}</span></div><div className="student-lesson-details"><span><CalendarDays size={14}/>{uiText(day)}</span><span><Clock size={14}/>{uiText(time)}</span><span>{lesson.durationMin || uiText(Math.round((Date.parse(lesson.endUtc) - Date.parse(lesson.startUtc)) / 60000))}{uiText(" min")}</span></div><footer><span className="student-lesson-price">{section === 'upcoming' ? uiText(fmt(lesson.priceCents)) : uiText("Lesson details")}<small>{section === 'upcoming' ? lesson.status === 'PENDING_PAYMENT' ? uiText("Admin review pending") : lesson.lessonFormat === 'FACE_TO_FACE' ? uiText("Admin coordinates your visit") : joinable ? uiText("Classroom is open") : uiText("Opens 15 min before") : lesson.review ? uiText("Rated {{value1}}/5", { value1: lesson.review.rating }) : uiText("Lesson record")}</small></span><div className="student-lesson-actions"><Button variant="outline" size="icon" className="lesson-action-receipt" asChild><a aria-label={uiText("Receipt for lesson with {{value1}}", { value1: lesson.tutor.name })} title={uiText("Lesson receipt")} href={`/api/bookings/${lesson.id}/receipt`} target="_blank" rel="noopener noreferrer"><ReceiptText size={19}/></a></Button>{section === 'upcoming' && <><Button className="lesson-action-cancel" variant="ghost" size="icon" aria-label={uiText("Cancel lesson with {{value1}}", { value1: lesson.tutor.name })} title={uiText("Cancel lesson")} onClick={() => setCancelFor(lesson)}><CalendarX2 size={20}/></Button>{lesson.lessonFormat !== 'FACE_TO_FACE' && <Button className="lesson-action-join" size="icon" disabled={!joinable} aria-label={joinable ? uiText("Enter classroom with {{value1}}", { value1: lesson.tutor.name }) : uiText("Classroom opens 15 minutes before the lesson")} title={joinable ? uiText("Enter classroom") : uiText("Opens 15 minutes before")} onClick={() => go('classroom', { bookingId: lesson.id })}><Video size={22}/></Button>}</>}{section === 'history' && lesson.status === 'COMPLETED' && !lesson.review && <Button variant="outline" size="icon" className="lesson-action-rate" aria-label={uiText("Rate your lesson with {{value1}}", { value1: lesson.tutor.name })} title={uiText("Rate lesson")} onClick={() => onReview(lesson)}><Star size={20}/></Button>}{lesson.review && <span className="student-lesson-rating"><Star size={15}/>{uiText(lesson.review.rating)}</span>}</div></footer></article></div>;
            })}</div>}
    <Dialog open={Boolean(cancelFor)} onOpenChange={(open) => {
            if (!open && !cancelling)
                setCancelFor(null);
        }}><DialogContent className="sm:max-w-sm lesson-cancel-dialog"><span><CalendarX2 size={27}/></span><DialogTitle>{uiText("Cancel this lesson?")}</DialogTitle><DialogDescription>{uiText("Your lesson with ")}{cancelFor?.tutor.name}{uiText(" will be cancelled. Refunds follow the platform\u2019s booking policy.")}</DialogDescription><Button variant="outline" disabled={cancelling} onClick={() => setCancelFor(null)}>{uiText("Keep my lesson")}</Button><Button variant="destructive" disabled={cancelling} onClick={() => void cancel()}>{cancelling && <Loader2 size={16} className="animate-spin"/>}{uiText("Cancel lesson")}</Button></DialogContent></Dialog>
  </div>;
}
