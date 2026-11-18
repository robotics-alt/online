'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Shared building blocks for the Brain Games suite.
 */
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Loader2, X, Sparkles } from 'lucide-react';
import { submitSoloResult } from '@/lib/games-client';
import { cn } from '@/lib/utils';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export interface GameFrameProps {
    title: string;
    icon?: ReactNode;
    difficulty?: Difficulty;
    onDifficultyChange?: (d: Difficulty) => void;
    difficulties?: Difficulty[];
    status?: ReactNode;
    onExit: () => void;
    children: ReactNode;
}
export function GameFrame({ title, icon, difficulty, onDifficultyChange, difficulties, status, onExit, children }: GameFrameProps) {
    return (<div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {uiText(icon)}
          <h2 className="text-lg font-bold text-foreground">{uiText(title)}</h2>
        </div>
        {status && <div className="text-sm text-muted-foreground">{uiText(status)}</div>}
        <div className="ml-auto flex items-center gap-2">
          {difficulties && difficulties.length > 1 && difficulty && onDifficultyChange && uiText((<Select value={difficulty} onValueChange={(v) => onDifficultyChange(v as Difficulty)}>
              <SelectTrigger size="sm" className="w-[120px]" aria-label={uiText("Difficulty")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {uiText(difficulties.map((d) => (<SelectItem key={d} value={d}>{uiText(d.charAt(0) + d.slice(1).toLowerCase())}</SelectItem>)))}
              </SelectContent>
            </Select>))}
          <Button variant="ghost" size="sm" onClick={onExit} aria-label={uiText("Exit game")}>
            <X className="h-4 w-4"/>{uiText(" Exit")}</Button>
        </div>
      </div>
      {children}
    </div>);
}
export interface ResultData {
    score: number;
    headline: string;
    detail?: string;
    won?: boolean;
}
export function ResultOverlay({ result, earned, onRestart, onExit, restartLabel = 'Play again', submitting, saveFailed }: {
    result: ResultData;
    earned: string[];
    onRestart: () => void;
    onExit: () => void;
    restartLabel?: string;
    submitting?: boolean;
    saveFailed?: boolean;
}) {
    return (<div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          <Trophy className="h-6 w-6"/>
        </div>
        <h3 className="mt-3 text-lg font-bold text-foreground">{uiText(result.headline)}</h3>
        {result.detail && <p className="mt-1 text-sm text-muted-foreground">{uiText(result.detail)}</p>}
        <p className="mt-3 text-3xl font-extrabold tabular-nums text-teal-700 dark:text-teal-400">{uiText(result.score)} <span className="text-sm font-medium text-muted-foreground">{uiText("points")}</span></p>
        {submitting && <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin"/>{uiText(" Saving your result\u2026")}</p>}
        {!submitting && saveFailed && uiText((<p className="mt-2 text-xs text-rose-500" role="status">{uiText("Your result could not be saved this time \u2014 your score still counts on screen.")}</p>))}
        {earned.length > 0 && uiText((<div className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
            <p className="flex items-center justify-center gap-1.5 font-semibold"><Sparkles className="h-4 w-4"/>{uiText(" New achievement")}{earned.length > 1 ? uiText("s") : ''}!</p>
            <p className="mt-1 text-xs">{uiText(earned.join(' · '))}</p>
          </div>))}
        <div className="mt-5 flex gap-2">
          <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={onRestart}>{uiText(restartLabel)}</Button>
          <Button variant="outline" className="flex-1" onClick={onExit}>{uiText("Back to games")}</Button>
        </div>
      </div>
    </div>);
}
/** Tracks a solo run (timer) and submits the result once, on demand. */
export function useSoloRun(gameSlug: string, difficulty: Difficulty) {
    const startedAt = useRef<number>(Date.now());
    const [submitting, setSubmitting] = useState(false);
    const [earned, setEarned] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const begin = useCallback(() => {
        startedAt.current = Date.now();
        setEarned([]);
        setSaved(false);
        setSaveFailed(false);
    }, []);
    const finish = useCallback(async (score: number, stats?: Record<string, unknown>) => {
        if (saved)
            return { earned: [] as string[] };
        setSaved(true);
        setSubmitting(true);
        try {
            const res = await submitSoloResult({
                gameSlug, difficulty, score,
                durationSec: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
                stats,
            });
            setEarned(res.earned ?? []);
            return { earned: res.earned ?? [] };
        }
        catch {
            setSaveFailed(true);
            setEarned([]);
            return { earned: [] as string[] };
        }
        finally {
            setSubmitting(false);
        }
    }, [gameSlug, difficulty, saved]);
    const elapsed = useCallback(() => Math.round((Date.now() - startedAt.current) / 1000), []);
    return useMemo(() => ({ begin, finish, submitting, earned, saveFailed, elapsed }), [begin, finish, submitting, earned, saveFailed, elapsed]);
}
export function ScoreChip({ label, value }: {
    label: string;
    value: string | number;
}) {
    return (<div className="rounded-xl border border-border bg-card px-3 py-1.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{uiText(label)}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
    </div>);
}
export function CountdownBar({ key_, totalMs }: {
    key_: string | number;
    totalMs: number;
}) {
    const [left, setLeft] = useState(1);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restart animation on key change
        setLeft(1);
        const start = Date.now();
        const t = setInterval(() => setLeft(Math.max(0, 1 - (Date.now() - start) / totalMs)), 100);
        return () => clearInterval(t);
    }, [key_, totalMs]);
    return (<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full transition-[width] duration-100', left > 0.3 ? 'bg-teal-500' : 'bg-rose-500')} style={{ width: `${left * 100}%` }}/>
    </div>);
}
export const DIFFS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
export function GameBadges({ modes, players, minutes, age }: {
    modes: string[];
    players: string;
    minutes: number;
    age: string;
}) {
    return (<div className="flex flex-wrap items-center gap-1.5">
      {modes.includes('DUEL') || modes.includes('GROUP') ? uiText((<Badge className="border-0 bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300">{uiText("Multiplayer")}</Badge>)) : uiText((<Badge variant="outline" className="border-border text-muted-foreground">{uiText("Solo")}</Badge>))}
      <Badge variant="outline" className="border-border text-muted-foreground">{uiText(players)}</Badge>
      <Badge variant="outline" className="border-border text-muted-foreground">~{uiText(minutes)}{uiText(" min")}</Badge>
      <Badge variant="outline" className="border-border text-muted-foreground">{uiText("Ages ")}{uiText(age)}</Badge>
    </div>);
}
