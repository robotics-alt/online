'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import type { LessonCall } from '@/lib/lesson-calls';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { formatInTz } from '@/lib/tz';
import { useCallRingtone } from '@/hooks/use-call-ringtone';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
export default function CallInvitationWatcher() {
    const user = useApp((state) => state.user);
    const view = useApp((state) => state.view);
    const [call, setCall] = useState<LessonCall | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());
    const timezone = useDeviceTimezone();
    useCallRingtone(Boolean(call), call?.deadline);
    useEffect(() => {
        if (user?.role !== 'STUDENT') {
            setCall(null);
            return;
        }
        let cancelled = false;
        let fetching = false;
        const poll = async () => {
            if (fetching)
                return;
            fetching = true;
            try {
                const data = await api<{
                    calls: LessonCall[];
                }>('/api/lesson-calls');
                if (!cancelled)
                    setCall(data.calls.find((item) => ['ringing', 'accepted'].includes(item.status) && !(view.name === 'classroom' && view.params?.callId === item.id)) || null);
            }
            catch { /* keep the current invitation during brief reconnects */ }
            finally {
                fetching = false;
            }
        };
        void poll();
        const interval = window.setInterval(poll, 3000);
        window.addEventListener('focus', poll);
        return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', poll); };
    }, [user?.id, user?.role, view.name, view.params?.callId]);
    useEffect(() => {
        if (!call)
            return;
        setError('');
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [call?.id]);
    const answer = async (action: 'accept' | 'decline') => {
        if (!call)
            return;
        setPending(true);
        setError('');
        try {
            await api(`/api/lesson-calls/${call.id}`, { method: 'PATCH', json: { action } });
            if (action === 'accept')
                useApp.getState().go('classroom', { bookingId: call.bookingId, callId: call.id });
            setCall(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not answer the call');
        }
        finally {
            setPending(false);
        }
    };
    const remaining = call ? Math.max(0, Math.ceil((Date.parse(call.deadline) - now) / 1000)) : 0;
    return <Dialog open={Boolean(call && remaining > 0)}><DialogContent className="incoming-lesson-call sm:max-w-sm" showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
    <div className="incoming-call-avatar"><Phone size={30}/></div><p className="incoming-call-eyebrow">{uiText("INCOMING LESSON CALL")}</p><DialogTitle>{uiText(call?.tutorName)}</DialogTitle><DialogDescription>{uiText(call?.subject)}<br />{uiText("Scheduled for ")}{call ? uiText(formatInTz(new Date(call.scheduledAt), timezone)) : ''}<br />{uiText("Your teacher is waiting. You can answer before the scheduled date.")}</DialogDescription>
    <p className="incoming-call-time">{uiText("Invitation expires in ")}{uiText(Math.floor(remaining / 60))}:{uiText(String(remaining % 60).padStart(2, '0'))}</p>
    {error && <p role="alert" className="text-sm text-red-600">{uiText(error)}</p>}
    <div className="incoming-call-actions"><Button variant="outline" disabled={pending} onClick={() => void answer('decline')}><PhoneOff size={18}/>{uiText("Decline")}</Button><Button disabled={pending} onClick={() => void answer('accept')}><Video size={18}/>{uiText("Answer")}</Button></div><small>{uiText("Camera and microphone access require your permission.")}</small>
  </DialogContent></Dialog>;
}
