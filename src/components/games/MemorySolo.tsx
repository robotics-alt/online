'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Memory Match — solo run vs the clock + shared grid for multiplayer duels.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain } from 'lucide-react';
import { GameFrame, ResultOverlay, useSoloRun, DIFFS, Difficulty, ScoreChip } from './shared';
import { cn } from '@/lib/utils';
export const MEMORY_ICONS = ['🍎', '🚀', '🎧', '🌟', '🐙', '🌈', '🎈', '🍕'];
const PAIRS = 8;
export function shuffledDeck(): number[] {
    const deck: number[] = [];
    for (let i = 0; i < PAIRS; i++)
        deck.push(i, i);
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
/** Shared grid for solo + multiplayer (state driven by props). */
export function MemoryBoard({ deck, flipped, matched, onFlip, disabled }: {
    deck: number[];
    flipped: number[];
    matched: boolean[];
    onFlip?: (i: number) => void;
    disabled?: boolean;
}) {
    return (<div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
      {uiText(deck.map((pairId, i) => {
            const up = matched[i] || flipped.includes(i);
            return (<button key={i} onClick={() => onFlip?.(i)} disabled={disabled || matched[i] || flipped.includes(i)} aria-label={up ? uiText("Card {{value1}}: revealed", { value1: i + 1 }) : uiText("Card {{value1}}: hidden", { value1: i + 1 })} className={cn('flex aspect-square items-center justify-center rounded-2xl border text-3xl transition-all duration-200', up
                    ? matched[i]
                        ? 'border-teal-500/60 bg-teal-50 dark:bg-teal-950/40'
                        : 'border-teal-400 bg-card'
                    : 'border-border bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:brightness-110')}>
            {up ? <span>{uiText(MEMORY_ICONS[pairId])}</span> : <span className="text-xl text-white/80">?</span>}
          </button>);
        }))}
    </div>);
}
export default function MemorySolo({ onExit }: {
    onExit: () => void;
}) {
    const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
    const [deck, setDeck] = useState<number[]>(() => shuffledDeck());
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<boolean[]>(() => Array(PAIRS * 2).fill(false));
    const [misses, setMisses] = useState(0);
    const [result, setResult] = useState<{
        score: number;
        headline: string;
        detail: string;
    } | null>(null);
    const run = useSoloRun('memory-match', difficulty);
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const done = useMemo(() => matched.every(Boolean), [matched]);
    const finish = useCallback(async (missCount: number, secs: number) => {
        const score = Math.max(100, 800 - missCount * 40 - secs * 2);
        await run.finish(score, { misses: missCount, seconds: secs });
        setResult({
            score,
            headline: missCount === 0 ? 'Perfect memory! 🧠' : 'All pairs found!',
            detail: `${missCount} miss${missCount === 1 ? '' : 'es'} · ${secs}s`,
        });
    }, [run]);
    useEffect(() => {
        if (!done || result)
            return;
        const t = setTimeout(() => { void finish(misses, seconds); }, 0);
        return () => clearTimeout(t);
    }, [done, result, misses, seconds, finish]);
    const restart = useCallback(() => {
        setDeck(shuffledDeck());
        setFlipped([]);
        setMatched(Array(PAIRS * 2).fill(false));
        setMisses(0);
        setSeconds(0);
        setResult(null);
        run.begin();
    }, [run]);
    const flip = (i: number) => {
        if (flipped.length >= 2 || matched[i] || flipped.includes(i) || result)
            return;
        const next = [...flipped, i];
        setFlipped(next);
        if (next.length === 2) {
            const [a, b] = next;
            if (deck[a] === deck[b]) {
                setTimeout(() => {
                    setMatched((m) => { const c = [...m]; c[a] = true; c[b] = true; return c; });
                    setFlipped([]);
                }, 450);
            }
            else {
                setMisses((m) => m + 1);
                setTimeout(() => setFlipped([]), 850);
            }
        }
    };
    return (<GameFrame title={uiText("Memory Match")} icon={<Brain className="h-5 w-5 text-violet-600"/>} difficulty={difficulty} onDifficultyChange={(d) => { setDifficulty(d); restart(); }} difficulties={DIFFS} onExit={onExit}>
      <div className="relative rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex justify-center gap-3">
          <ScoreChip label={uiText("Pairs")} value={`${matched.filter(Boolean).length / 2}/${PAIRS}`}/>
          <ScoreChip label={uiText("Misses")} value={misses}/>
          <ScoreChip label={uiText("Time")} value={`${seconds}s`}/>
        </div>
        <MemoryBoard deck={deck} flipped={flipped} matched={matched} onFlip={flip} disabled={!!result}/>
        <p className="mt-4 text-center text-xs text-muted-foreground">{uiText("Find all 8 pairs. Fewer misses and faster times score more points.")}</p>
        {result && uiText((<ResultOverlay result={result} earned={run.earned} submitting={run.submitting} saveFailed={run.saveFailed} onRestart={restart} onExit={onExit}/>))}
      </div>
    </GameFrame>);
}
