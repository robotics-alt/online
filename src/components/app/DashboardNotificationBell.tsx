'use client';
import { uiText } from "@/lib/ui-text";
import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, ArrowRight, Loader2 } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
type Notice = {
    id: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
};
export default function DashboardNotificationBell({ onOpenInbox }: {
    onOpenInbox: () => void;
}) {
    const userId = useApp(s => s.user?.id), count = useApp(s => s.unreadNotifications), [rows, setRows] = useState<Notice[]>([]), [open, setOpen] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(false);
    const refresh = useCallback(async () => {
        if (!userId)
            return;
        try {
            const d = await api<{
                notifications: Notice[];
                unread: number;
            }>('/api/notifications');
            if (useApp.getState().user?.id !== userId)
                return;
            setRows(d.notifications);
            useApp.getState().setCounters({ unreadNotifications: d.unread });
            setError('');
        }
        catch {
            setError('Notifications could not be refreshed. Please try again.');
        }
    }, [userId]);
    useEffect(() => {
        void refresh();
        const update = () => {
            if (!document.hidden)
                void refresh();
        }, timer = setInterval(update, 15000);
        window.addEventListener('focus', update);
        window.addEventListener('notifications-updated', update);
        document.addEventListener('visibilitychange', update);
        return () => { clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('notifications-updated', update); document.removeEventListener('visibilitychange', update); };
    }, [refresh]);
    const markRead = async (ids?: string[]) => {
        setLoading(true);
        try {
            await api('/api/notifications/read', { method: 'POST', json: { ids } });
            await refresh();
            window.dispatchEvent(new Event('notifications-updated'));
        }
        catch {
            setError('Could not mark notifications as read.');
        }
        finally {
            setLoading(false);
        }
    };
    return <Popover open={open} onOpenChange={value => {
            setOpen(value);
            if (value)
                void refresh();
        }}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative shrink-0" aria-label={count ? uiText("Notifications, {{value1}} unread", { value1: count }) : uiText("Notifications")} title={uiText("Notifications")}><Bell size={20}/>{count > 0 && <span data-notification-count={count} className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-background">{count > 99 ? '99+' : uiText(count)}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">{uiText("Notifications")}</h2><p className="text-xs text-muted-foreground">{count ? uiText("{{value1}} unread", { value1: count }) : uiText("You are all caught up")}</p></div>{count > 0 && <Button size="sm" variant="ghost" disabled={loading} onClick={() => void markRead()} aria-label={uiText("Mark all notifications as read")}>{loading ? <Loader2 size={15} className="animate-spin"/> : <Check size={16}/>}{uiText("Read all")}</Button>}</div>{error && <p role="status" className="px-4 py-3 text-sm text-destructive">{uiText(error)}</p>}<div className="max-h-[min(24rem,55dvh)] overflow-y-auto">{rows.slice(0, 5).map(n => <article className={`border-b p-4 ${n.readAt ? '' : 'bg-primary/5'}`} key={n.id}><div className="flex items-start gap-2">{!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"/>}<div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{uiText(n.title)}</h3><p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{n.body}</p><time className="mt-2 block text-[11px] text-muted-foreground">{uiText(new Date(n.createdAt).toLocaleString())}</time></div>{!n.readAt && <Button size="icon" variant="ghost" className="size-8 shrink-0" disabled={loading} aria-label={uiText("Mark as read: {{value1}}", { value1: n.title })} onClick={() => void markRead([n.id])}><Check size={15}/></Button>}</div></article>)}{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">{uiText("No notifications yet.")}</p>}</div><Button className="h-12 w-full justify-between rounded-none px-4" variant="ghost" onClick={() => { setOpen(false); onOpenInbox(); }}>{uiText("View all notifications")}<ArrowRight size={16}/></Button></PopoverContent></Popover>;
}
