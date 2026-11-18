'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { Clock, History, Loader2, MessageCircle, Video } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { formatInTz } from '@/lib/tz';
import { callStudent } from '@/lib/call-client';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import MessagesView from './MessagesView';
import { TutorAvatar } from './TutorCard';
interface HistoryLesson {
    id: string;
    startUtc: string;
    endUtc: string;
    status: string;
    isTrial: boolean;
    durationMin: number;
    priceCents: number;
    subject: {
        name: string;
    } | null;
    review: {
        rating: number;
        comment: string;
    } | null;
}
interface HistoryData {
    bookings: HistoryLesson[];
    count: number;
    completed: number;
    page: number;
    pages: number;
}
export default function TeacherStudentPanel({ student, initialTab, onClose }: {
    student: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
    initialTab: 'history' | 'messages';
    onClose: () => void;
}) {
    const [tab, setTab] = useState(initialTab);
    const [page, setPage] = useState(1);
    const [data, setData] = useState<HistoryData | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [calling, setCalling] = useState(false);
    const timezone = useDeviceTimezone();
    const fmt = useApp((state) => state.fmt);
    const { toast } = useToast();
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        api<HistoryData>(`/api/tutor/students/${student.id}/history?page=${page}`).then((value) => {
            if (!cancelled)
                setData(value);
        }).catch((err) => {
            if (!cancelled)
                setError(err instanceof Error ? err.message : 'Could not load history');
        }).finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
    }, [student.id, page]);
    const ring = async (id: string) => {
        setCalling(true);
        try {
            await callStudent(id);
            onClose();
        }
        catch (err) {
            toast({ title: 'Could not start call', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setCalling(false);
        }
    };
    return <Sheet open onOpenChange={(open) => {
            if (!open)
                onClose();
        }}><SheetContent side="right" className="teacher-student-panel w-full sm:max-w-xl p-0 gap-0">
    <header><TutorAvatar name={student.name} url={student.avatarUrl} className="size-11"/><div><SheetTitle>{student.name}</SheetTitle><SheetDescription>{uiText("Your lessons and conversations")}</SheetDescription></div></header>
    <div className="teacher-student-panel-tabs" role="tablist" aria-label={uiText("Student details")}><button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}><History size={16}/>{uiText("Lesson history")}</button><button role="tab" aria-selected={tab === 'messages'} onClick={() => setTab('messages')}><MessageCircle size={16}/>{uiText("Messages")}</button></div>
    {tab === 'messages' ? <MessagesView key={student.id} embedded recipientId={student.id}/> : <div className="teacher-student-history">
      {loading ? <p role="status"><Loader2 className="animate-spin inline-block me-2" size={16}/>{uiText("Loading lessons\u2026")}</p> : error ? <p role="alert">{uiText(error)}</p> : data && <><div className="teacher-history-summary"><span><strong>{uiText(data.count)}</strong>{uiText("Total lessons")}</span><span><strong>{uiText(data.completed)}</strong>{uiText("Completed")}</span></div>
        {data.bookings.map((lesson) => <article key={lesson.id}><div><span>{lesson.subject?.name || uiText("Private lesson")}</span><small className={`lesson-history-status status-${lesson.status.toLowerCase()}`}>{uiText(lesson.status.replaceAll('_', ' '))}</small></div><p><Clock size={13}/>{uiText(formatInTz(new Date(lesson.startUtc), timezone))}</p><p>{uiText(lesson.durationMin)}{uiText(" minutes \u00B7 ")}{uiText(fmt(lesson.priceCents))}{lesson.isTrial ? uiText(" \u00B7 Trial lesson") : ''}</p>{lesson.review && <p className="teacher-history-review">{uiText('★'.repeat(lesson.review.rating))} {lesson.review.comment}</p>}{['CONFIRMED', 'RESCHEDULED'].includes(lesson.status) && new Date(lesson.endUtc).getTime() + 45 * 60000 > Date.now() && <Button size="sm" disabled={calling} onClick={() => void ring(lesson.id)}><Video size={14}/>{uiText("Call student")}</Button>}</article>)}
        {data.pages > 1 && <div className="teacher-history-pagination"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>{uiText("Previous")}</Button><span>{uiText(page)} / {uiText(data.pages)}</span><Button variant="outline" size="sm" disabled={page === data.pages} onClick={() => setPage(page + 1)}>{uiText("Next")}</Button></div>}
      </>}
    </div>}
  </SheetContent></Sheet>;
}
