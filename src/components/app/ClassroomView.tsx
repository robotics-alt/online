'use client';
import { uiText } from "@/lib/ui-text";
/**
 * ClassroomView — live 1-to-1 video classroom for TutorSphere.
 *
 * Native WebRTC (getUserMedia + RTCPeerConnection) over socket.io signaling,
 * a synchronized normalized-coordinate whiteboard and an in-class chat.
 */
import { tuneClassroomSenders } from '@/lib/classroom-media';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ArrowLeft, LockKeyhole, LockKeyholeOpen, Circle, Clock, Eraser, Info, Loader2, Maximize, MessageSquare, Mic, MicOff, Minimize, Minus, MonitorUp, MonitorX, Pencil, Plus, PhoneOff, RefreshCw, SendHorizontal, Square, Trash2, Type, Undo2, Users, Video, VideoOff, Gamepad2, } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, ApiFail, useApp } from '@/lib/store';
import { getRealtimeUrl } from '@/lib/realtime-url';
import { mergeMessages } from '@/lib/chat-messages';
import { useCallRingtone } from '@/hooks/use-call-ringtone';
import type { BoardAccess } from '@/lib/whiteboard-policy';
import TeacherGamePicker from './TeacherGamePicker';
import './student-experience.css';
import './platform-upgrades.css';
import BoardPagesToolbar from './BoardPagesToolbar';
import { emptyBoard, type BoardDocument, type BoardPage } from '@/lib/board-document';
import { exportBoard } from '@/lib/board-export';
import { uploadMedia, type UploadedAsset } from '@/lib/media-client';
import type { LessonCall } from '@/lib/lesson-calls';
import { useToast } from '@/hooks/use-toast';
import GameCenter from '../games/GameCenter';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WBTool = 'pen' | 'line' | 'rect' | 'ellipse' | 'text' | 'eraser';
interface Stroke {
    id: string;
    tool: 'pen' | 'line' | 'rect' | 'ellipse' | 'text';
    color: string;
    width: number;
    points: [
        number,
        number
    ][];
    text?: string;
}
interface TextBoxState {
    x: number;
    y: number;
    value: string;
}
interface PeerInfo {
    socketId: string;
    userId: string;
    name: string;
    role: string;
}
interface ChatMsg {
    id: string;
    name: string;
    role: string;
    imageUrl?: string;
    body: string;
    at: number;
    mine: boolean;
}
type MediaStatus = 'pending' | 'full' | 'audio' | 'denied' | 'none';
type Quality = 'good' | 'weak' | 'poor' | 'unknown';
type Phase = 'loading' | 'error' | 'countdown' | 'ready';
interface TokenInfo {
    token: string;
    roomId: string;
    role: 'tutor' | 'student';
    startsAt: string;
    endsAt: string;
    lessonLabel: string;
    groupClassId?: string;
    call?: LessonCall | null;
}
interface PeerEntry {
    pc: RTCPeerConnection;
    canNegotiate: boolean;
    makingOffer: boolean;
    ignoreOffer: boolean;
    cleanup: () => void;
    pendingIce: RTCIceCandidateInit[];
}
interface RemoteTile {
    sid: string;
    stream: MediaStream;
}
interface StatLike {
    type?: string;
    kind?: string;
    state?: string;
    packetsLost?: number;
    packetsReceived?: number;
    currentRoundTripTime?: number;
}
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ICE_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};
const WB_COLORS = ['#1c1917', '#dc2626', '#0d9488', '#d97706', '#78716c'];
const TOOLS: {
    id: WBTool;
    label: string;
    icon: LucideIcon;
}[] = [
    { id: 'pen', label: 'Pen', icon: Pencil },
    { id: 'line', label: 'Line', icon: Minus },
    { id: 'rect', label: 'Rectangle', icon: Square },
    { id: 'ellipse', label: 'Ellipse', icon: Circle },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
];
// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pad2 = (n: number) => String(n).padStart(2, '0');
function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        return crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function fmtHMS(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
}
function fmtMS(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}
function fmtTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    catch {
        return '';
    }
}
function asObj(v: unknown): Record<string, unknown> | null {
    if (typeof v === 'object' && v !== null && !Array.isArray(v))
        return v as Record<string, unknown>;
    return null;
}
function asString(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
}
function parsePeerInfo(raw: unknown): PeerInfo | null {
    const o = asObj(raw);
    if (!o)
        return null;
    const socketId = asString(o.socketId);
    if (!socketId)
        return null;
    return { socketId, userId: asString(o.userId), name: asString(o.name, 'Participant'), role: asString(o.role, 'student') };
}
function parseDesc(v: unknown): RTCSessionDescriptionInit | null {
    const o = asObj(v);
    if (!o)
        return null;
    const type = o.type;
    const sdp = o.sdp;
    if ((type === 'offer' || type === 'answer' || type === 'pranswer' || type === 'rollback') && typeof sdp === 'string') {
        return { type, sdp };
    }
    return null;
}
function parseIce(v: unknown): RTCIceCandidateInit | null {
    const o = asObj(v);
    if (!o || typeof o.candidate !== 'string')
        return null;
    return {
        candidate: o.candidate,
        sdpMLineIndex: typeof o.sdpMLineIndex === 'number' ? o.sdpMLineIndex : null,
        sdpMid: typeof o.sdpMid === 'string' ? o.sdpMid : null,
        usernameFragment: typeof o.usernameFragment === 'string' ? o.usernameFragment : null,
    };
}
function coerceStroke(o: Record<string, unknown>): Stroke | null {
    const tool = o.tool;
    if (tool !== 'pen' && tool !== 'line' && tool !== 'rect' && tool !== 'ellipse' && tool !== 'text')
        return null;
    if (!Array.isArray(o.points) || o.points.length === 0)
        return null;
    const points: [
        number,
        number
    ][] = [];
    for (const raw of o.points) {
        if (Array.isArray(raw) && typeof raw[0] === 'number' && typeof raw[1] === 'number') {
            points.push([clamp01(raw[0]), clamp01(raw[1])]);
        }
    }
    if (points.length === 0)
        return null;
    return {
        id: asString(o.id) || genId(),
        tool,
        color: asString(o.color, '#1c1917'),
        width: typeof o.width === 'number' && Number.isFinite(o.width) ? Math.min(24, Math.max(1, o.width)) : 3,
        points,
        text: asString(o.text) || undefined,
    };
}
function coerceStrokes(input: unknown): Stroke[] {
    if (!Array.isArray(input))
        return [];
    const out: Stroke[] = [];
    for (const raw of input) {
        const o = asObj(raw);
        if (!o)
            continue;
        const s = coerceStroke(asObj(o.stroke) ?? o);
        if (s)
            out.push(s);
    }
    return out;
}
function parseStroke(raw: unknown): Stroke | null {
    const o = asObj(raw);
    if (!o)
        return null;
    return coerceStroke(asObj(o.stroke) ?? o);
}
/** Draw a stroke in CSS-pixel space (ctx is already DPR-scaled). */
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number): void {
    const pts = s.points;
    if (pts.length === 0)
        return;
    const X = (v: number) => v * w;
    const Y = (v: number) => v * h;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(1, s.width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (s.tool) {
        case 'pen': {
            ctx.beginPath();
            ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
            for (let i = 1; i < pts.length; i++)
                ctx.lineTo(X(pts[i][0]), Y(pts[i][1]));
            if (pts.length === 1)
                ctx.lineTo(X(pts[0][0]) + 0.01, Y(pts[0][1]) + 0.01);
            ctx.stroke();
            break;
        }
        case 'line': {
            if (pts.length < 2)
                return;
            ctx.beginPath();
            ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
            ctx.lineTo(X(pts[pts.length - 1][0]), Y(pts[pts.length - 1][1]));
            ctx.stroke();
            break;
        }
        case 'rect': {
            if (pts.length < 2)
                return;
            const x = Math.min(X(pts[0][0]), X(pts[1][0]));
            const y = Math.min(Y(pts[0][1]), Y(pts[1][1]));
            const rw = Math.abs(X(pts[1][0]) - X(pts[0][0]));
            const rh = Math.abs(Y(pts[1][1]) - Y(pts[0][1]));
            ctx.strokeRect(x, y, rw, rh);
            break;
        }
        case 'ellipse': {
            if (pts.length < 2)
                return;
            const cx = (X(pts[0][0]) + X(pts[1][0])) / 2;
            const cy = (Y(pts[0][1]) + Y(pts[1][1])) / 2;
            const rx = Math.max(Math.abs(X(pts[1][0]) - X(pts[0][0])) / 2, 0.5);
            const ry = Math.max(Math.abs(Y(pts[1][1]) - Y(pts[0][1])) / 2, 0.5);
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'text': {
            if (!s.text)
                return;
            const size = Math.max(14, s.width * 4);
            ctx.font = `500 ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(s.text, X(pts[0][0]), Y(pts[0][1]));
            break;
        }
    }
}
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function hitTestStroke(s: Stroke, px: number, py: number, w: number, h: number, threshold: number): boolean {
    const P = s.points.map(([x, y]) => ({ x: x * w, y: y * h }));
    if (P.length === 0)
        return false;
    if (s.tool === 'text') {
        if (!s.text)
            return false;
        const size = Math.max(14, s.width * 4);
        const tw = s.text.length * size * 0.55;
        const th = size * 1.2;
        return px >= P[0].x - 6 && px <= P[0].x + tw + 6 && py >= P[0].y - th / 2 - 6 && py <= P[0].y + th / 2 + 6;
    }
    const segs: [
        number,
        number,
        number,
        number
    ][] = [];
    if (s.tool === 'pen' || s.tool === 'line') {
        if (P.length === 1)
            segs.push([P[0].x, P[0].y, P[0].x, P[0].y]);
        for (let i = 1; i < P.length; i++)
            segs.push([P[i - 1].x, P[i - 1].y, P[i].x, P[i].y]);
    }
    else if (s.tool === 'rect') {
        if (P.length < 2)
            return false;
        const x1 = Math.min(P[0].x, P[1].x);
        const x2 = Math.max(P[0].x, P[1].x);
        const y1 = Math.min(P[0].y, P[1].y);
        const y2 = Math.max(P[0].y, P[1].y);
        segs.push([x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]);
    }
    else if (s.tool === 'ellipse') {
        if (P.length < 2)
            return false;
        const cx = (P[0].x + P[1].x) / 2;
        const cy = (P[0].y + P[1].y) / 2;
        const rx = Math.abs(P[1].x - P[0].x) / 2;
        const ry = Math.abs(P[1].y - P[0].y) / 2;
        const N = 28;
        for (let i = 0; i < N; i++) {
            const a1 = (i / N) * Math.PI * 2;
            const a2 = ((i + 1) / N) * Math.PI * 2;
            segs.push([cx + rx * Math.cos(a1), cy + ry * Math.sin(a1), cx + rx * Math.cos(a2), cy + ry * Math.sin(a2)]);
        }
    }
    const t = threshold + Math.max(1, s.width) / 2;
    return segs.some(([x1, y1, x2, y2]) => distToSegment(px, py, x1, y1, x2, y2) <= t);
}
function connectionBadge(state: string): {
    label: string;
    dot: string;
} {
    if (state === 'connected')
        return { label: 'Connected', dot: 'bg-emerald-500' };
    if (state === 'failed' || state === 'disconnected' || state === 'closed')
        return { label: 'Disconnected', dot: 'bg-red-500' };
    return { label: 'Connecting…', dot: 'bg-amber-500' };
}
// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function CenterShell({ children }: {
    children: ReactNode;
}) {
    return (<div className="grid min-h-svh place-items-center bg-muted p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>);
}
function LoadingScreen() {
    return (<CenterShell>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Loader2 className="size-7 animate-spin text-teal-700" aria-hidden/>
        <p className="text-sm font-medium text-foreground/90">{uiText("Connecting to classroom\u2026")}</p>
        <p className="text-xs text-muted-foreground">{uiText("Preparing your lesson room, camera and microphone.")}</p>
      </CardContent>
    </CenterShell>);
}
function ErrorScreen({ status, message, onRetry, onExit, }: {
    status: number;
    message: string;
    onRetry: () => void;
    onExit: () => void;
}) {
    const title = status === 401 ? 'Sign-in required' : status === 403 ? 'Access denied' : 'Cannot open the classroom';
    return (<CenterShell>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">{uiText(title)}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-11 flex-1 gap-2" onClick={onRetry}>
          <RefreshCw className="size-4"/>{uiText(" Try again")}</Button>
        <Button variant="outline" className="h-11 flex-1 gap-2" onClick={onExit}>
          <ArrowLeft className="size-4"/>{uiText(" Leave")}</Button>
      </CardContent>
    </CenterShell>);
}
function CountdownScreen({ message, retryIn, onRetryNow, onExit, }: {
    message: string;
    retryIn: number;
    onRetryNow: () => void;
    onExit: () => void;
}) {
    return (<CenterShell>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="size-5 text-amber-600" aria-hidden/>{uiText(" Classroom not open yet")}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground" role="status">{uiText("Retrying automatically in ")}<span className="font-mono font-semibold text-foreground/90">{uiText(retryIn)}{uiText("s")}</span>…
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-11 flex-1 gap-2" onClick={onRetryNow}>
            <RefreshCw className="size-4"/>{uiText(" Retry now")}</Button>
          <Button variant="outline" className="h-11 flex-1 gap-2" onClick={onExit}>
            <ArrowLeft className="size-4"/>{uiText(" Leave")}</Button>
        </div>
      </CardContent>
    </CenterShell>);
}
function QualityBadge({ q, rttMs }: {
    q: Quality | 'idle';
    rttMs: number | null;
}) {
    const cfg: Record<Quality | 'idle', {
        label: string;
        dot: string;
    }> = {
        good: { label: 'Good', dot: 'bg-emerald-500' },
        weak: { label: 'Weak', dot: 'bg-amber-500' },
        poor: { label: 'Poor', dot: 'bg-red-500' },
        unknown: { label: 'Checking…', dot: 'bg-stone-400' },
        idle: { label: 'Standby', dot: 'bg-stone-400' },
    };
    const c = cfg[q];
    return (<Badge variant="outline" className="hidden shrink-0 gap-1.5 sm:inline-flex" title={rttMs != null ? uiText("Round-trip \u2248 {{value1}} ms", { value1: Math.round(rttMs * 1000) }) : uiText("Connection quality")}>
      <span className={cn('size-2 rounded-full', c.dot)} aria-hidden/>
      {uiText(c.label)}
    </Badge>);
}
function RemoteVideo({ stream, name, state }: {
    stream: MediaStream;
    name: string;
    state: string;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [playbackBlocked, setPlaybackBlocked] = useState(false);
    useEffect(() => {
        const v = videoRef.current;
        if (v) {
            v.srcObject = stream;
            void v.play().catch(() => setPlaybackBlocked(true));
        }
    }, [stream]);
    const badge = connectionBadge(state);
    return (<div data-peer-state={state} className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-stone-950">
      <video ref={videoRef} autoPlay playsInline onPlaying={() => setPlaybackBlocked(false)} className="h-full w-full object-cover"/>
      {playbackBlocked && <Button className="absolute inset-0 m-auto w-fit" onClick={() => { void videoRef.current?.play().then(() => setPlaybackBlocked(false)).catch(() => { }); }}>{uiText("Play lesson audio and video")}</Button>}
      <div className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 rounded-full bg-stone-950/70 px-2.5 py-1 text-xs text-white backdrop-blur">
        <span className={cn('size-1.5 shrink-0 rounded-full', badge.dot)} aria-hidden/>
        <span className="truncate">{name}</span>
      </div>
    </div>);
}
function ParticipantRow({ name, role, state, isMe }: {
    name: string;
    role: string;
    state: string;
    isMe?: boolean;
}) {
    const badge = connectionBadge(state);
    const isTutor = role === 'tutor' || role === 'TUTOR';
    return (<li className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-9">
          <AvatarFallback className="bg-teal-700 text-xs font-semibold text-white">
            {uiText(name.slice(0, 2).toUpperCase())}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {name}
            {isMe ? uiText(" (you)") : ''}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', badge.dot)} aria-hidden/>
            {uiText(badge.label)}
          </p>
        </div>
      </div>
      <Badge variant="outline" className={cn(isTutor && 'border-amber-300 bg-amber-50 text-amber-800')}>
        {isTutor ? uiText("Tutor") : uiText("Student")}
      </Badge>
    </li>);
}
function ChatPanel({ messages, onSend, roomId, token }: {
    messages: ChatMsg[];
    onSend: (body: string, attachment?: UploadedAsset) => void;
    roomId: string;
    token: string;
}) {
    const [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState(''), imageInput = useRef<HTMLInputElement | null>(null);
    const [value, setValue] = useState('');
    const bottomRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
    }, [messages.length]);
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const body = value.trim();
        if (!body)
            return;
        onSend(body);
        setValue('');
    };
    return (<div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex w-full flex-col gap-3 p-3">
          {messages.length === 0 && uiText((<p className="py-8 text-center text-sm text-muted-foreground">{uiText("No messages yet \u2014 say hello to start the lesson.")}</p>))}
          {messages.map((m) => (<div key={m.id} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm', m.mine ? 'self-end bg-teal-700 text-white' : 'self-start bg-muted text-foreground')}>
              <div className={cn('flex items-center gap-1.5 text-[11px]', m.mine ? 'text-teal-100' : 'text-muted-foreground')}>
                <span className="font-semibold">{m.mine ? uiText("You") : m.name}</span>
                <span className={cn('rounded px-1 py-px text-[10px] font-medium uppercase tracking-wide', m.role === 'tutor' || m.role === 'TUTOR' ? 'bg-amber-200 text-amber-900' : 'bg-muted text-muted-foreground')}>
                  {m.role === 'tutor' || m.role === 'TUTOR' ? uiText("Tutor") : uiText("Student")}
                </span>
                <span>{uiText(fmtTime(m.at))}</span>
              </div>
              {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noreferrer"><img className="message-image mt-2" src={m.imageUrl} alt={uiText("Shared lesson image")}/></a>}
              {m.body && <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>}
            </div>))}
          <div ref={bottomRef} aria-hidden/>
        </div>
      </ScrollArea>
      <Separator />
      {uploadError && <p className="px-3 text-xs text-destructive" role="alert">{uiText(uploadError)}</p>}
      <form className="flex items-center gap-2 p-3" onSubmit={submit}>
        <input className="sr-only" ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file)
                return;
            setUploading(true);
            setUploadError('');
            try {
                onSend('', await uploadMedia(file, 'classroom', roomId, token));
            }
            catch (error) {
                setUploadError((error as Error).message);
            }
            finally {
                setUploading(false);
                event.target.value = '';
            }
        }}/>
        <Button className="lesson-image-upload" type="button" variant="ghost" size="icon" disabled={uploading} aria-label={uiText("Share lesson image")} onClick={() => imageInput.current?.click()}>{uploading ? <Loader2 className="animate-spin" size={16}/> : <Plus size={19}/>}</Button>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={uiText("Type a message\u2026")} aria-label={uiText("Chat message")} className="h-11 flex-1" maxLength={2000}/>
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={!value.trim()} aria-label={uiText("Send message")}>
          <SendHorizontal className="size-4"/>
        </Button>
      </form>
    </div>);
}
// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ClassroomView({ bookingId, callId, onExit }: {
    bookingId: string;
    callId?: string;
    onExit: () => void;
}) {
    const { toast } = useToast();
    const myName = useApp((s) => s.user?.name ?? 'You');
    const myUserId = useApp((s) => s.user?.id || '');
    const [mediaCapabilities, setMediaCapabilities] = useState<{
        secure: boolean;
        camera: boolean;
        screen: boolean;
    } | null>(null);
    useEffect(() => {
        setMediaCapabilities({ secure: window.isSecureContext, camera: Boolean(navigator.mediaDevices?.getUserMedia), screen: Boolean(navigator.mediaDevices?.getDisplayMedia) });
    }, []);
    // ---- session ----
    const [phase, setPhase] = useState<Phase>('loading');
    const [err, setErr] = useState<{
        status: number;
        message: string;
    } | null>(null);
    const [info, setInfo] = useState<TokenInfo | null>(null);
    const [callEndedReason, setCallEndedReason] = useState<string | null>(null);
    useCallRingtone(Boolean(info?.call && info.role === 'tutor' && !info.call.studentJoinedAt && !callEndedReason), info?.call?.deadline, true);
    const [boardAccess, setBoardAccess] = useState<BoardAccess>({ locked: true, studentId: null });
    const [boardExpanded, setBoardExpanded] = useState(false);
    const [boardTools, setBoardTools] = useState(true), [toolsActivity, setToolsActivity] = useState(0), [boardFit, setBoardFit] = useState<'width' | 'height' | 'normal'>('width');
    const [boardPan, setBoardPan] = useState(false);
    const toolSwipe = useRef(0), toolDragged = useRef(false);
    const revealBoardTools = () => { setBoardTools(true); setToolsActivity(value => value + 1); };
    useEffect(() => {
        if (!boardExpanded || !boardTools)
            return;
        const timer = setTimeout(() => {
            const active = document.activeElement;
            if (active?.matches('input,select,textarea'))
                return;
            setBoardTools(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, [boardExpanded, boardTools, toolsActivity]);
    const [boardJoined, setBoardJoined] = useState(false);
    const toggleBoardFullscreen = async () => {
        if (boardExpanded) {
            setBoardExpanded(false);
            if (document.fullscreenElement)
                await document.exitFullscreen().catch(() => { });
            return;
        }
        setBoardExpanded(true);
        revealBoardTools();
        try {
            await document.documentElement.requestFullscreen?.();
            const orientation = screen.orientation as ScreenOrientation & {
                lock?: (value: string) => Promise<void>;
            };
            await orientation.lock?.('landscape');
        }
        catch {
            if (window.matchMedia('(orientation: portrait)').matches)
                toast({ title: 'Board maximised', description: 'Rotate your phone for landscape view.' });
        }
    };
    useEffect(() => {
        const changed = () => {
            if (!document.fullscreenElement)
                setBoardExpanded(false);
        };
        document.addEventListener('fullscreenchange', changed);
        return () => { document.removeEventListener('fullscreenchange', changed); };
    }, []);
    useEffect(() => {
        if (!boardExpanded || phase !== 'ready')
            return;
        const previous = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        return () => { document.documentElement.style.overflow = previous; };
    }, [boardExpanded, phase]);
    const [boardStudentPicker, setBoardStudentPicker] = useState(false);
    const [boardPending, setBoardPending] = useState(false);
    const [gamePicker, setGamePicker] = useState(false);
    const [lessonGame, setLessonGame] = useState<{
        roomCode: string;
        gameSlug: string;
    } | null>(null);
    const canEditBoard = boardJoined && (info?.role === 'tutor' || !boardAccess.locked && boardAccess.studentId === myUserId);
    useEffect(() => {
        const exit = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setBoardExpanded(false);
        };
        window.addEventListener('keydown', exit);
        const accepted = (event: Event) => {
            const detail = (event as CustomEvent<{
                roomCode: string;
                gameSlug: string;
            }>).detail;
            if (detail?.roomCode) {
                setLessonGame(detail);
                setBrainBreak(5);
            }
        };
        window.addEventListener('lesson-game-accepted', accepted);
        return () => { window.removeEventListener('keydown', exit); window.removeEventListener('lesson-game-accepted', accepted); };
    }, []);
    const syncCall = useCallback((call: LessonCall) => {
        if (call.status === 'ended') {
            setCallEndedReason(call.endReason || 'hangup');
            return;
        }
        setInfo((previous) => {
            if (!previous || previous.call?.id !== call.id || JSON.stringify(previous.call) === JSON.stringify(call))
                return previous;
            const start = call.studentJoinedAt || call.createdAt;
            return { ...previous, call, startsAt: start, endsAt: new Date(Date.parse(start) + call.durationMin * 60000).toISOString() };
        });
    }, []);
    const [retryIn, setRetryIn] = useState(30);
    const [now, setNow] = useState(() => Date.now());
    const tokenRef = useRef<string>('');
    const tokenRequestRef = useRef<AbortController | null>(null);
    const joinedAtRef = useRef(0);
    const leftRef = useRef(false);
    // ---- media ----
    const [mediaStatus, setMediaStatus] = useState<MediaStatus>('pending');
    const [mediaSlow, setMediaSlow] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [deviceList, setDeviceList] = useState<{
        cams: MediaDeviceInfo[];
        mics: MediaDeviceInfo[];
    }>({ cams: [], mics: [] });
    const [selectedCamId, setSelectedCamId] = useState('');
    const [selectedMicId, setSelectedMicId] = useState('');
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const selfVideoRef = useRef<HTMLVideoElement | null>(null);
    const videoAreaRef = useRef<HTMLDivElement | null>(null);
    // ---- connection / peers ----
    const socketRef = useRef<Socket | null>(null);
    const pcsRef = useRef<Map<string, PeerEntry>>(new Map());
    const mySocketIdRef = useRef('');
    const joinedOnceRef = useRef(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [everConnected, setEverConnected] = useState(false);
    const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
    const remoteMediaRef = useRef<Map<string, MediaStream>>(new Map());
    const [peers, setPeers] = useState<PeerInfo[]>([]);
    const [remoteStreams, setRemoteStreams] = useState<RemoteTile[]>([]);
    const [peerStates, setPeerStates] = useState<Record<string, string>>({});
    const [qualityMap, setQualityMap] = useState<Record<string, {
        quality: Quality;
        rtt: number | null;
    }>>({});
    // ---- chat ----
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [seenCount, setSeenCount] = useState(0);
    // ---- participants dialog / fullscreen / mobile tab ----
    const [partsOpen, setPartsOpen] = useState(false);
    const [brainBreak, setBrainBreak] = useState<number | null>(null);
    const [breakLeft, setBreakLeft] = useState(0);
    useEffect(() => {
        if (brainBreak === null)
            return;
        setBreakLeft(brainBreak * 60);
        const t = setInterval(() => setBreakLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
        return () => clearInterval(t);
    }, [brainBreak]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mobileTab, setMobileTab] = useState<'video' | 'board'>('video');
    // ---- whiteboard ----
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const [boardDocument, setBoardDocument] = useState<BoardDocument>(emptyBoard);
    const boardDocumentRef = useRef<BoardDocument>(emptyBoard());
    const backgroundImageRef = useRef<HTMLImageElement | null>(null);
    const [exitConfirm, setExitConfirm] = useState(false);
    const [exporting, setExporting] = useState(false);
    const draftRef = useRef<Stroke | null>(null);
    const drawingRef = useRef(false);
    const textBoxRef = useRef<TextBoxState | null>(null);
    const defaultPenColor = useApp.getState().user?.role === 'TUTOR' ? '#0d9488' : '#dc2626';
    const colorRef = useRef(defaultPenColor), roleColorSet = useRef(false);
    const widthRef = useRef(3);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [tool, setTool] = useState<WBTool>('pen');
    const [color, setColor] = useState(defaultPenColor);
    useEffect(() => {
        if (info?.role && !roleColorSet.current) {
            roleColorSet.current = true;
            const next = info.role === 'tutor' ? '#0d9488' : '#dc2626';
            colorRef.current = next;
            setColor(next);
        }
    }, [info?.role]);
    const [width, setWidth] = useState(3);
    const [textBox, setTextBoxState] = useState<TextBoxState | null>(null);
    const setTextBox = useCallback((tb: TextBoxState | null) => {
        textBoxRef.current = tb;
        setTextBoxState(tb);
    }, []);
    useEffect(() => {
        colorRef.current = color;
    }, [color]);
    useEffect(() => {
        widthRef.current = width;
    }, [width]);
    // ---------------------------------------------------------------------
    // Whiteboard state helpers
    // ---------------------------------------------------------------------
    const applyStrokes = useCallback((next: Stroke[]) => {
        strokesRef.current = next;
        const page = boardDocumentRef.current.pages.find(page => page.id === boardDocumentRef.current.activePageId);
        if (page)
            page.strokes = next;
        setStrokes(next);
    }, []);
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx)
            return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fafaf9';
        ctx.fillRect(0, 0, w, h);
        if (backgroundImageRef.current)
            ctx.drawImage(backgroundImageRef.current, 0, 0, w, h);
        for (const s of strokesRef.current)
            drawStroke(ctx, s, w, h);
        const draft = draftRef.current;
        if (draft)
            drawStroke(ctx, draft, w, h);
    }, []);
    useEffect(() => {
        strokesRef.current = strokes;
        redraw();
    }, [strokes, redraw]);
    const applyBoardDocument = useCallback((document: BoardDocument) => {
        if (!document?.pages?.length)
            return;
        boardDocumentRef.current = document;
        setBoardDocument(document);
        draftRef.current = null;
        drawingRef.current = false;
        setTextBox(null);
        const page = document.pages.find(page => page.id === document.activePageId) || document.pages[0];
        applyStrokes(coerceStrokes(page.strokes));
        backgroundImageRef.current = null;
        if (page.background) {
            const image = new Image();
            image.onload = () => {
                if (boardDocumentRef.current.activePageId === page.id) {
                    backgroundImageRef.current = image;
                    redraw();
                }
            };
            image.src = page.background;
        }
        else
            redraw();
    }, [applyStrokes, redraw, setTextBox]);
    // Resize the canvas to its container (devicePixelRatio aware).
    useEffect(() => {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas)
            return;
        const resize = () => {
            const rect = wrap.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2)
                return;
            const dpr = window.devicePixelRatio || 1;
            const w = Math.round(rect.width * dpr);
            const h = Math.round(rect.height * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            redraw();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);
        return () => ro.disconnect();
    }, [redraw, phase, boardDocument.activePageId]);
    const commitText = useCallback((tb: TextBoxState | null) => {
        setTextBox(null);
        if (!canEditBoard || !tb || !tb.value.trim())
            return;
        const stroke: Stroke = {
            id: genId(),
            tool: 'text',
            color: colorRef.current,
            width: widthRef.current,
            points: [[tb.x, tb.y]],
            text: tb.value,
        };
        applyStrokes([...strokesRef.current, stroke]);
        socketRef.current?.emit('wb_stroke', { stroke, pageId: boardDocumentRef.current.activePageId });
    }, [applyStrokes, setTextBox, canEditBoard]);
    const eraseAt = useCallback((p: [
        number,
        number
    ]) => {
        if (!canEditBoard)
            return;
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const px = p[0] * rect.width;
        const py = p[1] * rect.height;
        const list = strokesRef.current;
        let hitIdx = -1;
        for (let i = list.length - 1; i >= 0; i--) {
            if (hitTestStroke(list[i], px, py, rect.width, rect.height, 12)) {
                hitIdx = i;
                break;
            }
        }
        if (hitIdx === -1)
            return;
        const next = list.filter((_, i) => i !== hitIdx);
        applyStrokes(next);
        // Sync the removal: clear then re-broadcast the remaining strokes.
        const socket = socketRef.current;
        if (!socket)
            return;
        socket.emit('wb_clear', { pageId: boardDocumentRef.current.activePageId });
        for (const s of next)
            socket.emit('wb_stroke', { stroke: s, pageId: boardDocumentRef.current.activePageId });
    }, [applyStrokes, canEditBoard]);
    const normPoint = (e: React.PointerEvent<HTMLCanvasElement>): [
        number,
        number
    ] => {
        const rect = e.currentTarget.getBoundingClientRect();
        return [clamp01((e.clientX - rect.left) / rect.width), clamp01((e.clientY - rect.top) / rect.height)];
    };
    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canEditBoard)
            return;
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        const p = normPoint(e);
        if (tool === 'text') {
            setTextBox({ x: Math.min(p[0], 0.72), y: p[1], value: '' });
            return;
        }
        if (tool === 'eraser') {
            eraseAt(p);
            return;
        }
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        catch {
            /* noop */
        }
        drawingRef.current = true;
        draftRef.current = { id: genId(), tool, color, width, points: tool === 'pen' ? [p] : [p, p] };
        redraw();
    };
    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canEditBoard)
            return;
        const draft = draftRef.current;
        if (!drawingRef.current || !draft)
            return;
        const p = normPoint(e);
        if (draft.tool === 'pen')
            draft.points.push(p);
        else if (draft.points.length >= 2)
            draft.points[1] = p;
        redraw();
    };
    const onPointerUp = () => {
        if (!canEditBoard) {
            drawingRef.current = false;
            draftRef.current = null;
            return;
        }
        const draft = draftRef.current;
        drawingRef.current = false;
        draftRef.current = null;
        if (!draft)
            return;
        if (draft.tool === 'pen' && draft.points.length < 2 && draft.points[0]) {
            draft.points.push([draft.points[0][0] + 0.002, draft.points[0][1] + 0.002]);
        }
        applyStrokes([...strokesRef.current, draft]);
        socketRef.current?.emit('wb_stroke', { stroke: draft, pageId: boardDocumentRef.current.activePageId });
    };
    const undoStroke = () => {
        if (!canEditBoard)
            return;
        applyStrokes(strokesRef.current.slice(0, -1));
        socketRef.current?.emit('wb_undo', { pageId: boardDocumentRef.current.activePageId });
    };
    const clearBoard = () => {
        if (!canEditBoard)
            return;
        applyStrokes([]);
        socketRef.current?.emit('wb_clear', { pageId: boardDocumentRef.current.activePageId });
    };
    // ---------------------------------------------------------------------
    // Token / attendance
    // ---------------------------------------------------------------------
    const loadToken = useCallback(async () => {
        tokenRequestRef.current?.abort();
        const controller = new AbortController();
        tokenRequestRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        setPhase('loading');
        setErr(null);
        try {
            const data = await api<TokenInfo>(bookingId.startsWith('group:') ? `/api/group-classes/${bookingId.slice(6)}/token` : `/api/classroom/${bookingId}/token${callId ? '?callId=' + encodeURIComponent(callId) : ''}`, { signal: controller.signal });
            if (tokenRequestRef.current !== controller)
                return;
            tokenRef.current = data.token;
            joinedAtRef.current = Date.now();
            setInfo(data);
            setPhase('ready');
            if (!bookingId.startsWith('group:'))
                void api(`/api/classroom/${bookingId}/attendance`, { method: 'POST', json: { event: 'join' } }).catch(() => { });
        }
        catch (e) {
            if (tokenRequestRef.current !== controller)
                return;
            const status = controller.signal.aborted ? 408 : e instanceof ApiFail ? e.status : 0;
            const message = controller.signal.aborted ? 'Opening the classroom timed out. Check your connection and try again.' : e instanceof Error ? e.message : 'Something went wrong while opening the classroom.';
            setErr({ status, message });
            setPhase(status === 423 ? 'countdown' : 'error');
        }
        finally {
            window.clearTimeout(timeout);
        }
    }, [bookingId, callId]);
    useEffect(() => {
        void loadToken();
        return () => { const request = tokenRequestRef.current; tokenRequestRef.current = null; request?.abort(); };
    }, [loadToken]);
    // 423 → show countdown and auto-retry every 30s.
    useEffect(() => {
        if (phase !== 'countdown')
            return;
        setRetryIn(30);
        const t = window.setInterval(() => setRetryIn((v) => (v > 0 ? v - 1 : 0)), 1000);
        return () => window.clearInterval(t);
    }, [phase]);
    useEffect(() => {
        if (phase === 'countdown' && retryIn === 0)
            void loadToken();
    }, [phase, retryIn, loadToken]);
    // Lesson clock.
    useEffect(() => {
        if (phase !== 'ready')
            return;
        setNow(Date.now());
        const t = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(t);
    }, [phase]);
    const leave = useCallback(() => {
        if (document.fullscreenElement)
            void document.exitFullscreen().catch(() => { });
        leftRef.current = true;
        if (info?.role === 'student' && info.call?.id)
            useApp.getState().setPostCallReviewId(info.call.id);
        if (info?.role === 'tutor' && !info.call && !callEndedReason)
            void api('/api/classrooms/end', { method: 'POST', json: { token: tokenRef.current }, keepalive: true }).catch(() => { });
        if (info?.call?.id && !callEndedReason)
            void api(`/api/lesson-calls/${info.call.id}`, { method: 'PATCH', json: { action: 'end' } }).catch(() => { });
        if (joinedAtRef.current > 0) {
            const seconds = Math.max(0, Math.round((Date.now() - joinedAtRef.current) / 1000));
            if (!bookingId.startsWith('group:'))
                void api(`/api/classroom/${bookingId}/attendance`, { method: 'POST', json: { event: 'leave', seconds } }).catch(() => { });
        }
        onExit();
    }, [bookingId, info?.call?.id, info?.role, callEndedReason, onExit]);
    useEffect(() => {
        if (!info?.call?.id)
            return;
        let cancelled = false;
        let checking = false;
        const check = async () => {
            if (checking)
                return;
            checking = true;
            try {
                const data = await api<{
                    call: LessonCall;
                }>(`/api/lesson-calls/${info.call!.id}`);
                if (!cancelled)
                    syncCall(data.call);
            }
            catch { /* socket updates continue during brief API failures */ }
            finally {
                checking = false;
            }
        };
        const timer = window.setInterval(check, 2000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [info?.call?.id, syncCall]);
    useEffect(() => {
        if (!callEndedReason || leftRef.current)
            return;
        toast({ title: callEndedReason === 'no_answer' ? 'No answer — call ended' : callEndedReason === 'declined' ? 'The student declined the call' : 'Call ended', description: callEndedReason === 'no_answer' ? 'The student did not join within 15 minutes. The scheduled booking is still available.' : undefined });
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        for (const peer of pcsRef.current.values())
            peer.pc.close();
    }, [callEndedReason, leave, toast]);
    // Fire-and-forget attendance leave on unmount (sendBeacon can't send cookies).
    useEffect(() => {
        return () => {
            if (joinedAtRef.current <= 0 || leftRef.current)
                return;
            const seconds = Math.max(0, Math.round((Date.now() - joinedAtRef.current) / 1000));
            if (!bookingId.startsWith('group:'))
                void api(`/api/classroom/${bookingId}/attendance`, { method: 'POST', json: { event: 'leave', seconds } }).catch(() => { });
        };
    }, [bookingId]);
    // ---------------------------------------------------------------------
    // Local media
    // ---------------------------------------------------------------------
    const applyLocalStream = useCallback((s: MediaStream) => {
        localStreamRef.current = s;
        setLocalStream(s);
    }, []);
    // Join the room before permissions resolve, then attach media to the existing
    // connection. Camera prompts must not hold the entire classroom offline.
    useEffect(() => {
        if (!localStream)
            return;
        for (const entry of pcsRef.current.values())
            for (const track of localStream.getTracks()) {
                if (entry.pc.signalingState === 'closed' || !entry.canNegotiate && !entry.pc.remoteDescription)
                    continue;
                const transceiver = entry.pc.getTransceivers().find(t => t.receiver.track.kind === track.kind);
                const desired = track.kind === 'video' && screenTrackRef.current ? screenTrackRef.current : track;
                if (transceiver) {
                    transceiver.direction = 'sendrecv';
                    if (transceiver.sender.track !== desired)
                        void transceiver.sender.replaceTrack(desired).catch(() => toast({ title: 'Could not enable media', description: 'Try selecting the camera or microphone again.', variant: 'destructive' }));
                }
                else
                    entry.pc.addTrack(desired, localStream);
            }
    }, [localStream, toast]);
    useEffect(() => {
        setMediaSlow(false);
        if (mediaStatus !== 'pending')
            return;
        const timer = window.setTimeout(() => setMediaSlow(true), 12000);
        return () => window.clearTimeout(timer);
    }, [mediaStatus]);
    const refreshDevices = useCallback(async () => {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const cams = list.filter((d) => d.kind === 'videoinput');
            const mics = list.filter((d) => d.kind === 'audioinput');
            setDeviceList({ cams, mics });
            setSelectedCamId((prev) => prev || cams[0]?.deviceId || '');
            setSelectedMicId((prev) => prev || mics[0]?.deviceId || '');
        }
        catch {
            /* ignore */
        }
    }, []);
    useEffect(() => {
        if (phase !== 'ready' || mediaStatus !== 'pending')
            return;
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setMediaStatus('denied');
            return;
        }
        let cancelled = false;
        const run = async () => {
            try {
                const full = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
                if (cancelled) {
                    full.getTracks().forEach((t) => t.stop());
                    return;
                }
                applyLocalStream(full);
                setMicOn(true);
                setCamOn(true);
                setMediaStatus('full');
                void refreshDevices();
            }
            catch {
                if (cancelled)
                    return;
                try {
                    const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (cancelled) {
                        audio.getTracks().forEach((t) => t.stop());
                        return;
                    }
                    applyLocalStream(audio);
                    setMicOn(true);
                    setMediaStatus('audio');
                    void refreshDevices();
                    toast({
                        title: 'Joined with microphone only',
                        description: 'Camera access was not granted, but audio still works.',
                    });
                }
                catch {
                    if (!cancelled)
                        setMediaStatus('denied');
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [phase, mediaStatus, applyLocalStream, refreshDevices, toast]);
    // Never leave orphan tracks behind.
    useEffect(() => {
        return () => {
            localStreamRef.current?.getTracks().forEach((t) => {
                try {
                    t.stop();
                }
                catch {
                    /* noop */
                }
            });
            localStreamRef.current = null;
            screenStreamRef.current?.getTracks().forEach((t) => {
                try {
                    t.stop();
                }
                catch {
                    /* noop */
                }
            });
            screenStreamRef.current = null;
            screenTrackRef.current = null;
        };
    }, []);
    useEffect(() => {
        const v = selfVideoRef.current;
        if (v)
            v.srcObject = screenStream ?? localStream;
    }, [screenStream, localStream]);
    const stopScreenShare = useCallback(async () => {
        const track = screenTrackRef.current;
        const display = screenStreamRef.current;
        screenTrackRef.current = null;
        screenStreamRef.current = null;
        setScreenStream(null);
        const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        for (const [, entry] of pcsRef.current) {
            const sender = entry.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
            if (sender) {
                try {
                    await sender.replaceTrack(camTrack);
                }
                catch {
                    /* noop */
                }
            }
        }
        if (track) {
            try {
                track.stop();
            }
            catch {
                /* noop */
            }
        }
        if (display)
            display.getTracks().forEach((t) => t.stop());
    }, []);
    const toggleScreenShare = useCallback(async () => {
        if (screenTrackRef.current) {
            void stopScreenShare();
            return;
        }
        const md = navigator.mediaDevices;
        const gdm = (md as (MediaDevices & {
            getDisplayMedia?: (c?: DisplayMediaStreamOptions) => Promise<MediaStream>;
        }) | undefined)
            ?.getDisplayMedia;
        if (!gdm) {
            toast({
                title: 'Screen sharing unavailable',
                description: !window.isSecureContext ? 'Open the secure classroom link to share a screen.' : 'This browser cannot share its screen. You can still view your teacher’s shared screen. Use a laptop to share your own.',
                variant: 'destructive',
            });
            return;
        }
        try {
            const display = await gdm.call(md, { video: true, audio: false });
            const track = display.getVideoTracks()[0];
            if (!track) {
                display.getTracks().forEach((t) => t.stop());
                return;
            }
            screenTrackRef.current = track;
            screenStreamRef.current = display;
            setScreenStream(display);
            for (const [, entry] of pcsRef.current) {
                const sender = entry.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
                if (sender) {
                    try {
                        await sender.replaceTrack(track);
                    }
                    catch {
                        /* noop */
                    }
                }
                else if (entry.canNegotiate || entry.pc.remoteDescription) {
                    entry.pc.addTrack(track, display);
                }
            }
            track.addEventListener('ended', () => {
                void stopScreenShare();
            });
        }
        catch {
            // User cancelled the picker — nothing to do.
        }
    }, [stopScreenShare, toast]);
    const switchCamera = useCallback(async (deviceId: string) => {
        setSelectedCamId(deviceId);
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } }, audio: false });
            const newTrack = s.getVideoTracks()[0];
            if (!newTrack) {
                s.getTracks().forEach((t) => t.stop());
                return;
            }
            newTrack.enabled = true;
            const old = localStreamRef.current?.getVideoTracks()[0] ?? null;
            const stream = localStreamRef.current || new MediaStream();
            if (old)
                stream.removeTrack(old);
            stream.addTrack(newTrack);
            applyLocalStream(new MediaStream(stream.getTracks()));
            for (const [, entry] of pcsRef.current) {
                const sender = entry.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
                if (sender) {
                    try {
                        await sender.replaceTrack(screenTrackRef.current || newTrack);
                    }
                    catch {
                        /* noop */
                    }
                }
                else if (entry.canNegotiate || entry.pc.remoteDescription) {
                    entry.pc.addTrack(newTrack, localStreamRef.current ?? new MediaStream([newTrack]));
                }
            }
            old?.stop();
            setCamOn(true);
        }
        catch {
            toast({ title: 'Could not switch camera', description: 'The selected camera could not be opened.', variant: 'destructive' });
        }
    }, [applyLocalStream, toast]);
    const switchMic = useCallback(async (deviceId: string) => {
        setSelectedMicId(deviceId);
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
            const newTrack = s.getAudioTracks()[0];
            if (!newTrack) {
                s.getTracks().forEach((t) => t.stop());
                return;
            }
            const old = localStreamRef.current?.getAudioTracks()[0] ?? null;
            const wasEnabled = old?.enabled ?? true;
            newTrack.enabled = wasEnabled;
            const stream = localStreamRef.current || new MediaStream();
            if (old)
                stream.removeTrack(old);
            stream.addTrack(newTrack);
            applyLocalStream(new MediaStream(stream.getTracks()));
            for (const [, entry] of pcsRef.current) {
                const sender = entry.pc.getTransceivers().find(t => t.receiver.track.kind === 'audio')?.sender;
                if (sender) {
                    try {
                        await sender.replaceTrack(newTrack);
                    }
                    catch {
                        /* noop */
                    }
                }
                else if (entry.canNegotiate || entry.pc.remoteDescription) {
                    entry.pc.addTrack(newTrack, localStreamRef.current ?? new MediaStream([newTrack]));
                }
            }
            setMicOn(wasEnabled);
            old?.stop();
        }
        catch {
            toast({ title: 'Could not switch microphone', description: 'The selected microphone could not be opened.', variant: 'destructive' });
        }
    }, [applyLocalStream, toast]);
    const toggleMic = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (!track) {
            toast({
                title: 'No microphone',
                description: 'You joined without audio. Use "Retry media access" to enable your microphone.',
                variant: 'destructive',
            });
            return;
        }
        track.enabled = !track.enabled;
        setMicOn(track.enabled);
    };
    const toggleCam = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (!track) {
            toast({
                title: 'No camera',
                description: 'You joined without a camera. Use "Retry media access" to enable video.',
                variant: 'destructive',
            });
            return;
        }
        track.enabled = !track.enabled;
        setCamOn(track.enabled);
    };
    const toggleFullscreen = () => {
        const el = videoAreaRef.current;
        if (!el)
            return;
        if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => { });
        }
        else if (typeof el.requestFullscreen === 'function') {
            void el.requestFullscreen().catch(() => toast({ title: 'Fullscreen unavailable', description: 'The browser refused fullscreen mode.', variant: 'destructive' }));
        }
        else {
            toast({ title: 'Fullscreen unavailable', description: 'Your browser does not support fullscreen here.', variant: 'destructive' });
        }
    };
    useEffect(() => {
        const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);
    // ---------------------------------------------------------------------
    // Signaling socket + WebRTC
    // ---------------------------------------------------------------------
    const upsertRemoteStream = useCallback((sid: string, stream: MediaStream) => {
        setRemoteStreams((prev) => [...prev.filter((x) => x.sid !== sid), { sid, stream }]);
    }, []);
    const removeRemoteStream = useCallback((sid: string) => {
        remoteMediaRef.current.delete(sid);
        setRemoteStreams((prev) => prev.filter((x) => x.sid !== sid));
    }, []);
    const clearRemoteStreams = useCallback(() => { remoteMediaRef.current.clear(); setRemoteStreams([]); }, []);
    // Mirror of peers for stable reads inside socket handlers.
    const peersRef = useRef<PeerInfo[]>(peers);
    useEffect(() => {
        peersRef.current = peers;
    }, [peers]);
    useEffect(() => {
        if (phase !== 'ready')
            return;
        const token = tokenRef.current;
        if (!token)
            return;
        const socket = io(getRealtimeUrl(), { path: '/', transports: ['websocket', 'polling'], tryAllTransports: true, timeout: 10000, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
        socketRef.current = socket;
        let disposed = false, roomJoined = false;
        setConnectionIssue(null);
        const connectionTimer = window.setTimeout(() => {
            if (!disposed && !roomJoined)
                setConnectionIssue('The classroom service is taking too long to respond. Retry the connection below.');
        }, 12000);
        const teardownAllPeers = () => {
            for (const [, entry] of pcsRef.current) {
                try {
                    entry.cleanup();
                    entry.pc.close();
                }
                catch {
                    /* noop */
                }
            }
            pcsRef.current.clear();
            clearRemoteStreams();
            setPeerStates({});
            setQualityMap({});
        };
        const destroyPeer = (sid: string) => {
            const entry = pcsRef.current.get(sid);
            if (entry) {
                try {
                    entry.cleanup();
                    entry.pc.close();
                }
                catch {
                    /* noop */
                }
                pcsRef.current.delete(sid);
            }
            removeRemoteStream(sid);
            setPeerStates((prev) => {
                const next = { ...prev };
                delete next[sid];
                return next;
            });
            setQualityMap((prev) => {
                const next = { ...prev };
                delete next[sid];
                return next;
            });
        };
        const attachCurrentTracks = async (pc: RTCPeerConnection) => {
            const stream = localStreamRef.current;
            for (const transceiver of pc.getTransceivers()) {
                const kind = transceiver.receiver.track.kind;
                if (kind !== 'audio' && kind !== 'video')
                    continue;
                transceiver.direction = 'sendrecv';
                const track = kind === 'video' && screenTrackRef.current ? screenTrackRef.current : stream?.getTracks().find(t => t.kind === kind);
                if (track && transceiver.sender.track !== track)
                    await transceiver.sender.replaceTrack(track);
            }
        };
        const makeOffer = async (sid: string) => {
            const entry = pcsRef.current.get(sid);
            if (!entry || entry.makingOffer || entry.pc.signalingState !== 'stable')
                return;
            entry.canNegotiate = true;
            entry.makingOffer = true;
            try {
                if (!entry.pc.getTransceivers().length) {
                    const stream = localStreamRef.current;
                    for (const kind of ['video', 'audio'] as const) {
                        const track = kind === 'video' && screenTrackRef.current ? screenTrackRef.current : stream?.getTracks().find(t => t.kind === kind);
                        entry.pc.addTransceiver(track || kind, { direction: 'sendrecv', ...(stream ? { streams: [stream] } : {}) });
                    }
                }
                await attachCurrentTracks(entry.pc);
                const offer = await entry.pc.createOffer();
                await entry.pc.setLocalDescription(offer);
                const ld = entry.pc.localDescription;
                if (ld)
                    socket.emit('rtc_offer', { toSocketId: sid, sdp: { type: ld.type, sdp: ld.sdp } });
            }
            catch {
                /* ignore */
            }
            finally {
                entry.makingOffer = false;
            }
        };
        const createPeer = (sid: string): PeerEntry => {
            const pc = new RTCPeerConnection(ICE_CONFIG);
            let iceRestarts = 0, recoveryTimer: ReturnType<typeof setTimeout> | undefined;
            const entry: PeerEntry = { pc, canNegotiate: false, makingOffer: false, ignoreOffer: false, pendingIce: [], cleanup: () => { clearTimeout(recoveryTimer); pc.onconnectionstatechange = null; pc.onnegotiationneeded = null; pc.onicecandidate = null; pc.ontrack = null; } };
            pcsRef.current.set(sid, entry);
            // The answerer waits for the offer's transceivers instead of allocating
            // duplicate media channels before setRemoteDescription.
            pc.onicecandidate = (e) => {
                if (e.candidate)
                    socket.emit('rtc_ice', { toSocketId: sid, candidate: e.candidate.toJSON() });
            };
            pc.ontrack = (e) => {
                // Late permission grants may deliver separate streamless audio/video.
                const stream = remoteMediaRef.current.get(sid) || new MediaStream();
                for (const track of [...(e.streams[0]?.getTracks() || []), e.track])
                    if (!stream.getTracks().some(old => old.id === track.id))
                        stream.addTrack(track);
                remoteMediaRef.current.set(sid, stream);
                upsertRemoteStream(sid, stream);
            };
            const recoverMedia = () => {
                recoveryTimer = undefined;
                if (disposed || pc.connectionState === 'closed' || pc.connectionState === 'connected')
                    return;
                if (iceRestarts >= 2) {
                    setConnectionIssue('Audio and video could not recover. Check the network on both devices, then retry the connection.');
                    return;
                }
                iceRestarts++;
                pc.restartIce();
                recoveryTimer = setTimeout(recoverMedia, 12000);
            };
            pc.onconnectionstatechange = () => {
                if (disposed)
                    return;
                setPeerStates((prev) => ({ ...prev, [sid]: pc.connectionState }));
                if (pc.connectionState === 'connected') {
                    clearTimeout(recoveryTimer);
                    recoveryTimer = undefined;
                    iceRestarts = 0;
                    if (socket.connected)
                        setConnectionIssue(null);
                    void tuneClassroomSenders(pc, 'good', Boolean(screenTrackRef.current));
                }
                else if (pc.connectionState === 'disconnected') {
                    if (!recoveryTimer)
                        recoveryTimer = setTimeout(recoverMedia, 8000);
                }
                else if (pc.connectionState === 'failed') {
                    clearTimeout(recoveryTimer);
                    recoveryTimer = setTimeout(recoverMedia, 1000);
                }
                else if (pc.connectionState === 'closed') {
                    clearTimeout(recoveryTimer);
                    recoveryTimer = undefined;
                }
            };
            pc.onnegotiationneeded = () => {
                if (entry.canNegotiate && pc.signalingState === 'stable' && !entry.makingOffer)
                    void makeOffer(sid);
            };
            return entry;
        };
        const getOrCreatePeer = (sid: string): PeerEntry => pcsRef.current.get(sid) ?? createPeer(sid);
        const flushIce = async (entry: PeerEntry) => {
            const pending = entry.pendingIce.splice(0);
            for (const c of pending) {
                try {
                    await entry.pc.addIceCandidate(c);
                }
                catch {
                    /* ignore */
                }
            }
        };
        const ensurePeerListed = (sid: string) => {
            setPeers((prev) => prev.some((p) => p.socketId === sid) ? prev : [...prev, { socketId: sid, userId: '', name: 'Participant', role: 'student' }]);
        };
        const handleDescription = async (from: string, desc: RTCSessionDescriptionInit) => {
            const entry = getOrCreatePeer(from);
            ensurePeerListed(from);
            const pc = entry.pc;
            const offerCollision = desc.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable');
            // Perfect-negotiation glare rule: the lower socketId yields (rolls back).
            const iYield = (mySocketIdRef.current || '') < from;
            entry.ignoreOffer = offerCollision && !iYield;
            if (entry.ignoreOffer)
                return;
            try {
                if (offerCollision && iYield && pc.signalingState === 'have-local-offer') {
                    await pc.setLocalDescription({ type: 'rollback' });
                }
                await pc.setRemoteDescription(desc);
                await attachCurrentTracks(pc);
                await flushIce(entry);
                if (desc.type === 'offer') {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    const ld = pc.localDescription;
                    if (ld)
                        socket.emit('rtc_answer', { toSocketId: from, sdp: { type: ld.type, sdp: ld.sdp } });
                    entry.canNegotiate = true;
                }
            }
            catch {
                /* ignore malformed / stale signaling */
            }
        };
        const handleIce = async (from: string, candidate: RTCIceCandidateInit) => {
            const entry = pcsRef.current.get(from);
            if (!entry || entry.ignoreOffer)
                return;
            // Buffer candidates that arrive before the remote description is set.
            if (!entry.pc.remoteDescription) {
                entry.pendingIce.push(candidate);
                return;
            }
            try {
                await entry.pc.addIceCandidate(candidate);
            }
            catch {
                entry.pendingIce.push(candidate);
            }
        };
        const doJoin = () => {
            socket.timeout(12000).emit('join_lesson', { token }, (error: Error | null, res: unknown) => {
                if (disposed)
                    return;
                if (error) {
                    setConnectionIssue('The lesson room did not respond. Retry the classroom connection.');
                    setSocketConnected(false);
                    return;
                }
                const o = asObj(res);
                if (!o || o.ok !== true) {
                    const message = o && typeof o.error === 'string' ? o.error : 'Unable to join the lesson room.';
                    toast({ title: 'Could not join classroom', description: message, variant: 'destructive' });
                    setErr({ status: 0, message });
                    setPhase('error');
                    return;
                }
                const me = socket.id ?? '';
                mySocketIdRef.current = me;
                const rejoin = joinedOnceRef.current;
                joinedOnceRef.current = true;
                roomJoined = true;
                window.clearTimeout(connectionTimer);
                setConnectionIssue(null);
                setSocketConnected(true);
                setEverConnected(true);
                setBoardJoined(true);
                if (rejoin)
                    teardownAllPeers();
                const list: PeerInfo[] = [];
                if (Array.isArray(o.peers)) {
                    for (const raw of o.peers) {
                        const p = parsePeerInfo(raw);
                        if (p && p.socketId !== me && !list.some((x) => x.socketId === p.socketId))
                            list.push(p);
                    }
                }
                setPeers(list);
                setRemoteStreams((prev) => prev.filter((x) => list.some((p) => p.socketId === x.sid)));
                for (const p of list) {
                    if (!pcsRef.current.has(p.socketId))
                        createPeer(p.socketId);
                    void makeOffer(p.socketId);
                }
                if (o.document)
                    applyBoardDocument(o.document as unknown as BoardDocument);
                else if (Array.isArray(o.strokes))
                    applyStrokes(coerceStrokes(o.strokes));
                const access = asObj(o.boardAccess);
                if (access)
                    setBoardAccess({ locked: access.locked !== false, studentId: typeof access.studentId === 'string' ? access.studentId : null });
            });
        };
        socket.on('connect', () => {
            mySocketIdRef.current = socket.id ?? '';
            doJoin();
        });
        socket.on('connect_error', () => {
            if (!disposed)
                setConnectionIssue('Cannot reach the classroom connection service. Check your network and the trusted HTTPS connection, then retry.');
        });
        socket.on('disconnect', () => { roomJoined = false; setSocketConnected(false); setBoardJoined(false); });
        socket.on('call_state', (call: LessonCall) => syncCall(call));
        socket.on('call_ended', (data: {
            reason?: string;
        }) => setCallEndedReason(data.reason || 'hangup'));
        socket.on('peer_joined', (raw: unknown) => {
            const p = parsePeerInfo(raw);
            if (!p || p.socketId === mySocketIdRef.current)
                return;
            setPeers((prev) => (prev.some((x) => x.socketId === p.socketId) ? prev : [...prev, p]));
            // The existing participant does NOT offer — the newcomer does.
            if (!pcsRef.current.has(p.socketId))
                createPeer(p.socketId);
            toast({ title: `${p.name} joined the lesson` });
        });
        socket.on('peer_left', (raw: unknown) => {
            const sid = asString(asObj(raw)?.socketId);
            if (!sid)
                return;
            const name = peersRef.current.find((p) => p.socketId === sid)?.name;
            destroyPeer(sid);
            setPeers((prev) => prev.filter((p) => p.socketId !== sid));
            if (name)
                toast({ title: `${name} left the lesson` });
        });
        socket.on('rtc_offer', (raw: unknown) => {
            const o = asObj(raw);
            if (!o)
                return;
            const from = asString(o.fromSocketId);
            const desc = parseDesc(o.sdp);
            if (from && desc)
                void handleDescription(from, desc);
        });
        socket.on('rtc_answer', (raw: unknown) => {
            const o = asObj(raw);
            if (!o)
                return;
            const from = asString(o.fromSocketId);
            const desc = parseDesc(o.sdp);
            if (from && desc)
                void handleDescription(from, desc);
        });
        socket.on('rtc_ice', (raw: unknown) => {
            const o = asObj(raw);
            if (!o)
                return;
            const from = asString(o.fromSocketId);
            const candidate = parseIce(o.candidate);
            if (from && candidate)
                void handleIce(from, candidate);
        });
        socket.on('wb_page_added', (page: BoardPage) => {
            if (boardDocumentRef.current.pages.some(old => old.id === page.id))
                return;
            const next = { ...boardDocumentRef.current, pages: [...boardDocumentRef.current.pages, page] };
            boardDocumentRef.current = next;
            setBoardDocument(next);
        });
        socket.on('wb_page_switched', ({ pageId, strokes }: {
            pageId: string;
            strokes: Stroke[];
        }) => {
            const next = { ...boardDocumentRef.current, activePageId: pageId };
            const page = next.pages.find(page => page.id === pageId);
            if (page)
                page.strokes = strokes;
            applyBoardDocument(next);
        });
        socket.on('wb_final_snapshot', (document: BoardDocument) => applyBoardDocument(document));
        socket.on('lesson_ended', () => setCallEndedReason('completed'));
        socket.on('wb_access', (access: BoardAccess) => { setBoardAccess(access); draftRef.current = null; drawingRef.current = false; setTextBox(null); });
        socket.on('game_invitation_pending', () => window.dispatchEvent(new Event('refresh-game-invitations')));
        socket.on('wb_stroke', (raw: unknown) => {
            const s = parseStroke(raw);
            if (s)
                applyStrokes([...strokesRef.current, s]);
        });
        socket.on('wb_clear', () => applyStrokes([]));
        socket.on('wb_undo', () => applyStrokes(strokesRef.current.slice(0, -1)));
        socket.on('lesson_chat', (raw: unknown) => {
            const value = asObj(raw);
            const body = asString(value?.body);
            const imageUrl = asString(value?.imageUrl);
            if (!body && !imageUrl)
                return;
            const from = asObj(value?.from);
            const message: ChatMsg = { id: asString(value?.id, genId()), name: asString(from?.name, 'Participant'), role: asString(from?.role, 'student'), body, imageUrl: imageUrl || undefined, at: typeof value?.at === 'number' ? value.at : Date.now(), mine: asString(from?.userId) === myUserId };
            setMessages((previous) => mergeMessages(previous, [message]));
        });
        return () => {
            disposed = true;
            window.clearTimeout(connectionTimer);
            try {
                socket.emit('leave_lesson');
            }
            catch {
                /* noop */
            }
            socket.disconnect();
            if (socketRef.current === socket)
                socketRef.current = null;
            teardownAllPeers();
        };
    }, [phase, applyStrokes, applyBoardDocument, upsertRemoteStream, removeRemoteStream, clearRemoteStreams, toast, syncCall, myUserId]);
    // ---------------------------------------------------------------------
    // Connection quality (getStats every 3s)
    // ---------------------------------------------------------------------
    const qualitySamples = useRef(new Map<string, {
        lost: number;
        received: number;
    }>());
    const pollQuality = useCallback(async () => {
        const results: Record<string, {
            quality: Quality;
            rtt: number | null;
        }> = {};
        for (const sid of qualitySamples.current.keys())
            if (!pcsRef.current.has(sid))
                qualitySamples.current.delete(sid);
        for (const [sid, entry] of pcsRef.current) {
            try {
                const stats = await entry.pc.getStats();
                let packetsLost = 0;
                let packetsReceived = 0;
                let foundVideo = false;
                let rtt: number | null = null;
                stats.forEach((rep) => {
                    const r = rep as unknown as StatLike;
                    if (r.type === 'inbound-rtp' && r.kind === 'video') {
                        foundVideo = true;
                        packetsLost += typeof r.packetsLost === 'number' ? r.packetsLost : 0;
                        packetsReceived += typeof r.packetsReceived === 'number' ? r.packetsReceived : 0;
                    }
                    if (r.type === 'candidate-pair' && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') {
                        rtt = r.currentRoundTripTime;
                    }
                });
                let q: Quality = 'unknown';
                const conn = entry.pc.connectionState;
                if (conn === 'failed' || conn === 'disconnected') {
                    q = 'poor';
                }
                else if (conn === 'connected') {
                    if (foundVideo) {
                        const previous = qualitySamples.current.get(sid);
                        const lost = Math.max(0, packetsLost - (previous?.lost ?? 0)), received = Math.max(0, packetsReceived - (previous?.received ?? 0));
                        const total = lost + received;
                        const ratio = total > 0 ? lost / total : 0;
                        q = ratio < 0.02 ? 'good' : ratio < 0.08 ? 'weak' : 'poor';
                    }
                    else {
                        q = rtt != null && rtt < 0.3 ? 'good' : 'weak';
                    }
                    if (rtt != null) {
                        if (rtt > 0.6 && q === 'good')
                            q = 'weak';
                        if (rtt > 1.2)
                            q = 'poor';
                    }
                }
                qualitySamples.current.set(sid, { lost: packetsLost, received: packetsReceived });
                if (conn === 'connected')
                    void tuneClassroomSenders(entry.pc, q, Boolean(screenTrackRef.current));
                results[sid] = { quality: q, rtt };
            }
            catch {
                results[sid] = { quality: 'unknown', rtt: null };
            }
        }
        setQualityMap(results);
        setPeerStates((prev) => {
            const next = { ...prev };
            for (const [sid, entry] of pcsRef.current)
                next[sid] = entry.pc.connectionState;
            return next;
        });
    }, []);
    useEffect(() => {
        if (phase !== 'ready')
            return;
        const t = window.setInterval(() => void pollQuality(), 3000);
        return () => window.clearInterval(t);
    }, [phase, pollQuality]);
    // ---------------------------------------------------------------------
    // Chat
    // ---------------------------------------------------------------------
    const sendChat = useCallback((body: string, attachment?: UploadedAsset) => {
        const trimmed = body.trim();
        if (!trimmed && !attachment)
            return;
        const clientId = genId();
        socketRef.current?.emit('lesson_chat', { body: trimmed, clientId, attachmentId: attachment?.id });
        setMessages((previous) => mergeMessages(previous, [{ id: myUserId + ':' + clientId, name: myName, role: info?.role || 'student', body: trimmed, imageUrl: attachment?.url, at: Date.now(), mine: true }]));
    }, [myUserId, myName, info?.role]);
    useEffect(() => {
        if (chatOpen)
            setSeenCount(messages.length);
    }, [chatOpen, messages.length]);
    const unread = Math.max(0, messages.length - seenCount);
    // ---------------------------------------------------------------------
    // Derived values
    // ---------------------------------------------------------------------
    const startMs = info ? Date.parse(info.startsAt) : NaN;
    const endMs = info ? Date.parse(info.endsAt) : NaN;
    const validTimes = Number.isFinite(startMs) && Number.isFinite(endMs);
    let timerText = '--:--:--';
    let preLesson = false;
    let remainingMs = Number.POSITIVE_INFINITY;
    if (validTimes) {
        if (now < startMs) {
            preLesson = true;
            timerText = `Starts in ${fmtMS(startMs - now)}`;
        }
        else {
            remainingMs = endMs - now;
            timerText = remainingMs > 0 ? fmtHMS(remainingMs) : '00:00:00';
        }
    }
    const lessonOver = validTimes && now > endMs + 45 * 60 * 1000;
    const timerUrgent = validTimes && !preLesson && remainingMs < 5 * 60 * 1000;
    const timerEnded = validTimes && !preLesson && remainingMs <= 0;
    const worstQuality = useMemo<Quality | 'idle'>(() => {
        const vals = Object.values(qualityMap);
        if (vals.length === 0)
            return 'idle';
        if (vals.some((v) => v.quality === 'poor'))
            return 'poor';
        if (vals.some((v) => v.quality === 'weak'))
            return 'weak';
        if (vals.some((v) => v.quality === 'good'))
            return 'good';
        return 'unknown';
    }, [qualityMap]);
    const maxRtt = useMemo(() => {
        const rtts = Object.values(qualityMap)
            .map((v) => v.rtt)
            .filter((r): r is number => typeof r === 'number');
        return rtts.length ? Math.max(...rtts) : null;
    }, [qualityMap]);
    const sharing = Boolean(screenTrackRef.current) || Boolean(screenStream);
    // ---------------------------------------------------------------------
    // Render — gate screens
    // ---------------------------------------------------------------------
    const connectedStudents = [...new Map(peers.filter((peer) => peer.role === 'student').map((peer) => [peer.userId, peer])).values()];
    const updateBoardAccess = (locked: boolean, studentId?: string) => {
        if (info?.role !== 'tutor' || !socketRef.current?.connected)
            return;
        setBoardPending(true);
        socketRef.current.timeout(5000).emit('wb_access', { locked, studentId }, (error: Error | null, result: {
            ok: boolean;
            error?: string;
        }) => {
            setBoardPending(false);
            if (error || !result?.ok)
                toast({ title: 'Could not update whiteboard', description: result?.error || 'Please reconnect and try again', variant: 'destructive' });
            else
                setBoardStudentPicker(false);
        });
    };
    const toggleBoardLock = () => {
        if (!boardAccess.locked) {
            updateBoardAccess(true);
            return;
        }
        if (connectedStudents.length === 1)
            updateBoardAccess(false);
        else if (connectedStudents.length > 1)
            setBoardStudentPicker(true);
        else
            toast({ title: 'No student is connected yet', description: 'You can unlock the board when a student joins.' });
    };
    if (phase === 'loading')
        return <LoadingScreen />;
    if (phase === 'countdown') {
        return (<CountdownScreen message={err?.message ?? 'The classroom is not open yet.'} retryIn={retryIn} onRetryNow={() => void loadToken()} onExit={onExit}/>);
    }
    if (phase === 'error') {
        return (<ErrorScreen status={err?.status ?? 0} message={err?.message ?? 'Something went wrong while opening the classroom.'} onRetry={() => void loadToken()} onExit={onExit}/>);
    }
    if (!info)
        return <LoadingScreen />;
    const placeholderText = mediaStatus === 'pending'
        ? 'Getting your camera & microphone ready…'
        : !everConnected
            ? 'Connecting to classroom…'
            : 'Waiting for the other participant to join…';
    const mediaControlsDisabled = mediaStatus === 'pending' || mediaStatus === 'denied';
    // ---------------------------------------------------------------------
    // Render — classroom
    // ---------------------------------------------------------------------
    return (<div data-classroom-connected={boardJoined} className="flex h-dvh flex-col overflow-hidden bg-muted text-foreground pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:gap-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold leading-tight">{uiText(info.lessonLabel)}</h1>
          <p className="text-[11px] leading-tight text-muted-foreground">{info.groupClassId ? uiText("Live group classroom") : uiText("Live private classroom")}</p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 gap-1 font-mono text-xs tabular-nums', (preLesson || timerUrgent) && 'border-amber-300 bg-amber-50 text-amber-800', timerEnded && 'border-red-200 bg-red-50 text-red-700')}>
          <Clock className="size-3" aria-hidden/>
          {uiText(timerText)}
        </Badge>
        <Badge variant="outline" className="hidden shrink-0 md:inline-flex">
          {info.role === 'tutor' ? uiText("Tutor") : uiText("Student")}
        </Badge>
        <QualityBadge q={worstQuality} rttMs={maxRtt}/>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-11 shrink-0" onClick={() => setPartsOpen(true)} aria-label={uiText("Show participants")}>
              <Users className="size-5"/>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{uiText("Participants (")}{uiText(peers.length + 1)})</TooltipContent>
        </Tooltip>
        <Button variant="destructive" className="h-11 shrink-0 gap-1.5 rounded-full px-3 sm:px-4" onClick={() => setExitConfirm(true)} aria-label={uiText("Leave the classroom")}>
          <PhoneOff className="size-4"/>
          <span className="hidden sm:inline">{uiText("Leave")}</span>
        </Button>
      </header>

      {info.call && info.role === 'tutor' && !info.call.studentJoinedAt && <div className="lesson-ringing-banner" role="status"><PhoneOff className="size-4"/><span><strong>{info.call.status === 'accepted' ? uiText("{{value1}} answered \u2014 connecting", { value1: info.call.studentName }) : uiText("Calling {{value1}}", { value1: info.call.studentName })}</strong><small>{info.call.status === 'accepted' ? uiText("Waiting for the student to finish joining the classroom.") : uiText("Waiting for the student to join. This call ends automatically if unanswered.")}</small></span><b>{uiText(fmtMS(Math.max(0, Date.parse(info.call.deadline) - now)))}</b></div>}
      {lessonOver && uiText((<div className="flex shrink-0 items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-medium text-stone-950" role="status">
          <Info className="size-3.5 shrink-0" aria-hidden/>{uiText("Lesson time is over \u2014 the scheduled window for this lesson has ended.")}</div>))}

      {/* Main area */}
      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)_minmax(300px,340px)]">
        {/* Video column */}
        <section aria-label={uiText("Video call")} className={cn('min-h-0 min-w-0', mobileTab === 'video' ? 'block' : 'hidden', 'lg:block')}>
          <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
            <div ref={videoAreaRef} className="relative flex min-h-0 flex-1 flex-col gap-2 bg-stone-950 p-2">
              {connectionIssue && <div role="alert" className="absolute inset-x-3 top-3 z-30 rounded-xl border border-amber-400/40 bg-background p-4 text-foreground shadow-lg"><p className="text-sm">{uiText(connectionIssue)}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => { setConnectionIssue(null); setBoardJoined(false); setSocketConnected(false); socketRef.current?.disconnect().connect(); }}><RefreshCw size={15}/>{uiText("Retry connection")}</Button>{process.env.NEXT_PUBLIC_LOCAL_HTTPS_PORT && <Button size="sm" variant="outline" asChild><a href="/local-video-setup.html" target="_blank" rel="noreferrer">{uiText("Check secure video setup")}</a></Button>}</div></div>}
              {mediaSlow && mediaStatus === 'pending' && <div role="status" className="absolute inset-0 z-20 grid place-items-center bg-stone-950/85 p-4"><Card className="w-full max-w-sm"><CardHeader><CardTitle className="text-base">{uiText("Waiting for camera permission")}</CardTitle><CardDescription>{uiText("Your classroom is connecting independently. Choose Allow in your browser\u2019s camera and microphone prompt, or continue without them and enable them later.")}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => setMediaStatus('none')}>{uiText("Continue without camera and microphone")}</Button></CardContent></Card></div>}
              {mediaStatus === 'none' && !connectionIssue && <Button className="absolute start-3 top-3 z-10" size="sm" variant="secondary" onClick={() => setMediaStatus('pending')}>{uiText("Enable camera and microphone")}</Button>}
              {remoteStreams.length === 0 ? uiText((<div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-stone-800 bg-zinc-900/60 p-6 text-center">
                  <div>
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden/>
                    <p className="mt-3 text-sm text-stone-300">{uiText(placeholderText)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {mediaStatus === 'audio'
                ? uiText("You joined with microphone only.") : mediaStatus === 'none'
                ? uiText("You joined without camera & microphone (view-only).") : uiText("Your camera and microphone stay private until the other participant arrives.")}
                    </p>
                  </div>
                </div>)) : (<div className={cn('min-h-0 flex-1', remoteStreams.length > 1 ? 'grid grid-cols-2 gap-2' : 'flex flex-col')}>
                  {remoteStreams.map(({ sid, stream }) => (<RemoteVideo key={sid} stream={stream} name={peers.find((p) => p.socketId === sid)?.name ?? 'Participant'} state={peerStates[sid] ?? 'connecting'}/>))}
                </div>)}

              {/* Self view (picture-in-picture) */}
              <div className="absolute bottom-3 right-3 z-10 w-28 sm:w-36 lg:w-40">
                <div className="aspect-video overflow-hidden rounded-lg border border-stone-700 bg-zinc-900 shadow-lg">
                  {mediaStatus === 'none' ? uiText((<div className="grid h-full w-full place-items-center text-muted-foreground">
                      <VideoOff className="size-5" aria-hidden/>
                    </div>)) : uiText((<video ref={selfVideoRef} autoPlay muted playsInline className={cn('h-full w-full object-cover', !sharing && 'scale-x-[-1]')}/>))}
                </div>
                <p className="mt-1 text-center text-[10px] font-medium text-white/80">{sharing ? uiText("Your screen") : uiText("You")}</p>
              </div>

              {/* Reconnecting overlay */}
              {everConnected && !socketConnected && uiText((<div className={cn('absolute z-20 grid place-items-center bg-stone-950/80', Object.values(peerStates).some(state => state === 'connected') ? 'start-3 top-3 rounded-xl px-3 py-2' : 'inset-0')} role="status">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Loader2 className="size-4 animate-spin" aria-hidden/>{uiText("Reconnecting\u2026")}</div>
                </div>))}

              {/* Media permission fallback */}
              {mediaStatus === 'denied' && uiText((<div className="absolute inset-0 z-20 grid place-items-center bg-stone-950/85 p-4">
                  <Card className="w-full max-w-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <VideoOff className="size-4 text-amber-600" aria-hidden/> {mediaCapabilities?.secure === false ? uiText("Secure connection needed") : uiText("Camera & microphone access")}
                      </CardTitle>
                      <CardDescription>
                        {mediaCapabilities?.secure === false ? uiText("Your phone needs a trusted HTTPS connection for video and audio. Complete the local video setup, then reopen this classroom securely.") : uiText("Allow this site to use your camera and microphone, then retry. You can also join to watch the shared screen, use the whiteboard, and chat.")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {mediaCapabilities?.secure === false && process.env.NEXT_PUBLIC_LOCAL_HTTPS_PORT ? <>
                        <Button asChild variant="outline"><a href="/local-video-setup.html" target="_blank" rel="noreferrer">{uiText("Set up secure video on this device")}</a></Button>
                        <Button onClick={() => {
                    const url = new URL(window.location.href);
                    url.protocol = 'https:';
                    url.port = process.env.NEXT_PUBLIC_LOCAL_HTTPS_PORT!;
                    url.searchParams.set('classroom', bookingId);
                    if (info.call?.id)
                        url.searchParams.set('callId', info.call.id);
                    window.location.assign(url.href);
                }}>{uiText("Open secure classroom")}</Button>
                      </> : <Button className="h-11 gap-2" onClick={() => setMediaStatus('pending')}><RefreshCw className="size-4"/>{uiText(" Retry media access")}</Button>}
                      <Button variant="outline" className="h-11 gap-2" onClick={() => setMediaStatus('none')}>
                        <VideoOff className="size-4"/>{uiText(" Join without media (view-only)")}</Button>
                    </CardContent>
                  </Card>
                </div>))}
            </div>

            {/* Controls */}
            <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-2.5 sm:p-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-start">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" variant="outline" className="size-11 rounded-full border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100" onClick={() => setGamePicker(true)} disabled={info.role !== 'tutor'} aria-label={info.role === 'tutor' ? uiText("Send a learning game") : uiText("Wait for a teacher game invitation")}>
                      <Gamepad2 className="size-5"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{info.role === 'tutor' ? uiText("Send a learning game") : uiText("Your teacher will invite you to games")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" variant={micOn ? 'secondary' : 'outline'} className={cn('size-11 rounded-full', !micOn && 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100')} onClick={toggleMic} disabled={mediaControlsDisabled} aria-label={micOn ? uiText("Mute microphone") : uiText("Unmute microphone")} aria-pressed={!micOn}>
                      {micOn ? <Mic className="size-5"/> : <MicOff className="size-5"/>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{micOn ? uiText("Mute microphone") : uiText("Unmute microphone")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" variant={camOn && !sharing ? 'secondary' : 'outline'} className={cn('size-11 rounded-full', (!camOn || sharing) && 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100')} onClick={toggleCam} disabled={mediaControlsDisabled || sharing} aria-label={camOn ? uiText("Turn camera off") : uiText("Turn camera on")} aria-pressed={!camOn}>
                      {camOn ? <Video className="size-5"/> : <VideoOff className="size-5"/>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{sharing ? uiText("Stop sharing to control camera") : camOn ? uiText("Turn camera off") : uiText("Turn camera on")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" variant={sharing ? 'default' : 'secondary'} className="size-11 rounded-full" onClick={() => void toggleScreenShare()} disabled={!mediaCapabilities?.screen || mediaStatus === 'pending'} aria-label={sharing ? uiText("Stop screen sharing") : uiText("Share your screen")} aria-pressed={sharing}>
                      {sharing ? <MonitorX className="size-5"/> : <MonitorUp className="size-5"/>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{sharing ? uiText("Stop screen sharing") : !mediaCapabilities?.screen ? uiText("Use a supported laptop browser to share. You can still watch shared screens here.") : uiText("Share your screen")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="size-11 rounded-full text-muted-foreground" onClick={toggleFullscreen} aria-label={isFullscreen ? uiText("Exit fullscreen") : uiText("Fullscreen video")}>
                      {isFullscreen ? <Minimize className="size-5"/> : <Maximize className="size-5"/>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? uiText("Exit fullscreen") : uiText("Fullscreen video")}</TooltipContent>
                </Tooltip>
                {sharing && uiText((<Badge variant="outline" className="gap-1 border-teal-200 bg-teal-50 text-xs text-teal-800">
                    <MonitorUp className="size-3" aria-hidden/>{uiText(" Sharing your screen")}</Badge>))}
              </div>

              {(deviceList.cams.length > 1 || deviceList.mics.length > 1) && uiText((<div className="grid gap-2 sm:grid-cols-2">
                  {deviceList.cams.length > 1 && uiText((<Select value={selectedCamId || undefined} onValueChange={(v) => void switchCamera(v)}>
                      <SelectTrigger size="sm" className="w-full" aria-label={uiText("Select camera")}>
                        <SelectValue placeholder={uiText("Camera")}/>
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {uiText(deviceList.cams.map((d, i) => (<SelectItem key={d.deviceId || i} value={d.deviceId || String(i)}>
                            {d.label || uiText("Camera {{value1}}", { value1: i + 1 })}
                          </SelectItem>)))}
                      </SelectContent>
                    </Select>))}
                  {deviceList.mics.length > 1 && uiText((<Select value={selectedMicId || undefined} onValueChange={(v) => void switchMic(v)}>
                      <SelectTrigger size="sm" className="w-full" aria-label={uiText("Select microphone")}>
                        <SelectValue placeholder={uiText("Microphone")}/>
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {uiText(deviceList.mics.map((d, i) => (<SelectItem key={d.deviceId || i} value={d.deviceId || String(i)}>
                            {d.label || uiText("Microphone {{value1}}", { value1: i + 1 })}
                          </SelectItem>)))}
                      </SelectContent>
                    </Select>))}
                </div>))}

              {mediaCapabilities?.secure && !mediaCapabilities.screen && <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><MonitorUp className="size-3 shrink-0" aria-hidden/>{uiText("You can view a shared screen here. Join on a laptop to share your own screen.")}</p>}
              <p className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
                <Info className="size-3 shrink-0" aria-hidden/>{uiText("Recording consent required \u2014 feature available when enabled by administrators.")}</p>
            </div>
          </Card>
        </section>

        {/* Whiteboard column */}
        <section aria-label={uiText("Collaborative whiteboard")} className={cn('classroom-board min-h-0 min-w-0 flex-col', boardExpanded && 'is-expanded', boardExpanded && !boardTools && 'tools-hidden', mobileTab === 'board' || boardExpanded ? 'flex' : 'hidden', 'lg:flex')}>
          <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
            {boardExpanded && !boardTools && <div className="board-edge-gesture" aria-hidden="true" onPointerDown={e => { toolSwipe.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => {
                if (e.clientY - toolSwipe.current > 16)
                    revealBoardTools();
            }}/>}
            {boardExpanded && <button type="button" className="board-tools-handle" aria-label={boardTools ? uiText("Hide board tools") : uiText("Show board tools")} onClick={() => {
                if (toolDragged.current) {
                    toolDragged.current = false;
                    return;
                }
                boardTools ? setBoardTools(false) : revealBoardTools();
            }} onPointerDown={e => { toolDragged.current = false; toolSwipe.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => {
                if (e.clientY - toolSwipe.current > 16) {
                    toolDragged.current = true;
                    revealBoardTools();
                }
            }}><span />{boardTools ? uiText("Hide tools") : uiText("Show tools")}</button>}
            <div className="board-controls" onPointerDown={revealBoardTools}>

            <div className="classroom-board-heading"><div><Pencil size={17}/><strong>{uiText("Whiteboard")}</strong><span>{info.role === 'tutor' ? boardAccess.locked ? uiText("Teacher only") : uiText("Shared with {{value1}}", { value1: (connectedStudents.find((student) => student.userId === boardAccess.studentId)?.name || 'selected student') }) : canEditBoard ? uiText("You can draw") : uiText("Read only")}</span></div><div>{info.role === 'tutor' && <Button variant="outline" size="icon" aria-label={boardAccess.locked ? uiText("Unlock whiteboard") : uiText("Lock whiteboard")} disabled={boardPending} onClick={toggleBoardLock}>{boardAccess.locked ? <LockKeyhole size={18}/> : <LockKeyholeOpen size={18}/>}</Button>}<Button variant="outline" size="icon" aria-label={boardExpanded ? uiText("Exit full-screen whiteboard") : uiText("Full-screen whiteboard")} onClick={() => void toggleBoardFullscreen()}>{boardExpanded ? <Minimize size={18}/> : <Maximize size={18}/>}</Button></div></div>
            <div className="flex justify-end border-b px-3 py-1"><Button size="sm" variant="ghost" aria-label={uiText("Pan or scroll board")} aria-pressed={boardPan} onClick={() => setBoardPan(!boardPan)}>{boardPan ? uiText("Annotate page") : uiText("Scroll page")}</Button></div><BoardPagesToolbar fit={boardFit} onFitChange={setBoardFit} document={boardDocument} role={info.role} socket={boardJoined ? socketRef.current : null} draw={drawStroke}/>
            {/* Toolbar */}
            <div className={cn('classroom-board-toolbar flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1.5', !canEditBoard && 'is-readonly')}>
              {uiText(TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (<Tooltip key={t.id}>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" aria-label={uiText(t.label)} aria-pressed={active} onClick={() => {
                    setTool(t.id);
                    setTextBox(null);
                }} className={cn('classroom-board-tool size-11 rounded-lg', active ? 'bg-teal-700 text-white hover:bg-teal-800' : 'text-muted-foreground hover:bg-muted')}>
                        <Icon className="size-4"/>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{uiText(t.label)}</TooltipContent>
                  </Tooltip>);
        }))}
              <span className="mx-1 h-8 w-px shrink-0 bg-muted" aria-hidden/>
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label={uiText("Stroke color")}>
                {uiText(WB_COLORS.map((c) => (<button key={c} type="button" role="radio" aria-checked={color === c} aria-label={uiText("Color {{value1}}", { value1: c })} onClick={() => setColor(c)} className={cn('grid size-11 place-items-center rounded-lg', color === c ? 'bg-muted' : 'hover:bg-muted')}>
                    <span className="size-5 rounded-full border border-border shadow-inner" style={{ backgroundColor: c }}/>
                  </button>)))}
              </div>
              <span className="mx-1 h-8 w-px shrink-0 bg-muted" aria-hidden/>
              <Slider value={[width]} min={1} max={12} step={1} onValueChange={(v) => setWidth(v[0] ?? width)} className="w-20 shrink-0 sm:w-28" aria-label={uiText("Stroke width")}/>
              <div className="ms-auto flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="size-11 rounded-lg" onClick={undoStroke} disabled={!canEditBoard || strokes.length === 0} aria-label={uiText("Undo last stroke")}>
                  <Undo2 className="size-4"/>
                </Button>
                <Button type="button" size="icon" variant="outline" className="size-11 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700" onClick={clearBoard} aria-label={uiText("Clear whiteboard")} disabled={!canEditBoard}>
                  <Trash2 className="size-4"/>
                </Button>
              </div>
            </div>

            </div>
            {connectionIssue && <div role="alert" className="border-b bg-card p-3 text-sm">{uiText(connectionIssue)}<Button className="ms-3" size="sm" onClick={() => { setConnectionIssue(null); setBoardJoined(false); setSocketConnected(false); socketRef.current?.disconnect().connect(); }}>{uiText("Retry connection")}</Button></div>}
            {/* Canvas */}
            <div className="board-paper-area" data-fit={boardFit}><div ref={wrapRef} className="board-paper" style={boardFit === 'width' ? { width: '100%', height: `calc(100cqw / ${(boardDocument.pages.find(p => p.id === boardDocument.activePageId)?.width || 1000) / (boardDocument.pages.find(p => p.id === boardDocument.activePageId)?.height || 750)})`, maxWidth: 'none', maxHeight: 'none' } : boardFit === 'height' ? { height: '100%', width: `calc(100cqh * ${(boardDocument.pages.find(p => p.id === boardDocument.activePageId)?.width || 1000) / (boardDocument.pages.find(p => p.id === boardDocument.activePageId)?.height || 750)})`, maxWidth: 'none', maxHeight: 'none' } : { maxWidth: `calc(100cqh * ${(boardDocument.pages.find(page => page.id === boardDocument.activePageId)?.width || 1000) / (boardDocument.pages.find(page => page.id === boardDocument.activePageId)?.height || 750)})`, maxHeight: `calc(100cqw / ${(boardDocument.pages.find(page => page.id === boardDocument.activePageId)?.width || 1000) / (boardDocument.pages.find(page => page.id === boardDocument.activePageId)?.height || 750)})` }}>
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" style={{ pointerEvents: canEditBoard && !boardPan ? 'auto' : 'none' }} aria-label={uiText("Shared whiteboard canvas")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}/>
              {textBox && uiText((<input autoFocus value={textBox.value} onChange={(e) => {
                const cur = textBoxRef.current;
                if (cur)
                    setTextBox({ ...cur, value: e.target.value });
            }} onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commitText(textBoxRef.current);
                }
                else if (e.key === 'Escape') {
                    setTextBox(null);
                }
            }} onBlur={() => commitText(textBoxRef.current)} placeholder={uiText("Type, then press Enter")} aria-label={uiText("Whiteboard text")} className="absolute z-10 w-44 min-w-40 rounded-md border border-border bg-card px-2 py-1 shadow-md outline-none focus:ring-2 focus:ring-teal-600" style={{
                left: `${textBox.x * 100}%`,
                top: `${textBox.y * 100}%`,
                transform: 'translate(6px, -50%)',
                color,
                fontSize: Math.max(14, width * 4),
                fontWeight: 500,
            }}/>))}
            </div></div>
          </Card>
        </section>

        {/* Chat column (desktop) */}
        <aside aria-label={uiText("Lesson chat")} className="hidden min-h-0 min-w-0 lg:flex lg:flex-col">
          <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
            <CardHeader className="shrink-0 border-b px-3 py-2.5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="size-4 text-teal-700" aria-hidden/>{uiText(" Lesson chat")}</CardTitle>
              <CardDescription className="text-xs">{uiText("Visible only to this lesson&rsquo;s participants.")}</CardDescription>
            </CardHeader>
            <ChatPanel messages={messages} onSend={sendChat} roomId={info.roomId} token={tokenRef.current}/>
          </Card>
        </aside>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="z-20 flex shrink-0 items-center gap-2 border-t bg-background p-2 lg:hidden" aria-label={uiText("Classroom panels")}>
        <Button type="button" variant={mobileTab === 'video' ? 'default' : 'ghost'} className="h-11 flex-1 gap-1.5" onClick={() => setMobileTab('video')}>
          <Video className="size-4"/>{uiText(" Video")}</Button>
        <Button type="button" variant={mobileTab === 'board' ? 'default' : 'ghost'} className="h-11 flex-1 gap-1.5" onClick={() => setMobileTab('board')}>
          <Pencil className="size-4"/>{uiText(" Board")}</Button>
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" className="relative h-11 flex-1 gap-1.5">
              <MessageSquare className="size-4"/>{uiText(" Chat")}{unread > 0 && uiText((<span className="absolute right-1.5 top-1 grid size-5 place-items-center rounded-full bg-amber-500 text-[10px] font-bold text-stone-950">
                  {unread > 9 ? '9+' : uiText(unread)}
                </span>))}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="flex h-[72dvh] flex-col gap-0 p-0">
            <SheetHeader className="shrink-0 border-b px-4 py-3">
              <SheetTitle className="text-base">{uiText("Lesson chat")}</SheetTitle>
              <SheetDescription className="sr-only">{uiText("Messages sent during this lesson")}</SheetDescription>
            </SheetHeader>
            <ChatPanel messages={messages} onSend={sendChat} roomId={info.roomId} token={tokenRef.current}/>
          </SheetContent>
        </Sheet>
      </nav>

      <Dialog open={Boolean(callEndedReason) || exitConfirm} onOpenChange={open => {
            if (!open && !callEndedReason)
                setExitConfirm(false);
        }}><DialogContent className="sm:max-w-sm"><DialogTitle>{callEndedReason ? uiText("Lesson ended") : uiText("Save your lesson board?")}</DialogTitle><DialogDescription>{uiText("Download all pages, including PDF pages and annotations, before leaving.")}</DialogDescription><Button variant="outline" disabled={exporting} onClick={async () => {
            setExporting(true);
            try {
                await exportBoard(boardDocumentRef.current, drawStroke);
            }
            catch (error) {
                toast({ title: 'Could not export board', description: (error as Error).message, variant: 'destructive' });
            }
            finally {
                setExporting(false);
            }
        }}>{exporting ? uiText("Preparing PDF\u2026") : uiText("Download all board pages")}</Button><Button onClick={leave}>{callEndedReason ? uiText("Return to dashboard") : info.role === 'tutor' ? uiText("End lesson & leave") : uiText("Leave classroom")}</Button></DialogContent></Dialog>
      {/* Participants dialog */}
      <Dialog open={partsOpen} onOpenChange={setPartsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{uiText("Participants (")}{uiText(peers.length + 1)})</DialogTitle>
            <DialogDescription>{uiText("Everyone currently connected to this lesson room.")}</DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            <ParticipantRow name={myName} role={info.role} state="connected" isMe/>
            {peers.map((p) => (<ParticipantRow key={p.socketId} name={p.name} role={p.role} state={peerStates[p.socketId] ?? 'connecting'}/>))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={boardStudentPicker} onOpenChange={setBoardStudentPicker}><DialogContent className="sm:max-w-sm"><DialogTitle>{uiText("Who can use the board?")}</DialogTitle><DialogDescription>{uiText("Select one student. Everyone can still view the whiteboard.")}</DialogDescription><div className="board-student-options">{connectedStudents.map((student) => <Button variant="outline" key={student.userId} disabled={boardPending} onClick={() => updateBoardAccess(false, student.userId)}><Users size={17}/>{student.name}</Button>)}</div></DialogContent></Dialog>
      {gamePicker && info.role === 'tutor' && <TeacherGamePicker students={connectedStudents} onClose={() => setGamePicker(false)} onSent={(roomCode, gameSlug, invitationId) => { setGamePicker(false); setLessonGame({ roomCode, gameSlug }); setBrainBreak(5); socketRef.current?.emit('lesson_game_invite', { invitationId }); }}/>}
      {/* Brain Break overlay — the video lesson keeps running underneath */}
      {brainBreak !== null && uiText((<div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur" role="dialog" aria-label={uiText("Brain break")}>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Gamepad2 className="h-5 w-5 text-violet-600"/>
            <div>
              <p className="text-sm font-bold text-foreground">{uiText("Brain Break \u00B7 ")}{uiText(brainBreak)}{uiText(" min")}</p>
              <p className="text-xs text-muted-foreground">
                {breakLeft > 0
                ? uiText("{{value1}}:{{value2}} remaining \u2014 the lesson is still live.", { value1: Math.floor(breakLeft / 60), value2: String(breakLeft % 60).padStart(2, '0') }) : uiText("Break time is over \u2014 return whenever you are ready.")}
              </p>
            </div>
            <Button size="sm" className="ml-auto bg-teal-600 hover:bg-teal-700" onClick={() => setBrainBreak(null)}>{uiText("Return to Classroom")}</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GameCenter key={lessonGame?.roomCode || 'teacher-games'} initialRoomCode={lessonGame?.roomCode} initialGameSlug={lessonGame?.gameSlug} onExit={() => { setBrainBreak(null); setLessonGame(null); }}/>
          </div>
        </div>))}
    </div>);
}
