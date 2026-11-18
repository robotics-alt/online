'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Compact solo games: Sliding Puzzle, Word Scramble, Focus Tap.
 * All results go through the server-validated solo-result API.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puzzle, Type as LettersIcon, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameFrame, ResultOverlay, useSoloRun, DIFFS, Difficulty, ScoreChip, CountdownBar } from './shared';
import { cn } from '@/lib/utils';
// ---------------- Sliding Puzzle ----------------
function solvedState(size: number) {
    return Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));
}
function shuffleTiles(size: number): number[] {
    const tiles = solvedState(size);
    let hole = size * size - 1;
    for (let k = 0; k < size * size * 20; k++) {
        const neighbors = [hole - 1, hole + 1, hole - size, hole + size].filter((n) => n >= 0 && n < size * size && !(k === 0 && n === hole - 1));
        const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        [tiles[hole], tiles[pick]] = [tiles[pick], tiles[hole]];
        hole = pick;
    }
    return tiles;
}
export function SlidingPuzzle({ onExit }: {
    onExit: () => void;
}) {
    const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
    const size = difficulty === 'EASY' ? 3 : 4;
    const [tiles, setTiles] = useState<number[]>(() => shuffleTiles(3));
    const [moves, setMoves] = useState(0);
    const [seconds, setSeconds] = useState(0);
    const [result, setResult] = useState<{
        score: number;
        headline: string;
        detail: string;
    } | null>(null);
    const run = useSoloRun('sliding-puzzle', difficulty);
    const solved = useMemo(() => tiles.every((t, i) => t === solvedState(size)[i]), [tiles, size]);
    useEffect(() => {
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const restart = useCallback((d?: Difficulty) => {
        setTiles(shuffleTiles(d === 'HARD' ? 4 : d === 'MEDIUM' ? 4 : 3));
        setMoves(0);
        setSeconds(0);
        setResult(null);
        run.begin();
    }, [run]);
    useEffect(() => {
        if (!solved || result || moves === 0)
            return;
        const t = setTimeout(() => {
            void (async () => {
                const score = Math.max(100, 1000 - moves * 4 - seconds * 2);
                await run.finish(score, { moves, seconds, size });
                setResult({ score, headline: 'Puzzle solved! 🧩', detail: `${moves} moves · ${seconds}s · ${size}×${size}` });
            })();
        }, 0);
        return () => clearTimeout(t);
    }, [solved, result, moves, seconds, size, run]);
    const move = (i: number) => {
        const hole = tiles.indexOf(0); // 0 is the empty slot
        const isNeighbor = [hole - 1, hole + 1, hole - size, hole + size].includes(i);
        if (!isNeighbor || i < 0 || i >= tiles.length)
            return;
        const next = [...tiles];
        [next[hole], next[i]] = [next[i], next[hole]];
        setTiles(next);
        setMoves((m) => m + 1);
    };
    return (<GameFrame title={uiText("Sliding Puzzle")} icon={<Puzzle className="h-5 w-5 text-rose-500"/>} difficulty={difficulty} onDifficultyChange={(d) => { setDifficulty(d); setTiles(shuffleTiles(d === 'EASY' ? 3 : 4)); setMoves(0); setSeconds(0); setResult(null); run.begin(); }} difficulties={DIFFS} onExit={onExit}>
      <div className="relative rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex justify-center gap-3">
          <ScoreChip label={uiText("Moves")} value={moves}/>
          <ScoreChip label={uiText("Time")} value={`${seconds}s`}/>
          <ScoreChip label={uiText("Grid")} value={`${size}×${size}`}/>
        </div>
        <div className="mx-auto grid w-full max-w-xs gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {uiText(tiles.map((v, i) => (<button key={i} onClick={() => move(i)} disabled={v === 0 || !!result} aria-label={v === 0 ? uiText("Empty slot") : uiText("Tile {{value1}}", { value1: v })} className={cn('flex aspect-square items-center justify-center rounded-xl text-xl font-bold transition-all', v === 0 ? 'bg-muted/50' : 'border border-border bg-card text-foreground shadow-sm hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40', solved && v !== 0 && 'border-teal-500 bg-teal-50 dark:bg-teal-950/40')}>
              {v !== 0 ? uiText(v) : ''}
            </button>)))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">{uiText("Slide tiles into the empty space to order them 1 \u2192 ")}{uiText(size * size - 1)}.</p>
        {result && <ResultOverlay result={result} earned={run.earned} submitting={run.submitting} saveFailed={run.saveFailed} onRestart={() => restart(difficulty)} onExit={onExit}/>}
      </div>
    </GameFrame>);
}
// ---------------- Word Scramble ----------------
const WORDS: Record<string, {
    EASY: string[];
    MEDIUM: string[];
    HARD: string[];
}> = {
    en: {
        EASY: ['cat', 'sun', 'book', 'tree', 'fish', 'star', 'moon', 'bird'],
        MEDIUM: ['school', 'garden', 'planet', 'friend', 'castle', 'pencil', 'wonder', 'bridge'],
        HARD: ['knowledge', 'adventure', 'mountain', 'galaxy', 'chemistry', 'festival', 'language', 'challenge'],
    },
    ar: {
        EASY: ['قمر', 'شمس', 'كتاب', 'بحر', 'ورد', 'طير', 'سمك', 'نجم'],
        MEDIUM: ['مدرسة', 'حديقة', 'كوكب', 'صديق', 'قلعة', 'قلم', 'جسر', 'نافذة'],
        HARD: ['معرفة', 'مغامرة', 'جبل', 'مجرة', 'كيمياء', 'مهرجان', 'لغة', 'تحدي'],
    },
    ku: {
        EASY: ['مانگ', 'خۆر', 'کتێب', 'دەریا', 'گوڵ', 'باڵندە', 'ماسی', 'ئەستێرە'],
        MEDIUM: ['قوتابخانە', 'باخچە', 'هەسارە', 'هاوڕێ', 'قەڵا', 'پێنووس', 'پرد', 'پەنجەرە'],
        HARD: ['زانین', 'سەرکێشی', 'چیا', 'کۆکەشە', 'کیمیا', 'جەژن', 'زمان', 'ڕکابەری'],
    },
    tr: {
        EASY: ['kedi', 'güneş', 'kitap', 'deniz', 'çiçek', 'kuş', 'balık', 'yıldız'],
        MEDIUM: ['okul', 'bahçe', 'gezegen', 'arkadaş', 'kale', 'kalem', 'köprü', 'pencere'],
        HARD: ['bilgi', 'macera', 'dağ', 'galaksi', 'kimya', 'festival', 'dil', 'meydan okuma'],
    },
    fr: {
        EASY: ['chat', 'soleil', 'livre', 'mer', 'fleur', 'oiseau', 'poisson', 'étoile'],
        MEDIUM: ['école', 'jardin', 'planète', 'ami', 'château', 'crayon', 'pont', 'fenêtre'],
        HARD: ['savoir', 'aventure', 'montagne', 'galaxie', 'chimie', 'festival', 'langage', 'défi'],
    },
};
export function WordScramble({ onExit, language = 'en' }: {
    onExit: () => void;
    language?: string;
}) {
    const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
    const bank = WORDS[language] ?? WORDS.en;
    const [word, setWord] = useState('');
    const [letters, setLetters] = useState<string[]>([]);
    const [solvedCount, setSolvedCount] = useState(0);
    const [guess, setGuess] = useState('');
    const [shake, setShake] = useState(false);
    const [result, setResult] = useState<{
        score: number;
        headline: string;
        detail: string;
    } | null>(null);
    const run = useSoloRun('word-scramble', difficulty);
    const TOTAL = 10;
    const pick = useCallback((d: Difficulty) => {
        const list = bank[d];
        const w = list[Math.floor(Math.random() * list.length)];
        setWord(w);
        setLetters(w.split('').sort(() => Math.random() - 0.5));
        setGuess('');
    }, [bank]);
    useEffect(() => {
        const t = setTimeout(() => {
            run.begin();
            pick(difficulty);
        }, 0);
        return () => clearTimeout(t);
    }, []);
    const submit = () => {
        if (guess.trim().toLowerCase() === word.toLowerCase()) {
            const points = 100 + letters.length * 5;
            const nextCount = solvedCount + 1;
            setSolvedCount(nextCount);
            if (nextCount >= TOTAL) {
                void (async () => {
                    const score = 1000 + nextCount * 50;
                    await run.finish(score, { solved: nextCount, language });
                    setResult({ score, headline: 'Word Wizard! 🔤', detail: `${nextCount} words solved · ${language.toUpperCase()}` });
                })();
            }
            else {
                pick(difficulty);
            }
        }
        else {
            setShake(true);
            setTimeout(() => setShake(false), 400);
        }
    };
    const restart = () => {
        setSolvedCount(0);
        setResult(null);
        run.begin();
        pick(difficulty);
    };
    return (<GameFrame title={uiText("Word Scramble")} icon={<LettersIcon className="h-5 w-5 text-emerald-600"/>} difficulty={difficulty} onDifficultyChange={(d) => { setDifficulty(d); setSolvedCount(0); setResult(null); run.begin(); pick(d); }} difficulties={DIFFS} status={`Solved ${solvedCount}/${TOTAL}`} onExit={onExit}>
      <div className="relative rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex justify-center gap-1.5">
          {uiText(letters.map((l, i) => (<span key={i} className="flex h-10 w-9 items-center justify-center rounded-lg bg-emerald-50 text-lg font-bold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{uiText(l)}</span>)))}
        </div>
        <div className="mx-auto flex max-w-xs gap-2">
          <Input value={guess} onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter')
        submit(); }} placeholder={uiText("Unscramble the word")} disabled={!!result} aria-label={uiText("Word guess")} className={cn('text-center', shake && 'border-rose-400')}/>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={!!result}>{uiText("Check")}</Button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">{uiText("Rebuild the hidden word from the shuffled letters.")}</p>
        {result && <ResultOverlay result={result} earned={run.earned} submitting={run.submitting} saveFailed={run.saveFailed} onRestart={restart} onExit={onExit}/>}
      </div>
    </GameFrame>);
}
// ---------------- Focus Tap (reaction) ----------------
export function FocusTap({ onExit }: {
    onExit: () => void;
}) {
    const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
    const [state, setState] = useState<'idle' | 'waiting' | 'go' | 'early'>('idle');
    const [hits, setHits] = useState(0);
    const [round, setRound] = useState(0);
    const [score, setScore] = useState(0);
    const [best, setBest] = useState<number | null>(null);
    const [result, setResult] = useState<{
        score: number;
        headline: string;
        detail: string;
    } | null>(null);
    const run = useSoloRun('focus-tap', difficulty);
    const goAt = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ROUNDS = 10;
    const schedule = useCallback((d: Difficulty) => {
        setState('waiting');
        const min = d === 'HARD' ? 900 : d === 'MEDIUM' ? 1300 : 800;
        const max = d === 'HARD' ? 2600 : d === 'MEDIUM' ? 3200 : 2200;
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            goAt.current = performance.now();
            setState('go');
        }, min + Math.random() * (max - min));
    }, []);
    useEffect(() => () => { if (timer.current)
        clearTimeout(timer.current); }, []);
    const tap = () => {
        if (result)
            return;
        if (state === 'idle' || state === 'early') {
            schedule(difficulty);
            return;
        }
        if (state === 'waiting') {
            setState('early');
            if (timer.current)
                clearTimeout(timer.current);
            return;
        }
        if (state === 'go') {
            const rt = Math.round(performance.now() - goAt.current);
            setBest((b) => (b === null ? rt : Math.min(b, rt)));
            const windowMs = difficulty === 'HARD' ? 700 : difficulty === 'MEDIUM' ? 900 : 1100;
            const points = Math.max(20, Math.round(100 * (1 - rt / windowMs)) + 20);
            setScore((s) => s + points);
            setHits((h) => h + 1);
            const nextRound = round + 1;
            setRound(nextRound);
            if (nextRound >= ROUNDS) {
                void (async () => {
                    await run.finish(score + points, { hits: hits + 1, bestRt: best ? Math.min(best, rt) : rt, difficulty });
                    setResult({ score: score + points, headline: 'Sharp focus! ⚡', detail: `Best reaction: ${best ? Math.min(best, rt) : rt} ms` });
                })();
            }
            else
                schedule(difficulty);
        }
    };
    const restart = () => {
        setHits(0);
        setRound(0);
        setScore(0);
        setBest(null);
        setResult(null);
        setState('idle');
        run.begin();
    };
    return (<GameFrame title={uiText("Focus Tap")} icon={<Zap className="h-5 w-5 text-sky-500"/>} difficulty={difficulty} onDifficultyChange={(d) => { setDifficulty(d); restart(); }} difficulties={DIFFS} status={result ? undefined : `Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS} · Score ${score}`} onExit={onExit}>
      <div className="relative rounded-2xl border border-border bg-card p-6">
        <button onClick={tap} disabled={!!result} aria-label={state === 'go' ? uiText("Tap now") : uiText("Wait then tap")} className={cn('flex h-64 w-full items-center justify-center rounded-2xl text-xl font-bold text-white transition-colors duration-150', state === 'go' ? 'bg-teal-500' : state === 'waiting' ? 'bg-slate-400 dark:bg-slate-600' : state === 'early' ? 'bg-rose-400' : 'bg-sky-500 hover:bg-sky-600')}>
          {state === 'idle' && uiText("Tap to start")}
          {state === 'waiting' && uiText("Wait for teal\u2026")}
          {state === 'go' && uiText("TAP NOW!")}
          {state === 'early' && uiText("Too early \u2014 tap to retry")}
        </button>
        <div className="mt-4 flex justify-center gap-3">
          <ScoreChip label={uiText("Score")} value={score}/>
          <ScoreChip label={uiText("Best reaction")} value={best ? `${best} ms` : '—'}/>
          <ScoreChip label={uiText("Hits")} value={`${hits}/${ROUNDS}`}/>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">{uiText("A friendly reaction challenge \u2014 scores measure game performance only.")}</p>
        {result && <ResultOverlay result={result} earned={run.earned} submitting={run.submitting} saveFailed={run.saveFailed} onRestart={restart} onExit={onExit}/>}
      </div>
    </GameFrame>);
}
export { CountdownBar };
