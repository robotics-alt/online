'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api } from '@/lib/store';
import { readList, type LanguageItem, type ExperienceItem, type SkillItem } from '@/lib/profile-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
interface Change {
    id: string;
    patchJson: string;
    profile?: {
        headline: string;
        languages: string;
        user: {
            name: string;
            email: string;
        };
    };
}
export default function ProfileChangesPanel() {
    const [changes, setChanges] = useState<Change[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(''), [reason, setReason] = useState<Record<string, string>>({});
    const load = () => api<{
        changes: Change[];
    }>('/api/admin/profile-changes').then(data => setChanges(data.changes)).catch(error => setError(error.message));
    useEffect(() => { void load(); }, []);
    const decide = async (id: string, action: string) => {
        setBusy(id);
        setError('');
        try {
            await api('/api/admin/profile-changes', { method: 'POST', json: { id, action, reason: reason[id] } });
            await load();
        }
        catch (error) {
            setError((error as Error).message);
        }
        finally {
            setBusy('');
        }
    };
    return <section className="admin-feature-panel"><header><div><h2>{uiText("Professional profile changes")}</h2><p>{uiText("Review qualifications and proposed changes before they replace the approved profile.")}</p></div><Button variant="outline" onClick={() => void load()}>{uiText("Refresh")}</Button></header>{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}{!changes.length && <p className="text-sm text-muted-foreground">{uiText("No professional changes awaiting review.")}</p>}{changes.map(change => { const patch = JSON.parse(change.patchJson); return <article className="profile-review-card" key={change.id}><h3>{change.profile?.user.name}</h3><p>{change.profile?.user.email}</p><div className="profile-review-columns"><section><h4>{uiText("Currently approved")}</h4><p>{uiText(change.profile?.headline)}</p><p>{uiText(change.profile?.languages)}</p></section><section><h4>{uiText("Proposed changes")}</h4>{uiText(Object.entries(patch).filter(([key]) => !['languageItems', 'experienceItems', 'skillItems', 'subjectIds'].includes(key)).map(([key, value]) => <p key={key}><strong>{uiText(key.replace(/([A-Z])/g, ' $1'))}:</strong> {uiText(String(value))}</p>))}{readList<LanguageItem>(patch.languageItems).map(item => <p key={item.name}>{item.name} · {uiText(item.level)}</p>)}{uiText(readList<ExperienceItem>(patch.experienceItems).map((item, index) => <div key={index}><p>{uiText(item.title)} · {uiText(item.organization)} · {uiText(item.program)} · {uiText(item.years)}{uiText(" years")}</p>{item.certificateId && <a href={'/api/media/' + item.certificateId} target="_blank" rel="noreferrer" className="text-primary underline">{uiText("Review supporting document")}</a>}</div>))}{readList<SkillItem>(patch.skillItems).map((item, index) => <p key={index}>{item.name} {item.certificateId && <a href={'/api/media/' + item.certificateId} target="_blank" rel="noreferrer" className="text-primary underline">{uiText("Supporting document")}</a>}</p>)}</section></div><Input value={reason[change.id] || ''} onChange={e => setReason(old => ({ ...old, [change.id]: e.target.value }))} placeholder={uiText("Review note or reason for rejection")}/><div className="mt-3 flex gap-2"><Button disabled={Boolean(busy)} onClick={() => void decide(change.id, 'approve')}>{uiText("Approve changes")}</Button><Button disabled={Boolean(busy)} variant="outline" onClick={() => void decide(change.id, 'reject')}>{uiText("Reject changes")}</Button></div></article>; })}</section>;
}
