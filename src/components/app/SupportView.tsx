'use client';
import { uiText } from "@/lib/ui-text";
import { useCallback, useEffect, useState } from 'react';
import { useApp, api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LifeBuoy, Loader2, Plus, Send } from 'lucide-react';
interface Ticket {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
    user?: {
        name: string;
        email: string;
    };
    messages: {
        id: string;
        body: string;
        isStaff: boolean;
        createdAt: string;
        sender?: {
            name: string;
        };
    }[];
}
export default function SupportView() {
    const { user, go } = useApp();
    const { toast } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isStaff, setIsStaff] = useState(false);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({ subject: '', category: 'general', priority: 'normal', body: '' });
    const [active, setActive] = useState<Ticket | null>(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const load = useCallback(async () => {
        try {
            const data = await api<{
                tickets: Ticket[];
                isStaff: boolean;
            }>('/api/support');
            setTickets(data.tickets);
            setIsStaff(data.isStaff);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (user)
            void load();
    }, [user, load]);
    if (!user) {
        return (<div className="mx-auto max-w-md px-4 py-24 text-center">
        <LifeBuoy className="mx-auto h-10 w-10 text-stone-300"/>
        <p className="mt-3 font-semibold text-foreground/90">{uiText("Log in to open support tickets")}</p>
        <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => go('auth', { mode: 'login' })}>{uiText("Log in")}</Button>
      </div>);
    }
    const create = async () => {
        try {
            await api('/api/support', { method: 'POST', json: form });
            toast({ title: 'Ticket created', description: 'We usually reply within 24 hours.' });
            setCreateOpen(false);
            setForm({ subject: '', category: 'general', priority: 'normal', body: '' });
            void load();
        }
        catch (err) {
            toast({ title: 'Could not create ticket', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
    };
    const sendReply = async () => {
        if (!active || !reply.trim())
            return;
        setSending(true);
        try {
            await api('/api/support', { method: 'POST', json: { ticketId: active.id, body: reply } });
            setReply('');
            void load();
        }
        catch (err) {
            toast({ title: 'Could not send', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setSending(false);
        }
    };
    const setStatus = async (ticketId: string, status: string) => {
        try {
            await api('/api/support', { method: 'PATCH', json: { ticketId, status } });
            void load();
        }
        catch {
            toast({ title: 'Could not update', variant: 'destructive' });
        }
    };
    const statusBadge = (s: string) => (<Badge variant="secondary" className={`border-0 ${s === 'OPEN' ? 'bg-teal-100 text-teal-800' : s === 'PENDING' ? 'bg-amber-100 text-amber-800' : s === 'RESOLVED' ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'}`}>{uiText(s)}</Badge>);
    return (<div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isStaff ? uiText("Support inbox") : uiText("Help & support")}</h1>
          <p className="text-sm text-muted-foreground">{isStaff ? uiText("Respond to students and tutors.") : uiText("Questions, issues or disputes \u2014 we are here to help.")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1 h-4 w-4"/>{uiText(" New ticket")}</Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="rounded-2xl border-border">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[70vh] scroll-slim">
              {loading ? <p className="p-4 text-sm text-muted-foreground/70">{uiText("Loading\u2026")}</p> : tickets.length === 0 ? uiText((<p className="p-4 text-sm text-muted-foreground/70">{uiText("No tickets yet.")}</p>)) : tickets.map((t) => (<button key={t.id} onClick={() => setActive(t)} className={`w-full border-b border-stone-50 p-4 text-start hover:bg-muted/60 ${active?.id === t.id ? 'bg-teal-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{uiText(t.subject)}</p>
                    {uiText(statusBadge(t.status))}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{isStaff ? uiText("{{value1}} \u00B7 ", { value1: t.user?.name }) : ''}{uiText(t.category)} · {uiText(new Date(t.createdAt).toLocaleDateString())}</p>
                </button>))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          {active ? (<>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{uiText(active.subject)}</CardTitle>
                  <div className="flex items-center gap-2">
                    {uiText(statusBadge(active.status))}
                    {isStaff && uiText((<Select value={active.status} onValueChange={(v) => setStatus(active.id, v)}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">{uiText("Open")}</SelectItem><SelectItem value="PENDING">{uiText("Pending")}</SelectItem>
                          <SelectItem value="RESOLVED">{uiText("Resolved")}</SelectItem><SelectItem value="CLOSED">{uiText("Closed")}</SelectItem>
                        </SelectContent>
                      </Select>))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96 scroll-slim pr-2">
                  <div className="space-y-3">
                    {active.messages.map((m) => (<div key={m.id} className={`rounded-xl p-3 text-sm ${m.isStaff ? 'bg-teal-50 border border-teal-100' : 'bg-muted/40'}`}>
                        <p className="text-xs font-semibold text-muted-foreground">{m.sender?.name ?? uiText("User")} {m.isStaff && <Badge variant="secondary" className="ml-1 bg-teal-600 text-white border-0 text-[10px]">{uiText("STAFF")}</Badge>}</p>
                        <p className="mt-1 whitespace-pre-wrap text-foreground/90">{m.body}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">{uiText(new Date(m.createdAt).toLocaleString())}</p>
                      </div>))}
                  </div>
                </ScrollArea>
                {active.status !== 'CLOSED' && uiText((<div className="mt-4 flex gap-2">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={uiText("Write a reply\u2026")}/>
                    <Button onClick={sendReply} disabled={!reply.trim() || sending} className="bg-teal-600 hover:bg-teal-700 shrink-0" aria-label={uiText("Send reply")}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4 flip-x"/>}
                    </Button>
                  </div>))}
              </CardContent>
            </>) : uiText((<div className="flex flex-col items-center justify-center py-24 text-muted-foreground/70">
              <LifeBuoy className="h-10 w-10"/>
              <p className="mt-3 text-sm">{uiText("Select a ticket or create a new one")}</p>
            </div>))}
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{uiText("New support ticket")}</DialogTitle><DialogDescription>{uiText("Our team typically replies within 24 hours.")}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{uiText("Subject")}</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{uiText("Category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{uiText("General")}</SelectItem><SelectItem value="billing">{uiText("Billing")}</SelectItem>
                    <SelectItem value="lesson-issue">{uiText("Lesson issue")}</SelectItem><SelectItem value="dispute">{uiText("Dispute / refund")}</SelectItem>
                    <SelectItem value="safety">{uiText("Safety concern")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{uiText("Priority")}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{uiText("Low")}</SelectItem><SelectItem value="normal">{uiText("Normal")}</SelectItem><SelectItem value="high">{uiText("High")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>{uiText("Describe your issue")}</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}/></div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={create} disabled={!form.subject || !form.body}>{uiText("Create ticket")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);
}
