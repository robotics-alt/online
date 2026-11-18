'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, History, Loader2, MessageCircle, Phone, Video, Users } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { dateKeyInTz, formatInTz } from '@/lib/tz';
import { callStudent } from '@/lib/call-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { TutorAvatar } from './TutorCard';
export interface CalendarLesson {
    groupClassId?: string;
    lessonFormat?: string;
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isTrial: boolean;
    durationMin: number;
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
export default function TutorMonthlyCalendar({ onStudent }: {
    onStudent: (student: CalendarLesson['student'], tab: 'history' | 'messages') => void;
}) {
    const timezone = useDeviceTimezone();
    const today = dateKeyInTz(new Date(), timezone);
    const [month, setMonth] = useState(() => today.slice(0, 7));
    const [selected, setSelected] = useState(today);
    const [lessons, setLessons] = useState<CalendarLesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [calling, setCalling] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const { toast } = useToast();
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        api<{
            bookings: CalendarLesson[];
        }>(`/api/tutor/calendar?month=${month}&timezone=${encodeURIComponent(timezone)}`)
            .then((data) => {
            if (!cancelled)
                setLessons(data.bookings);
        })
            .catch((err) => {
            if (!cancelled)
                setError(err instanceof Error ? err.message : 'Could not load calendar');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
    }, [month, timezone, retry]);
    const grouped = useMemo(() => {
        const byDay = new Map<string, CalendarLesson[]>();
        lessons.forEach((lesson) => { const day = dateKeyInTz(new Date(lesson.startUtc), timezone); byDay.set(day, [...(byDay.get(day) || []), lesson]); });
        return byDay;
    }, [lessons, timezone]);
    const [year, number] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, number - 1, 1));
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const days = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(year, number - 1, 1 - mondayOffset + index)).toISOString().slice(0, 10));
    const dayLessons = grouped.get(selected) || [];
    const changeMonth = (delta: number) => { const next = new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7); setMonth(next); setSelected(next + '-01'); };
    const start = async (lesson: CalendarLesson) => {
        if (lesson.groupClassId) {
            useApp.getState().go('classroom', { bookingId: 'group:' + lesson.groupClassId });
            return;
        }
        setCalling(lesson.id);
        try {
            await callStudent(lesson.id);
        }
        catch (err) {
            toast({ title: 'Could not start call', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setCalling(null);
        }
    };
    const time = (date: string) => new Date(date).toLocaleTimeString([], { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
    return <div className="teacher-calendar-section">
    <div className="teacher-calendar-heading"><div><h2>{uiText("Lesson calendar")}</h2><p>{uiText("Your students, your schedule. Times in ")}{uiText(timezone.replaceAll('_', ' '))}.</p></div><span><i />{uiText("Upcoming")}<i className="is-completed"/>{uiText("Completed")}<i className="is-trial"/>{uiText("Trial")}</span></div>
    <div className="teacher-month-layout"><section className="teacher-month-card">
      <div className="teacher-month-toolbar"><h3>{uiText(first.toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h3><div><Button size="sm" variant="outline" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>{uiText("Today")}</Button><Button variant="ghost" size="icon" aria-label={uiText("Previous month")} onClick={() => changeMonth(-1)}><ChevronLeft size={18}/></Button><Button variant="ghost" size="icon" aria-label={uiText("Next month")} onClick={() => changeMonth(1)}><ChevronRight size={18}/></Button></div></div>
      <div className="teacher-month-weekdays">{uiText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{uiText(day)}</span>))}</div>
      {error ? <div className="p-6"><p role="alert">{uiText(error)}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>{uiText("Retry")}</Button></div> : <div className="teacher-month-grid" aria-label={uiText("Monthly lessons")} aria-busy={loading}>{days.map((day) => {
                const booked = grouped.get(day) || [];
                return <div key={day} className={`teacher-month-day${day.slice(0, 7) !== month ? ' is-outside' : ''}${day === selected ? ' is-selected' : ''}${day === today ? ' is-today' : ''}`}>
          <button className="teacher-day-number" onClick={() => setSelected(day)} aria-label={uiText("{{value1}}, {{value2}} lessons", { value1: day, value2: booked.length })} aria-pressed={day === selected}><span>{uiText(Number(day.slice(-2)))}</span>{booked.length > 0 && <small>{uiText(booked.length)}</small>}</button>
          <div className="teacher-day-lessons">{booked.slice(0, 2).map((lesson) => <button key={lesson.id} className={`teacher-calendar-event ${lesson.isTrial ? 'is-trial' : ''} ${lesson.status === 'COMPLETED' ? 'is-completed' : ''} ${['CANCELLED', 'REFUNDED', 'NO_SHOW'].includes(lesson.status) ? 'is-inactive' : ''}`} onClick={() => setSelected(day)} title={uiText("{{value1}} \u00B7 {{value2}}", { value1: time(lesson.startUtc), value2: lesson.student.name })}><b>{uiText(time(lesson.startUtc))}</b><span>{lesson.student.name}</span></button>)}{booked.length > 2 && <button className="teacher-more-lessons" onClick={() => setSelected(day)}>+{uiText(booked.length - 2)}{uiText(" more")}</button>}</div>
          <div className="teacher-day-dots">{uiText(booked.slice(0, 4).map((lesson) => <i key={lesson.id} className={lesson.isTrial ? 'is-trial' : lesson.status === 'COMPLETED' ? 'is-completed' : ''}/>))}</div>
        </div>;
            })}</div>}
      {loading && <p className="teacher-calendar-loading" role="status"><Loader2 size={14} className="animate-spin"/>{uiText("Updating calendar\u2026")}</p>}
    </section><aside className="teacher-day-agenda"><div><CalendarDays size={19}/><h3>{uiText(new Date(selected + 'T12:00:00Z').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }))}</h3><span>{uiText(dayLessons.length)}</span></div>
      {!dayLessons.length && <div className="teacher-day-empty"><CalendarDays size={30}/><h4>{uiText("A little breathing room.")}</h4><p>{uiText("No lessons on this day. Select a date with a booking to see your students.")}</p></div>}
      {dayLessons.map((lesson) => <article key={lesson.id} className="teacher-agenda-lesson"><p><Clock size={13}/>{uiText(time(lesson.startUtc))} – {uiText(time(lesson.endUtc))}<span>{uiText(lesson.durationMin)}{uiText(" min")}</span></p><div><TutorAvatar name={lesson.student.name} url={lesson.student.avatarUrl} className="size-10"/><span><strong>{lesson.student.name}</strong><small>{lesson.subject?.name || uiText("Private lesson")}{lesson.isTrial ? uiText(" \u00B7 Trial") : ''}</small></span></div><span className="teacher-agenda-status">{uiText(lesson.status.toLowerCase().replaceAll('_', ' '))}</span>
        {lesson.lessonFormat === 'FACE_TO_FACE' ? <p className="rounded-lg border p-3 text-xs text-muted-foreground">{uiText("Face to face \u00B7 Arrangements coordinated by admin")}</p> : ['CONFIRMED', 'RESCHEDULED'].includes(lesson.status) && new Date(lesson.endUtc).getTime() + 45 * 60000 > Date.now() && <Button className="w-full" disabled={Boolean(calling)} onClick={() => void start(lesson)}>{calling === lesson.id ? <Loader2 className="animate-spin" size={15}/> : <Phone size={15}/>}{lesson.groupClassId ? uiText("Enter group classroom") : uiText("Call student")}</Button>}
        <div className="teacher-agenda-actions">{lesson.groupClassId ? <button onClick={() => useApp.getState().go('tutor-dash', { tab: 'classes' })}><Users size={14}/>{uiText("Manage group class")}</button> : <><button onClick={() => onStudent(lesson.student, 'history')}><History size={14}/>{uiText("History")}</button><button onClick={() => onStudent(lesson.student, 'messages')}><MessageCircle size={14}/>{uiText("Chat")}</button></>}</div>
      </article>)}
      <p className="teacher-calendar-call-note"><Video size={14}/>{uiText("You can invite a student before the booked date. An unanswered call ends after 15 minutes.")}</p>
    </aside></div>
  </div>;
}
