'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp } from '@/lib/store';
import { Bell, CalendarDays, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
type Notice = {
    id: string;
    type: string;
    title: string;
    body: string;
    link: string | null;
    readAt: string | null;
    createdAt: string;
};
export default function NotificationsPanel({ compact = false }: {
    compact?: boolean;
}) {
    const [rows, setRows] = useState<Notice[]>([]), [error, setError] = useState('');
    const load = () => api<{
        notifications: Notice[];
        unread: number;
    }>('/api/notifications').then(d => { setRows(d.notifications); useApp.getState().setCounters({ unreadNotifications: d.unread }); });
    useEffect(() => { void load().catch(e => setError(e.message)); const refresh = () => { void load().catch(() => { }); }; window.addEventListener('notifications-updated', refresh); const t = setInterval(() => void load().catch(() => { }), 30000); return () => { clearInterval(t); window.removeEventListener('notifications-updated', refresh); }; }, []);
    return <section className="rounded-2xl border bg-card p-5 sm:p-7"><div className="mb-6 flex flex-wrap items-center justify-between gap-3">{!compact && <div><h2 className="text-xl font-bold">{uiText("Notifications & events")}</h2><p className="mt-2 text-sm text-muted-foreground">{uiText("Updates and invitations from the platform.")}</p></div>}<Button variant="outline" onClick={async () => {
            try {
                await api('/api/notifications', { method: 'POST', json: {} });
                await load();
                useApp.getState().setCounters({ unreadNotifications: 0 });
                window.dispatchEvent(new Event('notifications-updated'));
            }
            catch (e) {
                setError((e as Error).message);
            }
        }}>{uiText("Mark all as read")}</Button></div>{error && <p role="alert">{uiText(error)}</p>}<div className="space-y-3">{rows.map(n => <article key={n.id} className={`flex gap-3 rounded-2xl border p-4 ${!n.readAt ? 'border-primary/30 bg-primary/5' : ''}`}><span className="mt-1 text-primary">{n.type === 'event' ? <CalendarDays size={20}/> : <Bell size={20}/>}</span><div className="min-w-0 flex-1"><h3 className="font-semibold">{uiText(n.title)}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{n.body}</p><time className="mt-2 block text-xs text-muted-foreground">{uiText(new Date(n.createdAt).toLocaleString())}</time>{n.link && /^https?:\/\//i.test(n.link) && <a className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary" href={n.link} target="_blank" rel="noopener noreferrer">{uiText("Open event")}<ExternalLink size={14}/></a>}</div></article>)}{!rows.length && <p className="py-8 text-center text-muted-foreground">{uiText("You\u2019re all caught up.")}</p>}</div></section>;
}
