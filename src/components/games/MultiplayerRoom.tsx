'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Multiplayer game room — lobby (ready/host/start/leave), synchronized
 * gameplay for Tic-Tac-Toe / Memory / Quick Math, live scoreboard and
 * winner announcement. All state is server-authoritative.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useGameSocket, useGameRoom, type GameSession } from '@/lib/games-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, Crown, Copy, Trophy, Wifi, WifiOff } from 'lucide-react';
import { TTTBoard, type Cell } from './TicTacToeSolo';
import { MemoryBoard } from './MemorySolo';
import { MathQuestionPanel, MATH_TOTAL_Q } from './QuickMathSolo';
import { cn } from '@/lib/utils';
interface GameMeta {
    slug: string;
    name: string;
}
export default function MultiplayerRoom({ roomCode, game, onExit }: {
    roomCode: string;
    game: GameMeta;
    onExit: () => void;
}) {
    const { user } = useApp();
    const { socket, connected } = useGameSocket();
    const { session, error, ready, start, move, answer, rematch, leave } = useGameRoom(socket, roomCode);
    const [copied, setCopied] = useState(false);
    const [difficulty, setDifficulty] = useState('MEDIUM');
    const [fb, setFb] = useState<{
        qSeq: number;
        correct: boolean;
        points: number;
    } | null>(null);
    const serverQSeq = (session?.state as {
        qSeq?: number;
    } | undefined)?.qSeq ?? -1;
    // Feedback only applies to the question it was given for — no effect needed.
    const feedback = fb && fb.qSeq === serverQSeq ? { correct: fb.correct, points: fb.points } : null;
    useEffect(() => {
        if (error)
            leave();
    }, [error, leave]);
    const me = session?.players.find((p) => p.userId === user?.id);
    const isHost = !!me?.isHost;
    const lobby = session?.status === 'LOBBY';
    const playing = session?.status === 'PLAYING';
    const over = session?.status === 'FINISHED';
    const GAME_NAMES: Record<string, string> = { 'tic-tac-toe': 'Tic-Tac-Toe', 'memory-match': 'Memory Match', 'quick-math': 'Quick Math Battle' };
    const liveName = session ? (GAME_NAMES[session.slug] ?? session.slug) : game.name;
    const sorted = useMemo(() => [...(session?.players ?? [])].sort((a, b) => b.score - a.score), [session]);
    // Tic-Tac-Toe winners come from round wins (server state), not points
    const tttWinnerSeat = session?.slug === 'tic-tac-toe'
        ? (session.state as {
            matchWinner?: number | null;
        } | undefined)?.matchWinner ?? null
        : null;
    const winner = tttWinnerSeat !== null && tttWinnerSeat !== undefined
        ? session?.players.find((p) => p.seat === tttWinnerSeat) ?? null
        : sorted[0] && sorted[1] && sorted[0].score !== sorted[1].score ? sorted[0] : null;
    const draw = over && !winner;
    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(roomCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch { /* ignore */ }
    };
    if (error) {
        return (<div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-4xl">🕹️</p>
        <h3 className="mt-3 text-lg font-bold text-foreground">{uiText(error)}</h3>
        <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={onExit}>{uiText("Back to games")}</Button>
      </div>);
    }
    if (!session || !connected) {
        return (<div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Connecting to the game room\u2026")}</div>);
    }
    return (<div className="mx-auto w-full max-w-3xl">
      {/* Room header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{liveName} <span className="text-muted-foreground">{uiText("\u00B7 live room")}</span></h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-mono tracking-widest">{uiText(roomCode)}</Badge>
            <button onClick={copyCode} className="inline-flex items-center gap-1 hover:text-teal-600" aria-label={uiText("Copy room code")}>
              <Copy className="h-3.5 w-3.5"/> {copied ? uiText("Copied!") : uiText("Share code")}
            </button>
            {connected ? <span className="inline-flex items-center gap-1 text-teal-600"><Wifi className="h-3.5 w-3.5"/>{uiText(" live")}</span> : <span className="inline-flex items-center gap-1 text-rose-500"><WifiOff className="h-3.5 w-3.5"/>{uiText(" reconnecting\u2026")}</span>}
          </div>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => { leave(); onExit(); }}>{uiText("Leave room")}</Button>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {sorted.map((p) => (<div key={p.userId} className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors', playing && session.state.turn === p.seat && (session.slug === 'tic-tac-toe' || session.slug === 'memory-match')
                ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/40' : 'border-border bg-card')}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={p.avatarUrl ?? undefined} alt={p.name}/>
              <AvatarFallback className="bg-teal-600 text-sm text-white">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                {p.name} {p.userId === user?.id && <span className="text-xs text-muted-foreground">{uiText("(you)")}</span>}
                {p.isHost && <Crown className="h-3.5 w-3.5 text-amber-500"/>}
                {!p.connected && <span className="text-xs text-rose-500">{uiText("offline")}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{lobby ? uiText((p.ready ? 'Ready' : 'Not ready')) : uiText("{{value1}} points", { value1: p.score })}</p>
            </div>
            {playing && (session.slug === 'tic-tac-toe' || session.slug === 'memory-match') && uiText((<Badge variant="outline" className="ml-auto shrink-0 border-border text-muted-foreground">{session.slug === 'tic-tac-toe' ? uiText("Rounds {{value1}}", { value1: ((session.state as {
                        wins?: number[];
                    }).wins ?? [0, 0])[p.seat] }) : uiText("{{value1}}", { value1: p.score })}</Badge>))}
          </div>))}
      </div>

      {/* Lobby */}
      {lobby && uiText((<div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Users className="h-4 w-4 text-teal-600"/>{uiText(" Lobby \u2014 ")}{uiText(session.players.length)}/{uiText(session.maxPlayers)}{uiText(" players")}</div>
          <p className="mt-2 text-sm text-muted-foreground">{uiText("Share the room code ")}<span className="font-mono font-bold text-foreground">{uiText(roomCode)}</span>{uiText(" so the other player can join from the Game Center \u2192 Join with code.")}</p>
          {isHost && session.players.length >= 2 && uiText((<div className="mt-4 flex flex-wrap items-center gap-3">
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="w-[140px]" aria-label={uiText("Match difficulty")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">{uiText("Easy")}</SelectItem>
                  <SelectItem value="MEDIUM">{uiText("Medium")}</SelectItem>
                  <SelectItem value="HARD">{uiText("Hard")}</SelectItem>
                </SelectContent>
              </Select>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => start({ difficulty })}>{uiText("Start match")}</Button>
            </div>))}
          {isHost && session.players.length < 2 && <p className="mt-4 text-sm text-muted-foreground">{uiText("Waiting for another player to join\u2026")}</p>}
          <div className="mt-4">
            {me && uiText((<Button variant={me.ready ? 'secondary' : 'outline'} size="sm" onClick={() => ready(!me.ready)}>
                {me.ready ? uiText("Ready \u2713") : uiText("Mark ready")}
              </Button>))}
          </div>
        </div>))}

      {/* Game areas */}
      {playing && session.slug === 'tic-tac-toe' && <TTTGameArea session={session} me={me!} onMove={move}/>}
      {playing && session.slug === 'memory-match' && <MemoryGameArea session={session} me={me!} onMove={move}/>}
      {playing && session.slug === 'quick-math' && (<div className="rounded-2xl border border-border bg-card p-6">
          <MathQuestionPanel q={(session.state as {
                question?: {
                    text: string;
                    answer: string;
                };
            }).question
                ? { text: (session.state as {
                        question: {
                            text: string;
                        };
                    }).question.text, answer: '' }
                : null} qSeq={(session.state as {
                qSeq?: number;
            }).qSeq ?? 0} total={(session.state as {
                totalQuestions?: number;
            }).totalQuestions ?? MATH_TOTAL_Q} endedAt={(session.state as {
                endsAt?: number;
            }).endsAt} feedback={feedback} disabled={!!(session.state as {
                answered?: Record<string, unknown>;
            }).answered?.[user?.id ?? ''] || !!(session.state as {
                reveal?: string;
            }).reveal} scores={sorted.map((p) => ({ name: p.name, score: p.score, you: p.userId === user?.id }))} onAnswer={(ans) => {
                const qSeq = (session.state as {
                    qSeq?: number;
                }).qSeq ?? 0;
                answer(qSeq, ans);
                // local optimistic feedback; authoritative state update follows
                setFb({ qSeq, correct: true, points: 0 });
                setTimeout(() => setFb(null), 400);
            }}/>
          {!!(session.state as {
                reveal?: string;
            }).reveal && uiText((<p className="mt-3 text-center text-sm font-semibold text-amber-600">{uiText("Answer was: ")}{uiText((session.state as {
                    reveal: string;
                }).reveal)}</p>))}
        </div>)}

      {/* Match over */}
      {over && (<div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <Trophy className="h-7 w-7"/>
          </div>
          <h3 className="mt-3 text-xl font-extrabold text-foreground">
            {draw ? uiText("It's a draw!") : uiText("{{value1}} wins! \uD83C\uDF89", { value1: winner?.name })}
          </h3>
          <div className="mt-4 flex justify-center gap-3">
            {sorted.map((p) => (<div key={p.userId} className="rounded-xl border border-border bg-background px-4 py-2 text-sm">
                <p className="font-semibold text-foreground">{p.name}</p>
                <p className="font-bold tabular-nums text-teal-700 dark:text-teal-400">{uiText(p.score)}{uiText(" pts")}</p>
              </div>))}
          </div>
          <div className="mt-5 flex justify-center gap-2">
            {isHost
                ? <Button className="bg-teal-600 hover:bg-teal-700" onClick={rematch}>{uiText("Rematch")}</Button>
                : <p className="text-sm text-muted-foreground">{uiText("Waiting for the host to start a rematch\u2026")}</p>}
            <Button variant="outline" onClick={() => { leave(); onExit(); }}>{uiText("Back to games")}</Button>
          </div>
        </div>)}
    </div>);
}
function TTTGameArea({ session, me, onMove }: {
    session: GameSession;
    me: {
        seat: number;
    };
    onMove: (p: {
        cell: number;
    }) => void;
}) {
    const st = session.state as {
        board: Cell[];
        turn: number;
        round: number;
        wins: number[];
        roundOver: boolean;
        roundWinner: number | 'draw' | null;
        line: number[] | null;
        matchWinner: number | null;
    };
    const myTurn = st?.turn === me.seat && !st?.roundOver;
    return (<div className="rounded-2xl border border-border bg-card p-6">
      <p className="mb-4 text-center text-sm font-semibold text-foreground">{uiText("Round ")}{uiText(st.round)} · {uiText(st.wins[0])} : {uiText(st.wins[1])} {st.roundOver ? uiText((st.roundWinner === 'draw' ? '· draw' : '· round won!')) : myTurn ? uiText("\u00B7 your turn") : uiText("\u00B7 opponent's turn")}
      </p>
      <TTTBoard board={st.board} line={st.line} marks={{ X: session.players.find((p) => p.seat === 0)?.name.slice(0, 1) ?? 'X', O: session.players.find((p) => p.seat === 1)?.name.slice(0, 1) ?? 'O' }} onPlay={(cell) => {
            if (myTurn)
                onMove({ cell });
        }} disabled={!myTurn}/>
      <p className="mt-4 text-center text-xs text-muted-foreground">{uiText("First to win 2 rounds takes the match. Illegal moves are rejected by the server.")}</p>
    </div>);
}
function MemoryGameArea({ session, me, onMove }: {
    session: GameSession;
    me: {
        seat: number;
    };
    onMove: (p: {
        index: number;
    }) => void;
}) {
    const st = session.state as {
        deck: number[];
        flipped: number[];
        matched: boolean[];
        turn: number;
        scores: number[];
        busy: boolean;
    };
    const myTurn = st?.turn === me.seat && !st?.busy;
    return (<div className="rounded-2xl border border-border bg-card p-6">
      <p className="mb-4 text-center text-sm font-semibold text-foreground">
        {myTurn ? uiText("Your turn \u2014 flip two cards") : uiText("{{value1}}'s turn", { value1: session.players.find((p) => p.seat === st?.turn)?.name })}
      </p>
      <MemoryBoard deck={st.deck} flipped={st.flipped} matched={st.matched} onFlip={(i) => {
            if (myTurn)
                onMove({ index: i });
        }} disabled={!myTurn}/>
    </div>);
}
