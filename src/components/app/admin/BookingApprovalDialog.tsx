'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
export interface ApprovalBooking {
    id: string;
    status: string;
    lessonFormat?: string;
    priceCents: number;
    paymentMethod: string | null;
    student: {
        name: string;
    };
    tutor: {
        name: string;
    };
    privateDetails?: {
        phone: string | null;
        email: string | null;
        location: string | null;
        paymentReference: string | null;
    } | null;
}
export default function BookingApprovalDialog({ booking, onClose, onUpdated }: {
    booking: ApprovalBooking;
    onClose: () => void;
    onUpdated: () => void;
}) {
    const [verified, setVerified] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const decide = async (action: 'approve' | 'reject') => {
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            await api(`/api/admin/bookings/${booking.id}/approval`, { method: 'POST', json: { action, reason } });
            onUpdated();
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update appointment');
        }
        finally {
            setBusy(false);
        }
    };
    return <Dialog open onOpenChange={(open) => { if (!open && !busy)
        onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-lg"><DialogTitle>{booking.status === 'PENDING_PAYMENT' ? uiText("Review payment & appointment") : uiText("Private appointment details")}</DialogTitle><DialogDescription>{booking.student.name}{uiText(" with ")}{booking.tutor.name} · {booking.lessonFormat === 'FACE_TO_FACE' ? uiText("Face to face") : uiText("Online")}</DialogDescription><div className="rounded-xl border p-4 text-sm"><p>{uiText("Payment: ")}<strong>{uiText(booking.paymentMethod?.replaceAll('_', ' '))}</strong></p><p>{uiText("Amount: ")}<strong>{uiText(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(booking.priceCents / 100))}</strong></p>{booking.privateDetails?.paymentReference && <p className="mt-2 break-words">{uiText("Transfer reference: ")}<strong>{uiText(booking.privateDetails.paymentReference)}</strong></p>}</div>{booking.privateDetails && <section className="space-y-2 rounded-xl bg-muted p-4 text-sm"><h3 className="font-semibold">{uiText("Admin-only contact details")}</h3><p className="break-words">{uiText("Phone: ")}{booking.privateDetails.phone || '—'}</p><p className="break-words">{uiText("Email: ")}{booking.privateDetails.email || '—'}</p><p className="whitespace-pre-wrap break-words">{uiText("Location: ")}{booking.privateDetails.location || '—'}</p><p className="text-xs text-muted-foreground">{uiText("These details are excluded from teacher and student API responses. Coordinate face-to-face arrangements through the administration team.")}</p></section>}{booking.status === 'PENDING_PAYMENT' && <><label className="flex items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" className="mt-1" checked={verified} onChange={(event) => setVerified(event.target.checked)}/>{uiText("I have verified this payment and approve the appointment.")}</label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={uiText("Reason if rejecting (optional)")} maxLength={1000}/><div className="flex gap-3"><Button variant="destructive" disabled={busy} onClick={() => void decide('reject')}>{uiText("Reject appointment")}</Button><Button className="flex-1" disabled={busy || !verified} onClick={() => void decide('approve')}>{busy ? uiText("Saving\u2026") : uiText("Approve appointment")}</Button></div></>}{error && <p role="alert" className="text-sm text-destructive">{uiText(error)}</p>}</DialogContent></Dialog>;
}
