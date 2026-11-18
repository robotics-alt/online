'use client';
import { uiText } from "@/lib/ui-text";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { api, useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, BookOpen, Clock, Plus, Users, CheckCircle2 } from 'lucide-react';
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function TeacherHomework() {
    const [rows, setRows] = useState<any[]>([]), [students, setStudents] = useState<any[]>([]), [groups, setGroups] = useState<any[]>([]), [open, setOpen] = useState(false), [batch, setBatch] = useState(''), [grade, setGrade] = useState<any>(null), [score, setScore] = useState(''), [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [form, setForm] = useState({ target: 'student', studentId: '', groupClassId: '', title: '', description: '', dueDate: '', durationMin: 20, timeLimitMin: '', maxScore: 100 });
    const load = async () => { const [a, s, g] = await Promise.all([api<any>('/api/tutor/assignments'), api<any>('/api/tutor/students'), api<any>('/api/group-classes?mine=1')]); setRows(a.assignments); setStudents(s.students); setGroups(g.classes.filter((c: any) => ['PUBLISHED', 'COMPLETED'].includes(c.status))); };
    useEffect(() => { void load().catch(e => setError(e.message)); const refresh = () => { void api<any>('/api/tutor/assignments').then(d => setRows(d.assignments)).catch(() => { }); }, timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); }; }, []);
    const batches = [...new Map(rows.map(r => [r.batchId || r.id, { ...r, members: rows.filter(a => (a.batchId || a.id) === (r.batchId || r.id)) }])).values()] as any[], selected = batches.find(b => (b.batchId || b.id) === batch);
    const create = async () => {
        setBusy(true);
        setError('');
        try {
            await api('/api/tutor/assignments', { method: 'POST', json: { ...form, studentId: form.target === 'student' ? form.studentId : undefined, groupClassId: form.target === 'group' ? form.groupClassId : undefined, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined, timeLimitMin: form.timeLimitMin ? Number(form.timeLimitMin) : null } });
            setOpen(false);
            setForm({ ...form, title: '', description: '' });
            await load();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    return <div className="space-y-5" data-teacher-homework><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{uiText("Homework")}</h2><p className="mt-2 text-sm text-muted-foreground">{uiText("Assign to a student or class group. Mark each student\u2019s work privately.")}</p></div><Button onClick={() => { setError(''); setOpen(true); }}><Plus size={17}/>{uiText("Assign homework")}</Button></header>{error && !open && !grade && <p role="alert" className="text-destructive">{uiText(error)}</p>}{selected ? <><Button variant="ghost" onClick={() => setBatch('')}><ArrowLeft size={16}/>{uiText("All homework")}</Button><section className="rounded-2xl border bg-card p-5"><h3 className="text-xl font-semibold">{uiText(selected.title)}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{uiText(selected.description)}</p><p className="mt-3 text-sm text-muted-foreground">{selected.groupTitle || uiText("Individual homework")} · {selected.durationMin || '—'}{uiText(" minutes estimated")}{selected.timeLimitMin ? uiText(" \u00B7 {{value1}}-minute timed attempt", { value1: selected.timeLimitMin }) : ''}{selected.dueDate ? uiText(" \u00B7 Due {{value1}}", { value1: date(selected.dueDate) }) : ''}</p></section><div className="space-y-3">{selected.members.map((a: any) => { const s = a.submissions[0]; return <article key={a.id} className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{a.student.name}</strong><span className="rounded-full bg-muted px-3 py-1 text-xs">{s?.status?.replaceAll('_', ' ') || uiText("Not started")}</span></div>{s && <><p className="my-4 whitespace-pre-wrap break-words text-sm">{s.content || uiText("No answer saved yet.")}</p>{s.score != null && <p className="font-semibold text-primary">{uiText(s.score)}/{uiText(a.maxScore)}{uiText(" marks")}</p>}{s.feedback && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{uiText("Feedback: ")}{uiText(s.feedback)}</p>}{['SUBMITTED', 'GRADED'].includes(s.status) && <Button className="mt-4" variant="outline" onClick={() => { setGrade({ ...s, maxScore: a.maxScore, studentName: a.student.name }); setScore(String(s.score ?? '')); setFeedback(s.feedback || ''); setError(''); }}>{s.status === 'GRADED' ? uiText("Update mark & feedback") : uiText("Mark submission")}</Button>}</>}</article>; })}</div></> : <div className="grid gap-4 md:grid-cols-2">{batches.map(a => <article key={a.batchId || a.id} className="rounded-2xl border bg-card p-5"><span className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary">{a.groupClassId ? <Users size={22}/> : <BookOpen size={22}/>}</span><h3 className="text-lg font-semibold">{uiText(a.title)}</h3><p className="mt-2 text-sm text-muted-foreground">{a.groupTitle || a.student.name}{a.groupClassId ? uiText(" \u00B7 {{value1}} students", { value1: a.members.length }) : ''}</p><p className="mt-3 text-sm">{uiText(a.members.filter((r: any) => r.status === 'SUBMITTED' || r.status === 'GRADED').length)}/{uiText(a.members.length)}{uiText(" submitted \u00B7 ")}{uiText(a.members.filter((r: any) => r.status === 'GRADED').length)}{uiText(" marked")}</p><p className="mt-2 text-xs text-muted-foreground">{a.durationMin || '—'}{uiText(" min estimated")}{a.timeLimitMin ? uiText(" \u00B7 {{value1}} min timed", { value1: a.timeLimitMin }) : ''}{a.dueDate ? uiText(" \u00B7 Due {{value1}}", { value1: date(a.dueDate) }) : ''}</p><Button className="mt-5 w-full" variant="outline" onClick={() => setBatch(a.batchId || a.id)}>{uiText("Review homework")}</Button></article>)}{!batches.length && <p className="rounded-xl border p-7 text-muted-foreground">{uiText("No homework assigned yet.")}</p>}</div>}<Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"><DialogTitle>{uiText("Assign homework")}</DialogTitle><DialogDescription>{uiText("Group assignments go to members with confirmed places. Each student receives a private copy.")}</DialogDescription><label className="grid gap-2 text-sm">{uiText("Assign to")}<select className="feature-select" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}><option value="student">{uiText("Individual student")}</option><option value="group">{uiText("Class group")}</option></select></label>{form.target === 'student' ? <label className="grid gap-2 text-sm">{uiText("Student")}<select className="feature-select" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}><option value="">{uiText("Choose student")}</option>{students.map(s => <option key={s.student.id} value={s.student.id}>{s.student.name}</option>)}</select></label> : <label className="grid gap-2 text-sm">{uiText("Class group")}<select className="feature-select" value={form.groupClassId} onChange={e => setForm({ ...form, groupClassId: e.target.value })}><option value="">{uiText("Choose class group")}</option>{uiText(groups.map(g => <option key={g.id} value={g.id}>{uiText(g.title)} · {uiText(g.enrolled)}{uiText(" members")}</option>))}</select></label>}<label className="grid gap-2 text-sm">{uiText("Title")}<Input maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><label className="grid gap-2 text-sm">{uiText("Instructions")}<Textarea rows={4} value={form.description} maxLength={8000} onChange={e => setForm({ ...form, description: e.target.value })}/></label><label className="grid gap-2 text-sm">{uiText("Due date (optional, your local time)")}<Input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}/></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm">{uiText("Estimated minutes")}<Input type="number" min={1} max={1440} value={form.durationMin} onChange={e => setForm({ ...form, durationMin: Number(e.target.value) })}/></label><label className="grid gap-2 text-sm">{uiText("Maximum marks")}<Input type="number" min={1} max={1000} value={form.maxScore} onChange={e => setForm({ ...form, maxScore: Number(e.target.value) })}/></label></div><label className="grid gap-2 text-sm">{uiText("Timed attempt limit (optional minutes)")}<Input type="number" min={1} max={240} placeholder={uiText("No time limit")} value={form.timeLimitMin} onChange={e => setForm({ ...form, timeLimitMin: e.target.value })}/></label><p className="text-xs text-muted-foreground">{uiText("A timed attempt starts when the student presses Start. Saved work is submitted when time expires.")}</p>{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<Button disabled={busy} onClick={() => void create()}>{busy ? uiText("Assigning\u2026") : uiText("Assign homework")}</Button></DialogContent></Dialog><Dialog open={!!grade} onOpenChange={v => {
            if (!v)
                setGrade(null);
        }}><DialogContent><DialogTitle>{uiText("Mark homework")}</DialogTitle><DialogDescription>{uiText(grade?.studentName)}{uiText(" \u00B7 maximum ")}{uiText(grade?.maxScore)}{uiText(" marks")}</DialogDescription><label className="grid gap-2 text-sm">{uiText("Mark")}<Input type="number" min={0} max={grade?.maxScore} step="0.5" value={score} onChange={e => setScore(e.target.value)}/></label><label className="grid gap-2 text-sm">{uiText("Feedback")}<Textarea rows={5} maxLength={5000} value={feedback} onChange={e => setFeedback(e.target.value)}/></label>{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<Button disabled={busy || score === '' || !feedback.trim()} onClick={async () => {
            setBusy(true);
            try {
                await api('/api/tutor/assignments', { method: 'POST', json: { action: 'grade', submissionId: grade.id, score: Number(score), feedback } });
                await load();
                setGrade(null);
            }
            catch (e) {
                setError((e as Error).message);
            }
            finally {
                setBusy(false);
            }
        }}>{uiText("Save mark & feedback")}</Button></DialogContent></Dialog></div>;
}
export function StudentHomework() {
    const [rows, setRows] = useState<any[]>([]), [id, setId] = useState(''), [content, setContent] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [now, setNow] = useState(Date.now()), contentRef = useRef(''), auto = useRef(''), view = useApp(s => s.view);
    const load = async () => { const d = await api<any>('/api/assignments'); setRows(d.assignments); return d.assignments; };
    useEffect(() => { void load().catch(e => setMessage(e.message)); const refresh = () => { void load().catch(() => { }); }, timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); }; }, []);
    useEffect(() => {
        if (view.params?.assignmentId)
            setId(view.params.assignmentId);
    }, [view.params?.assignmentId]);
    const a = rows.find(r => r.id === id), s = a?.submissions[0], deadline = s?.deadlineAt ? +new Date(s.deadlineAt) : 0, remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
    useEffect(() => { setContent(s?.content || ''); contentRef.current = s?.content || ''; auto.current = ''; setMessage(''); }, [id, s?.id]);
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    const submit = async () => {
        if (!a || busy)
            return;
        setBusy(true);
        setMessage('');
        try {
            const d = await api<any>('/api/assignments', { method: 'POST', json: { assignmentId: id, content: contentRef.current } });
            await load();
            setMessage(d.expired ? 'Time ended. Your last saved answer was submitted.' : 'Homework submitted.');
        }
        catch (e) {
            setMessage((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        if (deadline && now >= deadline && s?.status === 'IN_PROGRESS' && auto.current !== id && !busy) {
            auto.current = id;
            void submit();
        }
    }, [now, deadline, s?.status, id, busy]);
    useEffect(() => {
        if (!s || s.status !== 'IN_PROGRESS')
            return;
        const timer = setInterval(() => { void api('/api/assignments', { method: 'POST', json: { assignmentId: id, action: 'draft', content: contentRef.current } }).catch(() => { }); }, 10000);
        return () => clearInterval(timer);
    }, [id, s?.id, s?.status]);
    return <div className="mx-auto max-w-3xl space-y-5" data-student-homework><h2 className="text-2xl font-semibold">{uiText("My homework")}</h2>{a ? <><Button variant="ghost" onClick={() => setId('')}><ArrowLeft size={16}/>{uiText("All homework")}</Button><section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-7"><div><h3 className="text-xl font-semibold">{uiText(a.title)}</h3><p className="mt-2 text-sm text-muted-foreground">{a.tutor.name}{a.groupTitle ? uiText(" \u00B7 {{value1}}", { value1: a.groupTitle }) : ''}</p></div><p className="whitespace-pre-wrap break-words text-sm">{uiText(a.description)}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{a.durationMin || '—'}{uiText(" minutes estimated")}</span>{a.dueDate && <span>{uiText("Due ")}{uiText(date(a.dueDate))}</span>}<span>{uiText(a.maxScore)}{uiText(" marks")}</span></div>{a.timeLimitMin && <p className="rounded-xl bg-primary/10 p-3 text-sm"><Clock className="me-2 inline" size={16}/>{s?.status === 'IN_PROGRESS' ? uiText("Time left: {{value1}}:{{value2}}", { value1: Math.floor(remaining / 60), value2: String(remaining % 60).padStart(2, '0') }) : uiText("Timed attempt: {{value1}} minutes", { value1: a.timeLimitMin })}</p>}{s?.status === 'GRADED' ? <div className="space-y-3 rounded-xl border bg-primary/5 p-5"><h4 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18}/>{uiText("Marked \u00B7 ")}{uiText(s.score)}/{uiText(a.maxScore)}</h4><p className="whitespace-pre-wrap text-sm">{uiText(s.feedback)}</p><details className="text-sm"><summary>{uiText("Your answer")}</summary><p className="mt-3 whitespace-pre-wrap break-words">{s.content}</p></details></div> : !s ? <Button disabled={busy} onClick={async () => {
                    setBusy(true);
                    try {
                        await api('/api/assignments', { method: 'POST', json: { assignmentId: id, action: 'start' } });
                        await load();
                    }
                    catch (e) {
                        setMessage((e as Error).message);
                    }
                    finally {
                        setBusy(false);
                    }
                }}>{uiText("Start homework")}</Button> : a.timeLimitMin && s.status === 'SUBMITTED' ? <div><p className="font-semibold text-primary">{uiText("Submitted \u00B7 waiting for your teacher\u2019s feedback")}</p><p className="mt-4 whitespace-pre-wrap break-words text-sm">{s.content}</p></div> : <><label className="grid gap-2 text-sm">{uiText("Your answer")}<Textarea disabled={busy || Boolean(deadline && now >= deadline)} rows={9} maxLength={8000} value={content} onChange={e => { setContent(e.target.value); contentRef.current = e.target.value; }}/></label><p className="text-xs text-muted-foreground">{uiText("Work is saved every 10 seconds while this page is open.")}</p><Button disabled={busy || !content.trim() && !(deadline && now >= deadline)} onClick={() => void submit()}>{busy ? uiText("Submitting\u2026") : s.status === 'SUBMITTED' ? uiText("Update submission") : uiText("Submit homework")}</Button></>}{message && <p role="status" className="text-sm">{message}</p>}</section></> : <>{message && <p role="status">{message}</p>}<div className="space-y-3">{rows.map(r => <button key={r.id} className="flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-start hover:border-primary" onClick={() => setId(r.id)}><span className="rounded-xl bg-primary/10 p-3 text-primary"><BookOpen size={22}/></span><div className="min-w-0 flex-1"><strong className="block">{uiText(r.title)}</strong><p className="mt-1 text-xs text-muted-foreground">{r.tutor.name}{r.groupTitle ? uiText(" \u00B7 {{value1}}", { value1: r.groupTitle }) : ''} · {r.durationMin || '—'}{uiText(" minutes")}</p><span className="mt-2 block text-xs text-primary">{r.status === 'GRADED' ? uiText("Marked: {{value1}}/{{value2}}", { value1: r.submissions[0]?.score, value2: r.maxScore }) : uiText(r.status.toLowerCase())}</span></div></button>)}{!rows.length && <p className="rounded-xl border p-8 text-muted-foreground">{uiText("Homework from your teachers will appear here.")}</p>}</div></>}</div>;
}
