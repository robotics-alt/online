'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Quick Math Battle — solo 10-question sprint + shared question UI for
 * multiplayer (questions/scores come from the game server).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sigma, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GameFrame, ResultOverlay, useSoloRun, DIFFS, Difficulty, ScoreChip, CountdownBar } from './shared';
import { cn } from '@/lib/utils';
export interface MathQ {
    text: string;
    answer: string;
}
function gen(difficulty: Difficulty): MathQ {
    const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    if (difficulty === 'EASY') {
        const a = ri(2, 20), b = ri(1, 20);
        return Math.random() < 0.5
            ? { text: `${a} + ${b}`, answer: String(a + b) }
            : { text: `${Math.max(a, b)} − ${Math.min(a, b)}`, answer: String(Math.abs(a - b)) };
    }
    if (difficulty === 'MEDIUM') {
        const r = Math.random();
        if (r < 0.4) {
            const a = ri(3, 12), b = ri(3, 12);
            return { text: `${a} × ${b}`, answer: String(a * b) };
        }
        if (r < 0.7) {
            const b = ri(3, 12), q = ri(3, 12);
            return { text: `${b * q} ÷ ${b}`, answer: String(q) };
        }
        const a = ri(15, 99), b = ri(15, 99);
        return Math.random() < 0.5
            ? { text: `${a} + ${b}`, answer: String(a + b) }
            : { text: `${Math.max(a, b)} − ${Math.min(a, b)}`, answer: String(Math.abs(a - b)) };
    }
    const r = Math.random();
    if (r < 0.3) {
        const b = ri(2, 9), n = ri(2, 9) * b;
        return { text: `${n}/10 + ${b}/10  (decimal)`, answer: String(n / 10 + b / 10) };
    }
    if (r < 0.6) {
        const p = [10, 20, 25, 50][ri(0, 3)], n = ri(2, 20) * 4;
        return { text: `${p}% of ${n}`, answer: String((p / 100) * n) };
    }
    const x = ri(2, 12), a = ri(2, 9), c = ri(1, 20);
    return { text: `${a}x + ${c} = ${a * x + c}  →  x = ?`, answer: String(x) };
}
export const MATH_TOTAL_Q = 10;
const PER_Q_MS = 15000;
/** Shared question panel for solo + multiplayer. */
export function MathQuestionPanel({ q, qSeq, total, onAnswer, disabled, feedback, endedAt, scores }: {
    q: MathQ | null;
    qSeq: number;
    total: number;
    onAnswer?: (answer: string) => void;
    disabled?: boolean;
    feedback?: {
        correct: boolean;
        points: number;
    } | null;
    endedAt?: number | null;
    scores?: {
        name: string;
        score: number;
        you?: boolean;
    }[];
}) {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clear answer per question
        setValue('');
        inputRef.current?.focus();
    }, [qSeq]);
    const canSubmit = !!q && !disabled && !feedback && value.trim().length > 0;
    return (<div className="space-y-4">
      {endedAt && <CountdownBar key_={qSeq} totalMs={PER_Q_MS}/>}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{uiText("Question ")}{uiText(qSeq)}{uiText(" of ")}{uiText(total)}</p>
        <p className="mt-3 text-4xl font-extrabold tabular-nums text-foreground">{q?.text ?? '…'}</p>
      </div>
      <div className="mx-auto flex max-w-xs gap-2">
        <Input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit)
                onAnswer?.(value.trim());
        }} inputMode="decimal" placeholder={uiText("Your answer")} disabled={disabled || !q || !!feedback} aria-label={uiText("Answer")} className="text-center text-lg"/>
        <Button className="bg-teal-600 hover:bg-teal-700" disabled={!canSubmit} onClick={() => onAnswer?.(value.trim())}>{uiText("Answer")}</Button>
      </div>
      {feedback && uiText((<p className={cn('flex items-center justify-center gap-1.5 text-sm font-semibold', feedback.correct ? 'text-teal-600 dark:text-teal-400' : 'text-rose-500')}>
          {feedback.correct ? <CheckCircle2 className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}
          {feedback.correct ? uiText("Correct! +{{value1}} points", { value1: feedback.points }) : uiText("Not quite \u2014 next one!")}
        </p>))}
      {scores && scores.length > 0 && (<div className="mx-auto grid max-w-sm gap-1.5">
          {scores.map((s) => (<div key={s.name} className={cn('flex items-center justify-between rounded-xl border px-3 py-1.5 text-sm', s.you ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/40' : 'border-border bg-card')}>
              <span className="font-medium text-foreground">{s.name}{s.you ? uiText(" (you)") : ''}</span>
              <span className="font-bold tabular-nums text-foreground">{uiText(s.score)}</span>
            </div>))}
        </div>)}
    </div>);
}
export default function QuickMathSolo({ onExit }: {
    onExit: () => void;
}) {
    const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
    const [q, setQ] = useState<MathQ | null>(null);
    const [qSeq, setQSeq] = useState(0);
    const [score, setScore] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [feedback, setFeedback] = useState<{
        correct: boolean;
        points: number;
    } | null>(null);
    const [result, setResult] = useState<{
        score: number;
        headline: string;
        detail: string;
    } | null>(null);
    const run = useSoloRun('quick-math', difficulty);
    const [qEndsAt, setQEndsAt] = useState(0);
    const nextQ = useCallback(() => {
        setQ(gen(difficulty));
        setQSeq((n) => n + 1);
        setFeedback(null);
        setQEndsAt(Date.now() + PER_Q_MS);
    }, [difficulty]);
    useEffect(() => {
        const t = setTimeout(() => {
            run.begin();
            nextQ();
        }, 0);
        return () => clearTimeout(t);
    }, []);
    const answer = (ans: string) => {
        if (!q || feedback)
            return;
        const correct = ans === q.answer || ans.replace(/\.0+$/, '') === q.answer;
        const remain = Math.max(0, qEndsAt - Date.now());
        const points = correct ? 100 + Math.round(50 * (remain / PER_Q_MS)) : 0;
        setFeedback({ correct, points });
        if (correct) {
            setScore((s) => s + points);
            setCorrectCount((c) => c + 1);
        }
        setTimeout(() => {
            if (qSeq >= MATH_TOTAL_Q) {
                void (async () => {
                    await run.finish(score + points, { correct: correctCount + (correct ? 1 : 0), total: MATH_TOTAL_Q });
                    setResult({
                        score: score + points,
                        headline: correctCount + (correct ? 1 : 0) >= 8 ? 'Math champion! 🏆' : 'Sprint complete!',
                        detail: `${correctCount + (correct ? 1 : 0)}/${MATH_TOTAL_Q} correct · ${difficulty.toLowerCase()} difficulty`,
                    });
                })();
            }
            else
                nextQ();
        }, 650);
    };
    // Solo question timer
    useEffect(() => {
        if (!q || feedback || result)
            return;
        const t = setTimeout(() => {
            if (!feedback)
                answer('__timeout__');
        }, PER_Q_MS);
        void 0;
        return () => clearTimeout(t);
    }, [qSeq, feedback, result]);
    const restart = () => {
        setScore(0);
        setCorrectCount(0);
        setResult(null);
        setQSeq(0);
        nextQ();
        run.begin();
    };
    const progress = useMemo(() => `${Math.min(qSeq, MATH_TOTAL_Q)}/${MATH_TOTAL_Q}`, [qSeq]);
    return (<GameFrame title={uiText("Quick Math Battle")} icon={<Sigma className="h-5 w-5 text-amber-600"/>} difficulty={difficulty} onDifficultyChange={(d) => { setDifficulty(d); setQSeq(0); setScore(0); setCorrectCount(0); setResult(null); setTimeout(() => { setQ(gen(d)); setQSeq(1); setQEndsAt(Date.now() + PER_Q_MS); }, 0); }} difficulties={DIFFS} status={result ? undefined : `Score ${score} · ${progress}`} onExit={onExit}>
      <div className="relative rounded-2xl border border-border bg-card p-6">
        {!result && uiText((<div className="mb-4 flex justify-center">
            <ScoreChip label={uiText("Score")} value={score}/>
          </div>))}
        <MathQuestionPanel q={result ? null : q} qSeq={qSeq} total={MATH_TOTAL_Q} onAnswer={answer} feedback={feedback} endedAt={qEndsAt || null} disabled={!!result}/>
        {result && uiText((<ResultOverlay result={result} earned={run.earned} submitting={run.submitting} saveFailed={run.saveFailed} onRestart={restart} onExit={onExit}/>))}
      </div>
    </GameFrame>);
}
