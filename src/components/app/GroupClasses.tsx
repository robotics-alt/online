'use client';
import { uiText } from "@/lib/ui-text";
import { Fragment } from 'react';
import { PackageStrip } from './PackagesView';
import { useEffect, useState } from 'react';
import { CalendarDays, Clock, ImagePlus, Loader2, Plus, Users, Video } from 'lucide-react';
import { api, useApp } from '@/lib/store';
import { uploadMedia } from '@/lib/media-client';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TutorAvatar } from './TutorCard';
import './platform-upgrades.css';
interface Group {
    id: string;
    title: string;
    description: string;
    subject: string;
    startUtc: string;
    durationMin: number;
    minStudents: number;
    maxStudents: number;
    priceCents: number;
    enrolled: number;
    myEnrollment: string | null;
    thumbnailUrl: string;
    tutorId: string;
    status: string;
    teacher: {
        name: string;
        avatarUrl: string | null;
    };
}
function ClassCard({ item, onEnroll }: {
    item: Group;
    onEnroll: (item: Group) => void;
}) {
    const { user, fmt, go } = useApp(), timezone = useDeviceTimezone(), ready = item.enrolled >= item.minStudents, now = Date.now(), joinable = ready && item.status === 'PUBLISHED' && now >= Date.parse(item.startUtc) - 15 * 60000 && now <= Date.parse(item.startUtc) + (item.durationMin + 45) * 60000, member = item.myEnrollment === 'CONFIRMED' || item.tutorId === user?.id;
    return <article className="group-class-card"><div className="group-class-cover"><img src={item.thumbnailUrl} alt={uiText("{{value1}} class", { value1: item.subject })} loading="lazy"/><span><Users size={14}/>{uiText("Group class")}</span><strong>{item.priceCents ? uiText(fmt(item.priceCents)) : uiText("Free")}</strong></div><div className="group-class-content"><span className="group-class-subject">{uiText(item.subject)}</span><h3>{uiText(item.title)}</h3><p>{uiText(item.description)}</p><div className="group-class-teacher"><TutorAvatar name={item.teacher.name} url={item.teacher.avatarUrl} className="size-8"/><span>{item.teacher.name}</span></div><div className="group-class-facts"><span><CalendarDays size={14}/>{uiText(new Date(item.startUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone }))}</span><span><Clock size={14}/>{uiText(item.durationMin)}{uiText(" min")}</span><span><Users size={14}/>{uiText(item.enrolled)} / {uiText(item.maxStudents)}{uiText(" confirmed")}</span></div><div className="group-class-progress"><span style={{ width: `${Math.min(100, item.enrolled / item.maxStudents * 100)}%` }}/></div><small>{ready ? uiText("Minimum group size reached") : uiText("{{value1}} more confirmed students needed to open", { value1: Math.max(0, item.minStudents - item.enrolled) })}</small>{member ? <Button className="w-full" disabled={!joinable} onClick={() => go('classroom', { bookingId: 'group:' + item.id })}><Video size={16}/>{joinable ? uiText("Enter group classroom") : !ready ? uiText("Waiting for five confirmed members") : uiText("Opens 15 min before class")}</Button> : item.myEnrollment === 'PENDING' ? <p className="class-enrolment-pending">{uiText("Awaiting admin payment approval")}</p> : user?.role === 'TUTOR' ? <p className="text-xs text-muted-foreground">{uiText("Student enrolments only")}</p> : <Button className="w-full" disabled={item.enrolled >= item.maxStudents || Date.parse(item.startUtc) <= now} onClick={() => onEnroll(item)}>{item.enrolled >= item.maxStudents ? uiText("Class is full") : uiText("Reserve your place")}</Button>}</div></article>;
}
export function GroupClassList({ mine = false, strip = false, title, refreshKey = 0 }: {
    mine?: boolean;
    strip?: boolean;
    title?: string;
    refreshKey?: number;
}) {
    const { user, go, refreshMe, fmt } = useApp(), [classes, setClasses] = useState<Group[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [enrolling, setEnrolling] = useState<Group | null>(null), [method, setMethod] = useState('WALLET'), [reference, setReference] = useState(''), [busy, setBusy] = useState(false), [filter, setFilter] = useState('all');
    const load = () => api<{
        classes: Group[];
    }>('/api/group-classes' + (mine ? '?mine=1' : '')).then(data => setClasses(data.classes)).catch(error => setError(error.message)).finally(() => setLoading(false));
    useEffect(() => { void load(); const timer = setInterval(() => { if (!document.hidden)
        void load(); }, 15000); return () => clearInterval(timer); }, [mine, refreshKey, user?.id]);
    const enroll = async () => { if (!enrolling || busy)
        return; setBusy(true); setError(''); try {
        await api('/api/group-classes', { method: 'POST', json: { action: 'enroll', groupId: enrolling.id, paymentMethod: method, paymentReference: reference } });
        setEnrolling(null);
        await load();
        await refreshMe();
    }
    catch (error) {
        setError((error as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const list = classes.filter(item => filter !== 'mine' || item.myEnrollment), visible = strip ? list.slice(0, 3) : list;
    if (strip && !classes.length && !error)
        return null;
    return <section className={strip ? 'group-classes-strip' : 'group-classes-section'}><header><div><span className="group-section-eyebrow">{uiText("LEARN TOGETHER")}</span><h2>{title || uiText((mine ? 'Your group classrooms' : 'Live group classes'))}</h2><p>{uiText("Learn with a small group. Classes open with at least five confirmed members.")}</p></div>{strip ? <Button variant="outline" onClick={() => go('classes')}>{uiText("View all classes")}</Button> : user?.role === 'STUDENT' && <div className="class-list-filters"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{uiText("Discover")}</button><button aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>{uiText("My classes")}</button></div>}</header>{error && !enrolling && <p role="alert" className="text-destructive">{uiText(error)}</p>}{loading ? <p className="p-5"><Loader2 className="inline animate-spin" size={18}/>{uiText("Loading classes\u2026")}</p> : !visible.length ? <div className="class-empty"><Users size={34}/><h3>{mine ? uiText("Create your first group class") : uiText("No classes to show yet")}</h3><p>{mine ? uiText("Choose a topic, upload a cover and invite students to enrol.") : uiText("New classes will appear here as teachers publish them.")}</p></div> : <div className="group-class-grid">{uiText(visible.map((item, index) => <Fragment key={item.id}><ClassCard item={item} onEnroll={item => { if (!user) {
        go('auth', { mode: 'login' });
        return;
    } setMethod('WALLET'); setReference(''); setError(''); setEnrolling(item); }}/>{!mine && !strip && index === Math.min(2, visible.length - 1) && <div className="col-span-full"><PackageStrip /></div>}</Fragment>))}</div>}<Dialog open={Boolean(enrolling)} onOpenChange={open => { if (!open && !busy)
        setEnrolling(null); }}><DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto"><DialogTitle>{uiText("Reserve your class place")}</DialogTitle><DialogDescription>{uiText(enrolling?.title)}</DialogDescription><p className="text-xl font-semibold">{enrolling?.priceCents ? uiText(fmt(enrolling.priceCents)) : uiText("Free")}</p>{Boolean(enrolling?.priceCents) && <><label>{uiText("Payment method")}<select className="feature-select" value={method} onChange={e => setMethod(e.target.value)}><option value="WALLET">{uiText("Wallet \u00B7 ")}{uiText(fmt(user?.walletCents || 0))}{uiText(" available")}</option><option value="BANK_TRANSFER">{uiText("Bank transfer")}</option><option value="CASH">{uiText("Cash / through administrator")}</option></select></label>{method === 'BANK_TRANSFER' && <label>{uiText("Transfer reference")}<Input value={reference} onChange={e => setReference(e.target.value)} maxLength={200}/></label>}<p className="text-sm text-muted-foreground">{uiText("An administrator must verify your payment before your place is confirmed. Reserved wallet funds are returned if the request is rejected.")}</p></>}{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<Button disabled={busy} onClick={() => void enroll()}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Users size={16}/>}{uiText("Reserve place")}</Button></DialogContent></Dialog></section>;
}
export default function ClassesView() { return <div className="classes-page"><GroupClassList /></div>; }
export function TeacherGroupClasses() {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [thumbnail, setThumbnail] = useState(''), [uploading, setUploading] = useState(false), timezone = useDeviceTimezone(), [form, setForm] = useState({ title: '', description: '', subject: '', startUtc: '', durationMin: 60, minStudents: 5, maxStudents: 12, price: 0 });
    const create = async () => { setBusy(true); setError(''); try {
        await api('/api/group-classes', { method: 'POST', json: { action: 'create', ...form, startUtc: new Date(form.startUtc).toISOString(), priceCents: Math.round(form.price * 100), thumbnailId: thumbnail || undefined } });
        setOpen(false);
        setRefresh(old => old + 1);
    }
    catch (error) {
        setError((error as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <div><div className="mb-5 flex justify-end"><Button onClick={() => setOpen(true)}><Plus size={16}/>{uiText("Create a group class")}</Button></div><GroupClassList mine refreshKey={refresh}/><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogTitle>{uiText("Create a group class")}</DialogTitle><DialogDescription>{uiText("Publish a small-group lesson. At least five approved members are required to enter the classroom.")}</DialogDescription><div className="application-fields"><label>{uiText("Class title")}<Input value={form.title} maxLength={120} onChange={e => setForm(old => ({ ...old, title: e.target.value }))}/></label><label>{uiText("Subject / programme")}<Input value={form.subject} maxLength={100} onChange={e => setForm(old => ({ ...old, subject: e.target.value }))}/></label><label>{uiText("Description")}<Textarea value={form.description} maxLength={4000} onChange={e => setForm(old => ({ ...old, description: e.target.value }))}/></label><label className="certificate-upload"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; setUploading(true); try {
        setThumbnail((await uploadMedia(file, 'thumbnail')).id);
    }
    catch (error) {
        setError((error as Error).message);
    }
    finally {
        setUploading(false);
        e.target.value = '';
    } }}/><ImagePlus size={18}/>{uploading ? uiText("Compressing cover\u2026") : thumbnail ? uiText("Cover uploaded \u00B7 replace") : uiText("Upload class thumbnail")}</label>{thumbnail && <img src={'/api/media/' + thumbnail} alt={uiText("Class cover preview")} className="h-32 w-full rounded-xl object-cover"/>}<label>{uiText("Start time \u00B7 ")}{uiText(timezone)}<Input type="datetime-local" value={form.startUtc} onChange={e => setForm(old => ({ ...old, startUtc: e.target.value }))}/></label><div className="professional-two-columns"><label>{uiText("Duration (minutes)")}<Input type="number" min={30} max={180} value={form.durationMin} onChange={e => setForm(old => ({ ...old, durationMin: Number(e.target.value) }))}/></label><label>{uiText("Price per student (USD)")}<Input type="number" min={0} step={.5} value={form.price} onChange={e => setForm(old => ({ ...old, price: Number(e.target.value) }))}/></label><label>{uiText("Minimum students")}<Input type="number" min={5} max={12} value={form.minStudents} onChange={e => setForm(old => ({ ...old, minStudents: Number(e.target.value) }))}/></label><label>{uiText("Maximum places")}<Input type="number" min={5} max={12} value={form.maxStudents} onChange={e => setForm(old => ({ ...old, maxStudents: Number(e.target.value) }))}/></label></div>{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<Button disabled={busy || uploading} onClick={() => void create()}>{busy && <Loader2 className="animate-spin" size={16}/>}{uiText("Publish class")}</Button></div></DialogContent></Dialog></div>;
}
