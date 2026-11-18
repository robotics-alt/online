'use client';
import { uiText } from "@/lib/ui-text";
/**
 * AdminWidgets — shared animated presentation primitives for the admin console.
 *
 * Purely presentational: no data fetching, no business logic. Everything is
 * themed with CSS design tokens (bg-card, text-muted-foreground, …) so the
 * widgets render correctly in both light and dark mode, and all motion is
 * transform/opacity only with `prefers-reduced-motion` respected.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */
const noopSubscribe = () => () => { };
/** True once the component has hydrated (SSR-safe, effect-free). */
export function useMounted(): boolean {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
/** Reactive `prefers-reduced-motion` flag (effect-free via useSyncExternalStore). */
function subscribeReducedMotion(onChange: () => void) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
}
function getReducedMotionSnapshot(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
/** Fade + slide-up entrance (transform/opacity only). */
export function FadeIn({ children, delay = 0, y = 10, className, }: {
    children: ReactNode;
    delay?: number;
    y?: number;
    className?: string;
}) {
    return (<motion.div initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay, ease: EASE_OUT_EXPO }} className={className}>
      {children}
    </motion.div>);
}
/**
 * Section-to-section transition. Wrap the content of each (force-mounted)
 * tab panel; the wrapper animates in whenever `active` flips to true while
 * staying mounted — preserving inner state and data-fetching semantics.
 */
export function ModuleTransition({ active, children, className, }: {
    active: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (<motion.div initial={false} animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>);
}
/* ------------------------------------------------------------------ */
/* CountUp                                                             */
/* ------------------------------------------------------------------ */
/**
 * Animated number. Renders the final value during SSR and until mounted
 * (no hydration mismatch), then eases 0 → value with requestAnimationFrame.
 * Subsequent value changes animate from the currently displayed number.
 * Respects `prefers-reduced-motion` (renders the final value immediately).
 */
export function CountUp({ value, format, durationMs = 900, className, }: {
    value: number;
    format?: (n: number) => string;
    durationMs?: number;
    className?: string;
}) {
    const mounted = useMounted();
    const reduced = usePrefersReducedMotion();
    const [display, setDisplay] = useState(value);
    const displayRef = useRef(value);
    const rafRef = useRef(0);
    const firstRunRef = useRef(true);
    useEffect(() => {
        displayRef.current = display;
    }, [display]);
    useEffect(() => {
        if (!mounted || reduced)
            return;
        const to = value;
        const from = firstRunRef.current ? Math.min(0, to) : displayRef.current;
        firstRunRef.current = false;
        if (from === to)
            return;
        const start = performance.now();
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            setDisplay(from + (to - from) * easeOut(t));
            if (t < 1)
                rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [mounted, reduced, value, durationMs]);
    const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('en-US'));
    const shown = mounted && !reduced ? display : value;
    return <span className={cn('tabular-nums', className)}>{uiText(fmt(shown))}</span>;
}
/* ------------------------------------------------------------------ */
/* Stat cards                                                          */
/* ------------------------------------------------------------------ */
export type StatTone = 'default' | 'teal' | 'violet' | 'emerald' | 'amber' | 'rose';
export const STAT_ICON_TONES: Record<StatTone, string> = {
    default: 'bg-muted text-muted-foreground',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
};
const CHIP_TONES: Record<'emerald' | 'amber' | 'rose' | 'teal' | 'muted', string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
    muted: 'bg-muted text-muted-foreground',
};
/** Small tinted pill used for deltas/trends on stat cards. */
export function DeltaChip({ children, tone = 'emerald', icon: Icon, }: {
    children: ReactNode;
    tone?: 'emerald' | 'amber' | 'rose' | 'teal' | 'muted';
    icon?: LucideIcon;
}) {
    return (<span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4', CHIP_TONES[tone])}>
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden/> : uiText(null)}
      {children}
    </span>);
}
/**
 * Animated KPI card: staggered entrance (fade + slide-up, 60ms per index),
 * hover lift + shadow, tinted icon square, optional delta chip and hint.
 */
export function StatCard({ icon: Icon, label, value, tone = 'default', hint, delta, index = 0, className, }: {
    icon: LucideIcon;
    label: string;
    value: ReactNode;
    tone?: StatTone;
    hint?: string;
    delta?: ReactNode;
    index?: number;
    className?: string;
}) {
    return (<motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{
            duration: 0.35,
            delay: Math.min(index, 12) * 0.06,
            ease: EASE_OUT_EXPO,
        }} whileHover={{ y: -2 }} className={cn('group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"/>
      <div className="flex items-start justify-between gap-3">
        <span className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {uiText(label)}
        </span>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105', STAT_ICON_TONES[tone])}>
          <Icon className="size-4" aria-hidden/>
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {delta || hint ? uiText((<div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {uiText(delta)}
          {hint ? <span className="truncate">{uiText(hint)}</span> : uiText(null)}
        </div>)) : uiText(null)}
    </motion.article>);
}
/** Responsive grid for stat cards. */
export function StatGrid({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5', className)}>
      {children}
    </div>);
}
/* ------------------------------------------------------------------ */
/* Headers / empty states / skeletons                                  */
/* ------------------------------------------------------------------ */
/** Section heading (h2) with a subtle accent bar, actions and refresh. */
export function SectionHeader({ title, description, onRefresh, children, }: {
    title: string;
    description?: string;
    onRefresh?: () => void;
    children?: ReactNode;
}) {
    return (<div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div aria-hidden className="mb-2 h-1 w-8 rounded-full bg-gradient-to-r from-teal-500 to-violet-500"/>
        <h2 className="text-xl font-semibold tracking-tight">{uiText(title)}</h2>
        {description ? uiText((<p className="mt-0.5 text-sm text-muted-foreground">{uiText(description)}</p>)) : uiText(null)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {onRefresh ? uiText((<Button variant="outline" size="sm" onClick={onRefresh} className="group max-sm:min-h-11">
            <RefreshCw className="size-4 transition-transform duration-500 group-hover:rotate-180 motion-reduce:transition-none" aria-hidden/>{uiText("Refresh")}</Button>)) : uiText(null)}
      </div>
    </div>);
}
/** Icon-in-tile empty state. */
export function EmptyState({ icon: Icon, label, children, }: {
    icon: LucideIcon;
    label: string;
    children?: ReactNode;
}) {
    return (<div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/70 ring-1 ring-inset ring-border/60">
        <Icon className="size-5" aria-hidden/>
      </span>
      <p className="text-sm text-muted-foreground">{uiText(label)}</p>
      {children}
    </div>);
}
/** Skeleton shaped like the data tables it replaces. */
export function SkeletonTable({ rows = 6, className, }: {
    rows?: number;
    className?: string;
}) {
    return (<div aria-hidden className={cn('space-y-2 p-4', className)}>
      <Skeleton className="mb-3 h-9 w-full rounded-lg"/>
      {uiText(Array.from({ length: rows }).map((_, i) => (<div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
          <Skeleton className="size-8 shrink-0 rounded-full"/>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3 min-w-24"/>
            <Skeleton className="h-3 w-1/2 min-w-32"/>
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full"/>
          <Skeleton className="h-6 w-20 shrink-0 rounded-md"/>
        </div>)))}
    </div>);
}
/* ------------------------------------------------------------------ */
/* Table panels                                                        */
/* ------------------------------------------------------------------ */
/**
 * Consistent table chrome applied from a wrapper (higher specificity than
 * the cell-level utilities in ui/table): sticky translucent header row,
 * uppercase column labels, roomier cells.
 */
export const dataTableStyles = [
    '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card/90 [&_thead]:backdrop-blur-sm',
    '[&_th]:h-11 [&_th]:px-4 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground',
    '[&_td]:px-4 [&_td]:py-3',
].join(' ');
/** Scroll container for long tables (keeps max-height + slim scrollbar). */
export function TableScroll({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<div className={cn('overflow-x-auto', dataTableStyles, className)}>
      {children}
    </div>);
}
/** Standalone bordered data-table panel (rounded-2xl, clipped corners). */
export function DataTableShell({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<div className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <TableScroll>{children}</TableScroll>
    </div>);
}
/** Rounded panel used for titled tables/lists. */
export function Panel({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<div className={cn('flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      {children}
    </div>);
}
/** Muted header strip for `Panel`, with optional icon and action area. */
export function PanelHeader({ icon: Icon, title, description, children, className, }: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    children?: ReactNode;
    className?: string;
}) {
    return (<div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3.5 md:px-6', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? uiText((<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-inset ring-border/60">
            <Icon className="size-4 text-teal-600 dark:text-teal-400" aria-hidden/>
          </span>)) : uiText(null)}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{uiText(title)}</h3>
          {description ? uiText((<p className="mt-0.5 text-xs text-muted-foreground">{uiText(description)}</p>)) : uiText(null)}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : uiText(null)}
    </div>);
}
/* ------------------------------------------------------------------ */
/* Recharts theming                                                    */
/* ------------------------------------------------------------------ */
/** Shared dark-mode-friendly Tooltip styling (CSS-variable colors). */
export const chartTooltipBase = {
    contentStyle: {
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.10)',
        fontSize: 12,
        color: 'var(--card-foreground)',
    },
    labelStyle: {
        color: 'var(--muted-foreground)',
        fontSize: 11,
        marginBottom: 2,
    },
    itemStyle: {
        color: 'var(--foreground)',
        fontSize: 12,
    },
} as const;
/** Chart palette mapped to design tokens (adapts to light/dark). */
export const CHART_COLORS = {
    primary: 'var(--primary)',
    grid: 'var(--border)',
    muted: 'var(--muted-foreground)',
} as const;
