'use client';
import { uiText } from "@/lib/ui-text";
/**
 * MotionKit — shared, production-safe animation primitives for the
 * student and admin dashboards (and any future dashboard).
 *
 * Design rules:
 * - Animate transform/opacity only (compositor-friendly, stays 60fps).
 * - Every animation respects `prefers-reduced-motion` (explicit checks +
 *   the `MotionConfig reducedMotion="user"` wrapper used by the dashboards).
 * - SSR/hydration safe: no time-dependent output during server render.
 * - Purely presentational: no data fetching, no business logic.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
/* ------------------------------------------------------------------ */
/* Easing + stagger variants                                           */
/* ------------------------------------------------------------------ */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const staggerParent: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
export const staggerChild: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_EXPO } },
};
/** Wraps children in a staggered entrance container (fade + slide-up). */
export function Stagger({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<motion.div variants={staggerParent} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>);
}
/** Single staggered child — must be nested inside a `Stagger`. */
export function StaggerItem({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>);
}
/* ------------------------------------------------------------------ */
/* TabPill — sliding active-tab indicator                              */
/* ------------------------------------------------------------------ */
/**
 * Renders an absolutely-positioned pill in the active tab that slides
 * between tabs via a shared `layoutId` (framer-motion layout animation).
 * Place one `TabPill` inside every `TabsTrigger`; only the active one
 * renders. The trigger needs `relative` positioning.
 */
export function TabPill({ show, layoutId, className, }: {
    show: boolean;
    layoutId: string;
    className?: string;
}) {
    const reduced = useReducedMotion();
    if (!show)
        return null;
    return (<motion.span layoutId={layoutId} aria-hidden transition={reduced ? { duration: 0 } : { type: 'spring', bounce: 0.22, duration: 0.45 }} className={cn('pointer-events-none absolute inset-0 z-0', className)}/>);
}
/* ------------------------------------------------------------------ */
/* Sparkline — animated micro line chart                               */
/* ------------------------------------------------------------------ */
/**
 * Tiny animated line chart (SVG). Measures its container with a
 * ResizeObserver and renders exact pixel coordinates — no stretching, no
 * `vector-effect`/`pathLength` interaction bugs in Chromium. The line draws
 * itself in with a `pathLength` animation; the area fades in after.
 * Renders nothing until measured (SSR-safe).
 */
export function Sparkline({ points, height = 56, stroke = 'var(--primary)', className, ariaLabel, gradientId, }: {
    points: number[];
    height?: number;
    stroke?: string;
    className?: string;
    ariaLabel?: string;
    /** Unique gradient id; defaults to an auto-generated one (useId). */
    gradientId?: string;
}) {
    const reduced = useReducedMotion();
    const autoId = useId().replace(/[^a-zA-Z0-9-]/g, '');
    const gid = `spark-grad-${gradientId ?? autoId}`;
    const svgRef = useRef<SVGSVGElement>(null);
    const [width, setWidth] = useState(0);
    // Track the container width so the path uses true pixel coordinates.
    useEffect(() => {
        const el = svgRef.current;
        if (!el)
            return;
        setWidth(el.clientWidth);
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 0;
            setWidth(Math.round(w));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const PAD = 5;
    const { line, area } = useMemo(() => {
        const n = points.length;
        const W = width;
        if (n === 0 || W < 8)
            return { line: '', area: '' };
        const max = Math.max(...points, 1);
        const min = Math.min(...points, 0);
        const span = max - min || 1;
        const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
        const y = (v: number) => height - PAD - ((v - min) / span) * (height - PAD * 2);
        const pts = points.map((v, i) => ({ x: x(i), y: y(v) }));
        // Smooth cubic path — horizontal tangents at every point.
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const cx = (p0.x + p1.x) / 2;
            d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
        }
        const areaPath = n >= 2
            ? `${d} L ${pts[n - 1].x},${height - PAD} L ${pts[0].x},${height - PAD} Z`
            : '';
        return { line: d, area: areaPath };
    }, [points, height, width]);
    return (<svg ref={svgRef} className={cn('block w-full', className)} style={{ height }} role="img" aria-label={uiText(ariaLabel)}>
      {line ? uiText((<>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25}/>
              <stop offset="100%" stopColor={stroke} stopOpacity={0}/>
            </linearGradient>
          </defs>
          {area ? uiText((<motion.path d={area} fill={`url(#${gid})`} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}/>)) : uiText(null)}
          <motion.path d={line} fill="none" stroke={stroke} strokeWidth={2.25} strokeLinecap="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.9, ease: 'easeOut' }}/>
        </>)) : uiText(null)}
    </svg>);
}
/* ------------------------------------------------------------------ */
/* ProgressRing — animated circular progress                           */
/* ------------------------------------------------------------------ */
/**
 * Circular progress indicator. The arc animates from 0 to `value` with an
 * expo ease; the center is a slot for children (typically a big % number).
 * Colors are plain CSS values so both tokens (var(--primary)) and Tailwind
 * palette strings work.
 */
export function ProgressRing({ value, size = 92, stroke = 9, tone = 'var(--primary)', className, ariaLabel, children, }: {
    /** 0–100 */
    value: number;
    size?: number;
    stroke?: number;
    tone?: string;
    className?: string;
    ariaLabel?: string;
    children?: ReactNode;
}) {
    const reduced = useReducedMotion();
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, value));
    return (<div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="img" aria-label={uiText(ariaLabel)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke}/>
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={reduced ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c - (clamped / 100) * c }} transition={{ duration: reduced ? 0 : 1.1, ease: EASE_OUT_EXPO }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>);
}
/* ------------------------------------------------------------------ */
/* FloatingOrbs — decorative animated background blobs                 */
/* ------------------------------------------------------------------ */
/**
 * Slow-drifting blurred gradient blobs (pure CSS keyframes, GPU-composited,
 * disabled under `prefers-reduced-motion`). `hero` = on-brand-gradient
 * surfaces (white/emerald tints); `panel` = soft brand tints for card
 * headers on token-colored surfaces.
 */
export function FloatingOrbs({ variant = 'hero', className, }: {
    variant?: 'hero' | 'panel';
    className?: string;
}) {
    if (variant === 'panel') {
        return (<div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
        <div className="ts-orb-a absolute -top-24 end-24 size-64 rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-500/15"/>
        <div className="ts-orb-c absolute -bottom-28 end-64 size-64 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/15"/>
      </div>);
    }
    return (<div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="ts-orb-a absolute -top-20 -end-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"/>
      <div className="ts-orb-b absolute -bottom-24 start-1/4 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl"/>
      <div className="ts-orb-c absolute top-8 start-2/3 h-28 w-28 rounded-full bg-teal-200/20 blur-2xl"/>
    </div>);
}
/* ------------------------------------------------------------------ */
/* LiveDot — pulsing "live" indicator                                  */
/* ------------------------------------------------------------------ */
/** Small pulsing dot used to mark live/in-progress states. */
export function LiveDot({ className }: {
    className?: string;
}) {
    return (<span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75 motion-reduce:hidden"/>
      <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500"/>
    </span>);
}
