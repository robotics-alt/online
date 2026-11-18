'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api } from '@/lib/store';
import { Button } from '@/components/ui/button';
interface Enrollment {
    id: string;
    priceCents: number;
    paymentMethod: string;
    paymentReference: string | null;
    student: {
        name: string;
        email: string;
    };
    group: {
        title: string;
        startUtc: string;
    };
}
export default function GroupEnrollmentApprovals() {
    const [rows, setRows] = useState<Enrollment[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(''), [verified, setVerified] = useState<Record<string, boolean>>({});
    const load = () => api<{
        enrollments: Enrollment[];
    }>('/api/admin/group-enrollments').then(data => setRows(data.enrollments)).catch(error => setError(error.message));
    useEffect(() => { void load(); }, []);
    const decide = async (id: string, action: string) => {
        setBusy(id);
        setError('');
        try {
            await api('/api/admin/group-enrollments', { method: 'POST', json: { id, action } });
            await load();
        }
        catch (error) {
            setError((error as Error).message);
        }
        finally {
            setBusy('');
        }
    };
    return <section className="admin-feature-panel"><header><div><h2>{uiText("Group class payment approvals")}</h2><p>{uiText("Only confirmed places count towards the five-member classroom minimum.")}</p></div><Button variant="outline" onClick={() => void load()}>{uiText("Refresh")}</Button></header>{!rows.length && <p className="text-sm text-muted-foreground">{uiText("No group class payments awaiting review.")}</p>}{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}{rows.map(row => <article className="profile-review-card" key={row.id}><h3>{uiText(row.group.title)}</h3><p>{row.student?.name} · {row.student?.email}</p><p>{uiText(new Date(row.group.startUtc).toLocaleString())} · {uiText(row.paymentMethod.replaceAll('_', ' '))} · ${uiText((row.priceCents / 100).toFixed(2))}</p>{row.paymentReference && <p>{uiText("Transfer reference: ")}<strong>{uiText(row.paymentReference)}</strong></p>}<label className="application-check"><input type="checkbox" checked={Boolean(verified[row.id])} onChange={e => setVerified(old => ({ ...old, [row.id]: e.target.checked }))}/>{uiText("I have verified the payment.")}</label><div className="mt-3 flex gap-2"><Button disabled={Boolean(busy) || !verified[row.id]} onClick={() => void decide(row.id, 'approve')}>{uiText("Approve place")}</Button><Button variant="outline" disabled={Boolean(busy)} onClick={() => void decide(row.id, 'reject')}>{uiText("Reject request")}</Button></div></article>)}</section>;
}
