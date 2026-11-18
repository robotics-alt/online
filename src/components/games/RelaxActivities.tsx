'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Relax & Create — Guided Breathing and Free Draw (canvas, saveable).
 * Non-competitive, non-scored by design.
 */
import { useEffect, useRef, useState } from 'react';
import { Wind, Palette, Download, Trash2, Undo2, Play, Square, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/store';
import { GameFrame } from './shared';
import { cn } from '@/lib/utils';
// ---------------- Guided Breathing ----------------
const PHASES = [
    { key: 'in', label: 'Breathe in', seconds: 4, scale: 1.35 },
    { key: 'hold', label: 'Hold', seconds: 4, scale: 1.35 },
    { key: 'out', label: 'Breathe out', seconds: 6, scale: 0.8 },
] as const;
export function GuidedBreathing({ onExit, onComplete }: {
    onExit: () => void;
    onComplete?: () => void;
}) {
    const [minutes, setMinutes] = useState<1 | 2 | 5>(2);
    const [running, setRunning] = useState(false);
    const [phaseIdx, setPhaseIdx] = useState(0);
    const [phaseLeft, setPhaseLeft] = useState<number>(PHASES[0].seconds);
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!running)
            return;
        const t = setInterval(() => {
            setElapsed((e) => e + 1);
            setPhaseLeft((l) => {
                if (l > 1)
                    return l - 1;
                setPhaseIdx((i) => (i + 1) % PHASES.length);
                return PHASES[(phaseIdx + 1) % PHASES.length].seconds;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [running, phaseIdx]);
    useEffect(() => {
        if (!running || elapsed < minutes * 60)
            return;
        const t = setTimeout(() => {
            setRunning(false);
            onComplete?.();
        }, 0);
        return () => clearTimeout(t);
    }, [running, elapsed, minutes, onComplete]);
    const phase = PHASES[phaseIdx];
    const total = minutes * 60;
    const progress = Math.min(1, elapsed / total);
    return (<GameFrame title={uiText("Guided Breathing")} icon={<Wind className="h-5 w-5 text-cyan-500"/>} onExit={onExit}>
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mb-6 flex justify-center gap-2">
          {uiText(([1, 2, 5] as const).map((m) => (<button key={m} onClick={() => { if (!running) {
            setMinutes(m);
            setElapsed(0);
        } }} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-colors', minutes === m ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' : 'border-border text-muted-foreground hover:border-cyan-300')} aria-pressed={minutes === m}>
              {uiText(m)}{uiText(" min")}</button>)))}
        </div>
        <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
          <div className={cn('absolute inset-0 rounded-full bg-cyan-200/60 transition-transform ease-in-out dark:bg-cyan-800/40', running ? 'blur-sm' : '')} style={{
            transform: `scale(${running ? phase.scale : 1})`,
            transitionDuration: running ? `${phase.seconds * 1000}ms` : '600ms',
        }}/>
          <div className="relative z-10">
            <p className="text-lg font-semibold text-cyan-800 dark:text-cyan-300">{running ? uiText(phase.label) : uiText("Ready?")}</p>
            {running && <p className="text-3xl font-bold tabular-nums text-cyan-600 dark:text-cyan-400">{uiText(phaseLeft)}</p>}
          </div>
        </div>
        {running && uiText((<div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-cyan-500 transition-[width] duration-1000" style={{ width: `${progress * 100}%` }}/>
          </div>))}
        <p className="mt-2 text-xs text-muted-foreground">{uiText(Math.floor(elapsed / 60))}:{uiText(String(elapsed % 60).padStart(2, '0'))}{uiText(" of ")}{uiText(minutes)}{uiText(":00 \u2014 finish early any time, nothing is forced.")}</p>
        <Button className={cn('mt-4', running ? 'bg-rose-500 hover:bg-rose-600' : 'bg-cyan-600 hover:bg-cyan-700')} onClick={() => setRunning((r) => !r)}>
          {running ? <><Square className="mr-1.5 h-4 w-4"/>{uiText(" Stop")}</> : <><Play className="mr-1.5 h-4 w-4"/>{uiText(" Start session")}</>}
        </Button>
      </div>
    </GameFrame>);
}
// ---------------- Free Draw ----------------
const COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#78716c', '#ffffff'];
const SIZES = [2, 5, 10];
export function FreeDraw({ onExit }: {
    onExit: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(SIZES[1]);
    const [eraser, setEraser] = useState(false);
    const history = useRef<ImageData[]>([]);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d')!;
        canvas.width = 800;
        canvas.height = 520;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);
    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
    };
    const pushHistory = () => {
        const ctx = canvasRef.current!.getContext('2d')!;
        history.current.push(ctx.getImageData(0, 0, 800, 520));
        if (history.current.length > 25)
            history.current.shift();
    };
    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        pushHistory();
        drawing.current = true;
        const ctx = canvasRef.current!.getContext('2d')!;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current)
            return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const p = pos(e);
        ctx.strokeStyle = eraser ? '#ffffff' : color;
        ctx.lineWidth = eraser ? size * 3 : size;
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    const end = () => { drawing.current = false; };
    const undo = () => {
        const last = history.current.pop();
        if (last)
            canvasRef.current!.getContext('2d')!.putImageData(last, 0, 0);
    };
    const clear = () => {
        pushHistory();
        const ctx = canvasRef.current!.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 800, 520);
    };
    const save = async () => {
        const data = canvasRef.current!.toDataURL('image/png');
        try {
            await api('/api/games/projects', { method: 'POST', json: { kind: 'DRAWING', title: `Drawing ${new Date().toLocaleDateString()}`, data } });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        }
        catch { /* toast handled upstream */ }
    };
    const download = () => {
        const a = document.createElement('a');
        a.href = canvasRef.current!.toDataURL('image/png');
        a.download = `tutorsphere-drawing-${Date.now()}.png`;
        a.click();
    };
    return (<GameFrame title={uiText("Free Draw")} icon={<Palette className="h-5 w-5 text-fuchsia-500"/>} onExit={onExit}>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {uiText(COLORS.map((c) => (<button key={c} onClick={() => { setColor(c); setEraser(false); }} aria-label={uiText("Color {{value1}}", { value1: c })} className={cn('h-7 w-7 rounded-full border-2 transition-transform hover:scale-110', color === c && !eraser ? 'border-teal-600 scale-110' : 'border-border')} style={{ backgroundColor: c }}/>)))}
          </div>
          <div className="mx-1 h-6 w-px bg-border"/>
          {uiText(SIZES.map((s) => (<button key={s} onClick={() => setSize(s)} aria-label={uiText("Brush size {{value1}}", { value1: s })} className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', size === s ? 'border-teal-600' : 'border-border')}>
              <span className="rounded-full bg-current" style={{ width: s + 2, height: s + 2 }}/>
            </button>)))}
          <div className="ml-auto flex gap-1.5">
            <Button variant="outline" size="sm" onClick={undo} aria-label={uiText("Undo")}><Undo2 className="h-4 w-4"/></Button>
            <Button variant="outline" size="sm" onClick={() => setEraser((e) => !e)} aria-pressed={eraser} className={eraser ? 'border-teal-600' : ''}>{uiText("Eraser")}</Button>
            <Button variant="outline" size="sm" onClick={clear} aria-label={uiText("Clear")}><Trash2 className="h-4 w-4"/></Button>
            <Button variant="outline" size="sm" onClick={download} aria-label={uiText("Download")}><Download className="h-4 w-4"/></Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={save}><Save className="mr-1 h-4 w-4"/>{saved ? uiText("Saved!") : uiText("Save")}</Button>
          </div>
        </div>
        <canvas ref={canvasRef} className="w-full touch-none rounded-xl border border-border bg-card" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} aria-label={uiText("Drawing canvas")}/>
        <p className="mt-2 text-center text-xs text-muted-foreground">{uiText("Draw with your mouse, finger or stylus. Saved drawings appear in My Gallery.")}</p>
      </div>
    </GameFrame>);
}
