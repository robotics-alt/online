'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useRef, useState } from 'react';
import { Clock, Loader2, Star } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
interface Feedback {
    eligible: boolean;
    pending: boolean;
    callId: string;
    bookingId: string;
    tutorName: string;
    durationSeconds: number;
}
export default function PostCallFeedback() {
    const id = useApp((state) => state.postCallReviewId);
    const userId = useApp((state) => state.user?.id);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const sending = useRef(false);
    const dismiss = () => { setFeedback(null); useApp.getState().setPostCallReviewId(null); };
    useEffect(() => {
        if (!id || !userId) {
            setFeedback(null);
            return;
        }
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        let attempts = 0;
        const load = async () => {
            try {
                const result = await api<Feedback>(`/api/lesson-calls/${id}/feedback`);
                if (cancelled)
                    return;
                if (result.pending && ++attempts < 6) {
                    timer = setTimeout(load, 1500);
                    return;
                }
                if (result.eligible) {
                    setFeedback(result);
                    setRating(0);
                    setComment('');
                    setError('');
                }
                else
                    useApp.getState().setPostCallReviewId(null);
            }
            catch {
                if (!cancelled)
                    useApp.getState().setPostCallReviewId(null);
            }
        };
        void load();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [id, userId]);
    const save = async () => {
        if (!feedback || !rating || sending.current)
            return;
        sending.current = true;
        setSaving(true);
        setError('');
        try {
            await api('/api/reviews', { method: 'POST', json: { callId: feedback.callId, bookingId: feedback.bookingId, rating, comment } });
            window.dispatchEvent(new Event('lesson-review-saved'));
            dismiss();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save rating');
        }
        finally {
            sending.current = false;
            setSaving(false);
        }
    };
    const duration = feedback ? `${Math.floor(feedback.durationSeconds / 60)}m ${feedback.durationSeconds % 60}s` : '';
    return <Dialog open={Boolean(feedback)} onOpenChange={(open) => { if (!open && !saving)
        dismiss(); }}><DialogContent className="post-call-feedback sm:max-w-sm"><span className="post-call-icon"><Star size={27}/></span><DialogTitle>{uiText("How was your lesson?")}</DialogTitle><DialogDescription>{uiText("Share your experience with ")}{uiText(feedback?.tutorName)}.</DialogDescription><p className="post-call-duration"><Clock size={15}/>{uiText("Call duration ")}<strong>{uiText(duration)}</strong></p><div className="post-call-stars" role="group" aria-label={uiText("Rate your teacher")}>{uiText([1, 2, 3, 4, 5].map((value) => <button key={value} aria-label={uiText("{{value1}} stars", { value1: value })} aria-pressed={rating === value} onClick={() => setRating(value)}><Star size={32} className={value <= rating ? 'is-filled' : ''}/></button>))}</div><Textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} placeholder={uiText("What went well? (optional)")} aria-label={uiText("Lesson feedback")}/>{error && <p role="alert" className="text-sm text-red-600">{uiText(error)}</p>}<Button disabled={!rating || saving} onClick={() => void save()}>{saving && <Loader2 size={16} className="animate-spin"/>}{uiText("Submit rating")}</Button><button className="post-call-later" disabled={saving} onClick={dismiss}>{uiText("Maybe later")}</button></DialogContent></Dialog>;
}
