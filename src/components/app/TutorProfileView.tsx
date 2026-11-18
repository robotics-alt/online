'use client';
import { uiText } from "@/lib/ui-text";
import ProfessionalSummary from './ProfessionalSummary';
import { Input } from '@/components/ui/input';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, api } from '@/lib/store';
import { Stars, TutorAvatar } from './TutorCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useDeviceTimezone } from '@/hooks/use-device-timezone';
import { BadgeCheck, Globe2, GraduationCap, Award, MessageSquare, CalendarDays, ChevronLeft, ChevronRight, Loader2, Clock, CreditCard, Package, Wallet, ShieldCheck, BookOpen, Languages, Video, } from 'lucide-react';
import { formatInTz, dateKeyInTz } from '@/lib/tz';
interface Slot {
    startUtc: string;
    endUtc: string;
    date: string;
    startLocalMin: number;
}
interface LessonCredit {
    id: string;
    remaining: number;
    total: number;
    tutorId: string | null;
    note: string;
    expiresAt: string | null;
    expired: boolean;
    packageId: string | null;
    studentId: string;
}
export default function TutorProfileView({ tutorId }: {
    tutorId: string;
}) {
    const { user, go, fmt, refreshMe } = useApp();
    const bookFlag = useApp((s) => s.view.params?.book === '1');
    const { toast } = useToast();
    const [tutor, setTutor] = useState<Record<string, unknown> | null>(null);
    const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const [selected, setSelected] = useState<Slot | null>(null);
    const [bookOpen, setBookOpen] = useState(false);
    const [isTrial, setIsTrial] = useState(false);
    const [payWith, setPayWith] = useState<'WALLET' | 'CREDIT' | 'BANK_TRANSFER' | 'CASH'>('WALLET');
    const [lessonFormat, setLessonFormat] = useState<'ONLINE' | 'FACE_TO_FACE'>('ONLINE');
    const [privateDetails, setPrivateDetails] = useState({ phone: '', email: '', location: '', paymentReference: '' });
    const [creditId, setCreditId] = useState<string>('');
    const [credits, setCredits] = useState<LessonCredit[]>([]);
    const [notes, setNotes] = useState('');
    const [booking, setBooking] = useState(false);
    const [contacting, setContacting] = useState(false);
    const myTz = useDeviceTimezone();
    const loadTutor = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api<{
                tutor: Record<string, unknown>;
                reviews: Record<string, unknown>[];
            }>(`/api/tutors/${tutorId}`);
            setTutor(data.tutor);
            setLessonFormat(data.tutor.onlineEnabled === false ? 'FACE_TO_FACE' : 'ONLINE');
            setReviews(data.reviews);
        }
        catch (err) {
            if (err instanceof Error && err.message.includes('not found'))
                setNotFound(true);
        }
        finally {
            setLoading(false);
        }
    }, [tutorId]);
    const loadSlots = useCallback(async (offset: number) => {
        setSlotsLoading(true);
        setSelected(null);
        try {
            const from = new Date();
            from.setDate(from.getDate() + offset * 7);
            const fromKey = from.toISOString().slice(0, 10);
            const data = await api<{
                slots: Slot[];
            }>(`/api/tutors/${tutorId}/slots?from=${fromKey}&days=7`);
            setSlots(data.slots);
        }
        catch {
            setSlots([]);
        }
        finally {
            setSlotsLoading(false);
        }
    }, [tutorId]);
    useEffect(() => { void loadTutor(); }, [loadTutor]);
    useEffect(() => { void loadSlots(weekOffset); }, [weekOffset, loadSlots]);
    useEffect(() => {
        if (bookFlag) {
            setIsTrial(true);
            setBookOpen(true);
        }
    }, [bookFlag]);
    const byDate = useMemo(() => {
        // Group slots by their date in the VIEWER's timezone so day headers
        // match the times actually shown (all rendered with timeZone: myTz).
        const map = new Map<string, Slot[]>();
        for (const s of slots) {
            const key = dateKeyInTz(new Date(s.startUtc), myTz);
            const list = map.get(key) ?? [];
            list.push(s);
            map.set(key, list);
        }
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [slots, myTz]);
    const openBooking = async () => {
        if (!user) {
            go('auth', { mode: 'login' });
            return;
        }
        if (user.role !== 'STUDENT') {
            toast({ title: 'Only students can book lessons', variant: 'destructive' });
            return;
        }
        setBookOpen(true);
        try {
            const w = await api<{
                credits: LessonCredit[];
            }>('/api/wallet');
            setCredits(w.credits.filter((c) => !c.expired && c.remaining > 0 && (!c.tutorId || c.tutorId === (tutor?.userId as string))));
        }
        catch { /* ignore */ }
    };
    const confirmBooking = async () => {
        if (!selected)
            return;
        setBooking(true);
        try {
            await api('/api/bookings', { method: 'POST', json: {
                    tutorProfileId: tutorId,
                    startUtc: selected.startUtc,
                    isTrial,
                    paymentMethod: payWith,
                    creditId: payWith === 'CREDIT' ? creditId || credits[0]?.id : undefined,
                    lessonFormat,
                    privateDetails,
                    studentNotes: notes || undefined,
                    subjectId: firstSubjectId(tutor),
                } });
            setBookOpen(false);
            setSelected(null);
            setNotes('');
            await refreshMe();
            await loadSlots(weekOffset);
            toast({ title: isTrial ? 'Free trial confirmed' : 'Booking submitted for approval', description: isTrial ? lessonFormat === 'ONLINE' ? 'Your online classroom opens 15 minutes before the lesson.' : 'An administrator will coordinate your face-to-face arrangements.' : 'An administrator must verify your payment before your appointment is confirmed.' });
            go('student', { tab: 'lessons' });
        }
        catch (err) {
            toast({ title: 'Booking failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
        }
        finally {
            setBooking(false);
        }
    };
    const contactTutor = async () => {
        if (!user) {
            go('auth', { mode: 'login' });
            return;
        }
        setContacting(true);
        try {
            const res = await api<{
                conversationId: string;
            }>('/api/conversations', { method: 'POST', json: { userId: tutor?.userId as string } });
            go('messages', { conversationId: res.conversationId });
        }
        catch (err) {
            toast({ title: 'Could not start conversation', description: err instanceof Error ? err.message : '', variant: 'destructive' });
        }
        finally {
            setContacting(false);
        }
    };
    if (loading) {
        return <div className="flex items-center justify-center py-32 text-muted-foreground/70"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Loading profile\u2026")}</div>;
    }
    if (notFound || !tutor) {
        return (<div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-lg font-semibold text-foreground/90">{uiText("Tutor not found")}</p>
        <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => go('search')}>{uiText("Browse tutors")}</Button>
      </div>);
    }
    const name = tutor.name as string;
    const trialPrice = 0;
    const price = isTrial ? trialPrice : (tutor.hourlyRateCents as number);
    const hasCredits = credits.length > 0;
    return (<div className="bg-muted/40 pb-16">
      {/* Hero */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex flex-col gap-5 sm:flex-row">
              <TutorAvatar name={name} url={tutor.avatarUrl as string | null} className="h-24 w-24 border-2 border-teal-100"/>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{name}</h1>
                  {(tutor.identityVerified as boolean) && uiText((<Badge className="bg-teal-100 text-teal-800 border-0"><BadgeCheck className="mr-1 h-3.5 w-3.5"/>{uiText(" Verified")}</Badge>))}
                </div>
                <p className="mt-1 text-muted-foreground">{uiText(tutor.headline as string)}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {(tutor.rating as number | null) != null ? uiText((<span className="flex items-center gap-1.5">
                      <Stars rating={tutor.rating as number}/>
                      <strong className="text-foreground">{uiText(tutor.rating as number)}</strong>
                      <span>({uiText(tutor.reviewCount as number)}{uiText(" reviews)")}</span>
                    </span>)) : <span className="text-muted-foreground/70">{uiText("New tutor \u2014 be their first student!")}</span>}
                  <span className="flex items-center gap-1"><Globe2 className="h-4 w-4"/>{uiText(tutor.country as string)}</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-4 w-4"/>{uiText(tutor.lessonsCompleted as number)}{uiText(" lessons")}</span>
                  <span className="flex items-center gap-1"><GraduationCap className="h-4 w-4"/>{uiText(tutor.studentsCount as number)}{uiText(" students")}</span>
                  <span className="flex items-center gap-1"><Languages className="h-4 w-4"/>{uiText(tutor.languages as string)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(tutor.subjects as {
            id: string;
            name: string;
        }[]).map((s) => (<Badge key={s.id} variant="secondary" className="bg-teal-50 text-teal-700 border-0">{s.name}</Badge>))}
                </div>
              </div>
            </div>
          </div>

          {/* Booking card */}
          <Card className="rounded-2xl border-border shadow-sm h-fit lg:sticky lg:top-20">
            <CardContent className="p-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-foreground">{uiText(fmt(tutor.hourlyRateCents as number))}</span>
                <span className="text-sm text-muted-foreground/70">/ hour</span>
              </div>
              <p className="mt-1 text-sm text-primary font-medium">{uiText("First trial with this teacher is free")}</p>
              <div className="mt-4 space-y-2">
                <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700" onClick={() => { setIsTrial(false); void openBooking(); }}>
                  <CalendarDays className="mr-2 h-4 w-4"/>{uiText(" Book a lesson")}</Button>
                <Button variant="outline" className="w-full h-11" onClick={() => { setIsTrial(true); void openBooking(); }}>{uiText("Book a free trial")}</Button>
                <Button variant="ghost" className="w-full" onClick={contactTutor} disabled={contacting}>
                  {contacting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MessageSquare className="mr-2 h-4 w-4"/>}{uiText("Contact ")}{uiText(name.split(' ')[0])}
                </Button>
              </div>
              <Separator className="my-4"/>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-teal-600"/>{uiText(" Secure payment \u2014 funds held until lesson completion")}</li>
                <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-teal-600"/>{uiText(" Free cancellation up to 12h before")}</li>
                <li className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-teal-600"/>{uiText(" Interactive classroom with whiteboard")}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="text-lg font-bold text-foreground">{uiText("About me")}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{uiText(tutor.about as string)}</p>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <Card className="rounded-2xl border-border"><CardContent className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Award className="h-4 w-4 text-teal-600"/>{uiText(" Teaching experience")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{uiText(tutor.experience as string)}</p>
              <p className="mt-2 text-xs text-muted-foreground/70">{uiText(tutor.yearsExperience as number)}{uiText(" years of teaching")}</p>
            </CardContent></Card>
            <Card className="rounded-2xl border-border"><CardContent className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><GraduationCap className="h-4 w-4 text-teal-600"/>{uiText(" Education & certifications")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{uiText(tutor.education as string)}</p>
              {(tutor.certifications as string) && <p className="mt-1 text-sm text-muted-foreground">{uiText(tutor.certifications as string)}</p>}
            </CardContent></Card>
            <Card className="rounded-2xl border-border sm:col-span-2"><CardContent className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><BookOpen className="h-4 w-4 text-teal-600"/>{uiText(" Teaching approach")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{uiText(tutor.methodology as string)}</p>
            </CardContent></Card>
          </section>

          <ProfessionalSummary data={tutor}/>
          {/* Reviews */}
          <section>
            <h2 className="text-lg font-bold text-foreground">{uiText("Student reviews ")}<span className="text-muted-foreground/70 font-normal">({uiText(reviews.length)})</span></h2>
            {reviews.length === 0 ? uiText((<p className="mt-3 text-sm text-muted-foreground/70">{uiText("No reviews yet \u2014 completed lessons unlock verified reviews.")}</p>)) : (<div className="mt-4 space-y-4">
                {reviews.map((r) => (<Card key={r.id as string} className="rounded-2xl border-border">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Stars rating={r.rating as number}/>
                          <span className="text-sm font-semibold text-foreground">{(r.student as {
                    name: string;
                }).name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground/70">{uiText(new Date(r.createdAt as string).toLocaleDateString())}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{r.comment as string}</p>{Boolean(r.editedAt) && <small className="text-muted-foreground">{uiText("Edited by platform")}</small>}
                      {(r.response as string) && uiText((<div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                          <span className="font-medium text-teal-700">{uiText("Tutor response:")}</span> {uiText(r.response as string)}
                        </div>))}
                    </CardContent>
                  </Card>))}
              </div>)}
          </section>
        </div>

        {/* Availability calendar */}
        <div>
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-teal-600"/>{uiText(" Availability")}</CardTitle>
              <p className="text-xs text-muted-foreground">{uiText("Times shown in your timezone (")}{uiText(myTz)})</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0} aria-label={uiText("Previous week")}><ChevronLeft className="h-4 w-4 flip-x"/></Button>
                <span className="text-sm font-medium text-foreground/90">{weekOffset === 0 ? uiText("This week") : uiText("+{{value1}} week{{value2}}", { value1: weekOffset, value2: weekOffset > 1 ? 's' : '' })}</span>
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset((w) => Math.min(4, w + 1))} aria-label={uiText("Next week")}><ChevronRight className="h-4 w-4 flip-x"/></Button>
              </div>
              {slotsLoading ? uiText((<div className="flex items-center justify-center py-10 text-muted-foreground/70"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>{uiText(" Loading slots\u2026")}</div>)) : byDate.length === 0 ? uiText((<p className="py-10 text-center text-sm text-muted-foreground/70">{uiText("No open slots this week. Try the next week.")}</p>)) : uiText((<div className="mt-3 space-y-4">
                  {uiText(byDate.map(([date, daySlots]) => (<div key={date}>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {uiText(new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }))}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {uiText(daySlots.map((s) => (<button key={s.startUtc} onClick={() => setSelected(s)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selected?.startUtc === s.startUtc
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-border bg-card text-foreground/90 hover:border-teal-400 hover:text-teal-700'}`}>
                            {uiText(new Date(s.startUtc).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: myTz }))}
                          </button>)))}
                      </div>
                    </div>)))}
                </div>))}
              {selected && uiText((<Button className="mt-5 w-full bg-teal-600 hover:bg-teal-700" onClick={() => { void openBooking(); }}>{uiText("Continue with ")}{uiText(new Date(selected.startUtc).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: myTz }))}
                </Button>))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Checkout dialog */}
      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{isTrial ? uiText("Book trial lesson") : uiText("Confirm your booking")}</DialogTitle>
            <DialogDescription>{uiText("With ")}{name} · {selected ? uiText(formatInTz(new Date(selected.startUtc), myTz)) : uiText("no slot selected")}
            </DialogDescription>
          </DialogHeader>
          {!selected ? uiText((<p className="text-sm text-muted-foreground">{uiText("Pick a time slot from the calendar first.")}</p>)) : (<div className="space-y-4">
              <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">{uiText("How would you like to meet?")}</legend><RadioGroup value={lessonFormat} onValueChange={(value) => setLessonFormat(value as 'ONLINE' | 'FACE_TO_FACE')} className="grid grid-cols-2 gap-2">{tutor.onlineEnabled !== false && <label className="flex min-h-14 items-center gap-2 rounded-xl border p-3 text-sm"><RadioGroupItem value="ONLINE"/>{uiText("Online")}</label>}{tutor.faceToFaceEnabled === true && <label className="flex min-h-14 items-center gap-2 rounded-xl border p-3 text-sm"><RadioGroupItem value="FACE_TO_FACE"/>{uiText("Face to face")}</label>}</RadioGroup></fieldset>
              {lessonFormat === 'FACE_TO_FACE' && <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 text-sm font-medium">{uiText("Private appointment details")}</legend><p className="text-xs text-muted-foreground">{uiText("Only administrators can see these details. They will coordinate arrangements with you.")}</p><label className="block space-y-1 text-xs">{uiText("Phone number")}<Input type="tel" autoComplete="tel" value={privateDetails.phone} maxLength={40} onChange={(e) => setPrivateDetails((v) => ({ ...v, phone: e.target.value }))}/></label><label className="block space-y-1 text-xs">{uiText("Email address")}<Input type="email" autoComplete="email" value={privateDetails.email} maxLength={254} onChange={(e) => setPrivateDetails((v) => ({ ...v, email: e.target.value }))}/></label><label className="block space-y-1 text-xs">{uiText("Full address / meeting location")}<Textarea value={privateDetails.location} maxLength={1000} onChange={(e) => setPrivateDetails((v) => ({ ...v, location: e.target.value }))} rows={2}/></label></fieldset>}
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <p className="font-medium text-foreground">{uiText(new Date(selected.startUtc).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: myTz }))}</p>
                <p className="text-muted-foreground">{uiText(new Date(selected.startUtc).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: myTz }))} – {uiText(new Date(selected.endUtc).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: myTz }))} ({uiText(myTz)})</p>
              </div>
              <div>
                <Label className="text-sm">{uiText("Lesson type")}</Label>
                <RadioGroup value={isTrial ? 'trial' : 'regular'} onValueChange={(v) => setIsTrial(v === 'trial')} className="mt-2">
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${isTrial ? 'border-primary bg-primary/10' : ''}`}>
                    <RadioGroupItem value="trial"/> <span className="text-sm">{uiText("First trial \u2014 ")}<strong>{uiText("Free")}</strong></span>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${!isTrial ? 'border-primary bg-primary/10' : ''}`}>
                    <RadioGroupItem value="regular"/> <span className="text-sm">{uiText("Full lesson \u2014 ")}<strong>{uiText(fmt(tutor.hourlyRateCents as number))}</strong></span>
                  </label>
                </RadioGroup>
              </div>
              {!isTrial && <div>
                <Label className="text-sm">{uiText("Payment method")}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{uiText("Full lessons require administrator payment approval.")}</p>
                <RadioGroup value={payWith} onValueChange={(v) => setPayWith(v as typeof payWith)} className="mt-2 space-y-2">
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${payWith === 'WALLET' ? 'border-primary bg-primary/10' : ''}`}>
                    <RadioGroupItem value="WALLET"/>
                    <Wallet className="h-4 w-4 text-teal-600"/>
                    <span className="text-sm">{uiText("Wallet credits ")}<span className="text-muted-foreground/70">({uiText(fmt(user?.walletCents ?? 0))}{uiText(" available)")}</span></span>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${payWith === 'CREDIT' ? 'border-primary bg-primary/10' : ''} ${!hasCredits ? 'opacity-50' : ''}`}>
                    <RadioGroupItem value="CREDIT" disabled={!hasCredits}/>
                    <Package className="h-4 w-4 text-amber-500"/>
                    <span className="text-sm">{uiText("Lesson package credit")}</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><RadioGroupItem value="BANK_TRANSFER"/>{uiText("Bank transfer")}</label>
                  <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><RadioGroupItem value="CASH"/>{uiText("Cash / pay through administrator")}</label>
                </RadioGroup>
                {payWith === 'BANK_TRANSFER' && <label className="mt-3 block space-y-2 text-xs">{uiText("Transfer reference")}<Input value={privateDetails.paymentReference} maxLength={200} placeholder={uiText("Reference from your bank receipt")} onChange={(e) => setPrivateDetails((v) => ({ ...v, paymentReference: e.target.value }))}/><span className="block text-muted-foreground">{uiText("Use payment details supplied by the administrator. Your reference will be verified before approval.")}</span></label>}
              {payWith === 'CREDIT' && hasCredits && uiText((<Select value={creditId || credits[0]?.id} onValueChange={setCreditId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {uiText(credits.map((c) => (<SelectItem key={c.id} value={c.id}>{c.note || uiText("Package")} — {uiText(c.remaining)}/{uiText(c.total)}{uiText(" left")}</SelectItem>)))}
                  </SelectContent>
                </Select>))}
              <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-muted-foreground"><CreditCard className="h-3.5 w-3.5"/>{uiText(" Card payments (Stripe, PayPal, Paystack)")}</p>
                <p className="mt-1">{uiText("Online card checkout is not configured. Wallet, package, bank transfer and admin-coordinated cash payments are available.")}</p>
              </div>
            </div>}
              {isTrial && <p className="rounded-xl bg-primary/10 p-3 text-sm">{uiText("No payment is needed for your first trial with this teacher.")}</p>}
              <div>
                <Label htmlFor="notes" className="text-sm">{uiText("Note to the tutor (optional)")}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={uiText("Tell the tutor about your goals\u2026")} rows={2}/>
              </div>
              {!isTrial && payWith === 'WALLET' && (user?.walletCents ?? 0) < price && uiText((<div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">{uiText("Not enough wallet balance (")}{uiText(fmt(user?.walletCents ?? 0))}{uiText(" of ")}{uiText(fmt(price))}).
                  <Button size="sm" variant="outline" className="ml-2" onClick={() => go('packages')}>{uiText("Top up / packages")}</Button>
                </div>))}
              <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700" onClick={confirmBooking} disabled={booking || (!isTrial && ((payWith === 'WALLET' && (user?.walletCents ?? 0) < price) || (payWith === 'CREDIT' && !creditId && !hasCredits) || (payWith === 'BANK_TRANSFER' && !privateDetails.paymentReference.trim()))) || (lessonFormat === 'FACE_TO_FACE' && (!privateDetails.phone.trim() || !privateDetails.email.trim() || !privateDetails.location.trim()))}>
                {booking && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {isTrial ? uiText("Confirm free trial") : uiText("Submit for approval \u00B7 {{value1}}", { value1: fmt(price) })}
              </Button>
            </div>)}
        </DialogContent>
      </Dialog>
    </div>);
}
function firstSubjectId(tutor: Record<string, unknown> | null): string | undefined {
    const subjects = tutor?.subjects as {
        id: string;
    }[] | undefined;
    return subjects?.[0]?.id;
}
