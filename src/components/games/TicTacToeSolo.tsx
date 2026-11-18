'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Tic-Tac-Toe — solo vs AI (easy/medium/hard) + shared board used by the
 * multiplayer duel room (server-authoritative).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Grid3X3 } from 'lucide-react';
import { GameFrame, ResultOverlay, useSoloRun, DIFFS, Difficulty } from './shared';
import { cn } from '@/lib/utils';
export type Cell = 'X' | 'O' | null;
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function winnerOf(b: Cell[]): {
    mark: 'X' | 'O';
    line: number[];
} | null {
    for (const l of LINES) {
        const [a, c, d] = l;
        if (b[a] && b[a] === b[c] && b[a] === b[d])
            return { mark: b[a] as 'X' | 'O', line: l };
    }
    return null;
}
function aiMove(b: Cell[], difficulty: Difficulty): number {
    const empty = b.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
    if (empty.length === 0)
        return -1;
    if (difficulty === 'EASY')
        return empty[Math.floor(Math.random() * empty.length)];
    const tryWin = (mark: Cell) => {
        for (const i of empty) {
            const copy = [...b];
            copy[i] = mark;
            if (winnerOf(copy)?.mark === mark)
                return i;
        }
        return -1;
    };
    const win = tryWin('O');
    if (win >= 0)
        return win;
    const block = tryWin('X');
    if (block >= 0)
        return block;
    if (difficulty === 'HARD') {
        // Minimax — optimal play
        const minimax = (board: Cell[], isO: boolean): number => {
            const w = winnerOf(board);
            if (w)
                return w.mark === 'O' ? 10 : -10;
            if (board.every((c) => c !== null))
                return 0;
            const scores = board.map((c, i) => {
                if (c !== null)
                    return isO ? -99 : 99;
                const copy = [...board];
                copy[i] = isO ? 'O' : 'X';
                return minimax(copy, !isO);
            });
            return isO ? Math.max(...scores) : Math.min(...scores);
        };
        let best = -Infinity;
        let bestI = empty[0];
        for (const i of empty) {
            const copy = [...b];
            copy[i] = 'O';
            const score = minimax(copy, false);
            if (score > best) {
                best = score;
                bestI = i;
            }
        }
        return bestI;
    }
    // MEDIUM: prefer center/corners, otherwise random
    const pref = [4, 0, 2, 6, 8].filter((i) => b[i] === null);
    if (pref.length && Math.random() < 0.7)
        return pref[0];
    return empty[Math.floor(Math.random() * empty.length)];
}
/** Shared board UI for solo and multiplayer. */
export function TTTBoard({ board, line, onPlay, disabled, marks }: {
    board: Cell[];
    line?: number[] | null;
    onPlay?: (cell: number) => void;
    disabled?: boolean;
    marks?: {
        X: string;
        O: string;
    };
}) {
    return (<div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2">
      {uiText(board.map((c, i) => (<button key={i} onClick={() => onPlay?.(i)} disabled={disabled || c !== null || !onPlay} aria-label={uiText("Cell {{value1}}{{value2}}", { value1: i + 1, value2: c ? `: ${c}` : '' })} className={cn('flex aspect-square items-center justify-center rounded-2xl border border-border bg-card text-4xl font-black transition-all', c === 'X' && 'text-teal-600 dark:text-teal-400', c === 'O' && 'text-rose-500 dark:text-rose-400', line?.includes(i) && 'border-teal-500 bg-teal-50 dark:bg-teal-950/50', !c && !disabled && 'hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/30')}>
          {c === 'X' ? <span>{marks?.X ?? uiText("X")}</span> : c === 'O' ? <span>{marks?.O ?? uiText("O")}</span> : uiText(null)}
        </button>)))}
    </div>);
}
export default function TicTacToeSolo({ onExit }: {
    onExit: () => void;
}) {
    const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
    const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
    const [busy, setBusy] = useState(false);
    const [wins, setWins] = useState({ me: 0, ai: 0 });
    const [round, setRound] = useState(1);
    const [result, setResult] = useState<{
        score: number;
        headline: string;
        detail: string;
    } | null>(null);
    const run = useSoloRun('tic-tac-toe', difficulty);
    const w = useMemo(() => winnerOf(board), [board]);
    const full = board.every((c) => c !== null);
    const reset = useCallback((nextRound: number) => {
        setBoard(Array(9).fill(null));
        setRound(nextRound);
        setBusy(false);
    }, []);
    const newMatch = useCallback(() => {
        setWins({ me: 0, ai: 0 });
        reset(1);
        setResult(null);
        run.begin();
    }, [reset, run]);
    // Start the clock on first mount
    useEffect(() => {
        run.begin();
    }, []);
    const finishMatchLocal = async (nw: {
        me: number;
        ai: number;
    }) => {
        const finalScore = nw.me * 100;
        await run.finish(finalScore, { wins: nw.me, losses: nw.ai, difficulty });
        setResult({
            score: finalScore,
            headline: nw.me > nw.ai ? 'You win the match! 🎉' : nw.me === nw.ai ? 'A draw — well matched!' : 'The AI wins this one.',
            detail: `Best of 3 · ${nw.me} : ${nw.ai}`,
        });
    };
    // Match flow after each round
    useEffect(() => {
        if (!w && !full)
            return;
        if (result)
            return;
        const line0 = w?.mark === 'X';
        const aiWon = w?.mark === 'O';
        const nextWins = { me: wins.me + (line0 ? 1 : 0), ai: wins.ai + (aiWon ? 1 : 0) };
        const t = setTimeout(() => {
            setWins(nextWins);
            if (nextWins.me >= 2 || nextWins.ai >= 2) {
                void finishMatchLocal(nextWins);
            }
            else {
                reset(round + 1);
            }
        }, w || full ? 900 : 0);
        return () => clearTimeout(t);
    }, [w, full]);
    const play = async (cell: number) => {
        if (busy || board[cell] || w || result)
            return;
        const next = [...board];
        next[cell] = 'X';
        setBoard(next);
        if (winnerOf(next) || next.every((c) => c !== null))
            return;
        setBusy(true);
        setTimeout(() => {
            const ai = aiMove(next, difficulty);
            if (ai >= 0) {
                const after = [...next];
                after[ai] = 'O';
                setBoard(after);
            }
            setBusy(false);
        }, 450);
    };
    return (<GameFrame title={uiText("Tic-Tac-Toe")} icon={<Grid3X3 className="h-5 w-5 text-teal-600"/>} difficulty={difficulty} onDifficultyChange={(d) => { setDifficulty(d); newMatch(); }} difficulties={DIFFS} status={`Round ${round} · You ${wins.me} : ${wins.ai} AI${busy ? ' · AI thinking…' : ''}`} onExit={onExit}>
      <div className="relative rounded-2xl border border-border bg-card p-6">
        <TTTBoard board={board} line={w?.line} onPlay={play} disabled={busy || !!result}/>
        <p className="mt-4 text-center text-xs text-muted-foreground">{uiText("You are X \u2014 get three in a row. First to win 2 rounds takes the match.")}</p>
        {result && uiText((<ResultOverlay result={result} earned={run.earned} submitting={run.submitting} saveFailed={run.saveFailed} onRestart={newMatch} onExit={onExit}/>))}
      </div>
    </GameFrame>);
}
