'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Brain Games & Activities — Game Center hub.
 * Catalog from the DB, solo + multiplayer launchers, join-by-code,
 * personal stats, achievements and saved gallery.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApp, api } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2, Users, Sparkles, Wind, Trophy, History, Puzzle, Grid3X3, Brain, Sigma, Type as LettersIcon, Zap, Palette, Loader2, Award, Play, LogIn, } from 'lucide-react';
import { GameBadges } from './shared';
import TicTacToeSolo from './TicTacToeSolo';
import MemorySolo from './MemorySolo';
import QuickMathSolo from './QuickMathSolo';
import { SlidingPuzzle, WordScramble, FocusTap } from './MiniGames';
import { GuidedBreathing, FreeDraw } from './RelaxActivities';
import MultiplayerRoom from './MultiplayerRoom';
import { cn } from '@/lib/utils';
interface CatalogGame {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    description: string;
    icon: string;
    category: string;
    modes: string[];
    maxPlayers: number;
    difficulty: string[];
    ageGroups: string[];
    avgMinutes: number;
    accent: string;
    engine: string;
}
interface HistoryRow {
    id: string;
    game: {
        slug: string;
        name: string;
    };
    mode: string;
    difficulty: string;
    myScore: number;
    myResult: string | null;
    startedAt: string;
    players: {
        name: string;
        score: number;
        result: string | null;
    }[];
}
interface AchievedRow {
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    earnedAt: string;
}
const ICONS: Record<string, typeof Puzzle> = {
    'grid-3x3': Grid3X3, brain: Brain, sigma: Sigma, puzzle: Puzzle, letters: LettersIcon, zap: Zap, wind: Wind, palette: Palette,
};
const ACCENT_BG: Record<string, string> = {
    teal: 'from-teal-500 to-teal-600', violet: 'from-violet-500 to-violet-600', amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600', emerald: 'from-emerald-500 to-emerald-600', sky: 'from-sky-500 to-sky-600',
    cyan: 'from-cyan-500 to-cyan-600', fuchsia: 'from-fuchsia-500 to-fuchsia-600',
};
export default function GameCenter({ initialRoomCode, initialGameSlug, onExit }: {
    initialRoomCode?: string;
    initialGameSlug?: string;
    onExit: () => void;
}) {
    const { user, language } = useApp();
    const [games, setGames] = useState<CatalogGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState<{
        kind: 'solo';
        slug: string;
    } | {
        kind: 'room';
        code: string;
        slug: string;
    } | null>(null);
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [stats, setStats] = useState<{
        plays: number;
        wins: number;
        winRate: number;
        bestByGame: Record<string, number>;
    } | null>(null);
    const [achieved, setAchieved] = useState<AchievedRow[]>([]);
    const [gallery, setGallery] = useState<{
        id: string;
        title: string;
        data: string;
        kind: string;
    }[]>([]);
    const [tab, setTab] = useState('arcade');
    const loadCatalog = useCallback(async () => {
        try {
            const res = await api<{
                games: CatalogGame[];
            }>('/api/games');
            setGames(res.games);
        }
        catch { /* landing fallback */ }
        finally {
            setLoading(false);
        }
    }, []);
    const loadStats = useCallback(async () => {
        if (!user)
            return;
        try {
            const res = await api<{
                matches: HistoryRow[];
                stats: typeof stats;
                achievements: AchievedRow[];
            }>('/api/games/history');
            setHistory(res.matches);
            setStats(res.stats);
            setAchieved(res.achievements);
            const g = await api<{
                projects: typeof gallery;
            }>('/api/games/projects');
            setGallery(g.projects.filter((p) => p.kind === 'DRAWING'));
        }
        catch { /* ignore */ }
    }, [user]);
    useEffect(() => { void loadCatalog(); }, [loadCatalog]);
    useEffect(() => { void loadStats(); }, [loadStats]);
    useEffect(() => {
        if (initialRoomCode && initialGameSlug)
            setActive({ kind: 'room', code: initialRoomCode, slug: initialGameSlug });
        else if (initialRoomCode)
            setJoinCode(initialRoomCode);
    }, []);
    const joinByCode = async () => {
        setJoinError('');
        const code = joinCode.trim().toUpperCase();
        if (code.length < 4) {
            setJoinError('Enter the 6-character room code');
            return;
        }
        // The room itself validates membership; find the game via history-free lookup:
        // join UI just hands off — server tells us the game when we connect.
        setActive({ kind: 'room', code, slug: games.find((g) => g.modes.includes('DUEL'))?.slug ?? 'tic-tac-toe' });
    };
    const soloFor = (slug: string) => {
        switch (slug) {
            case 'tic-tac-toe': return <TicTacToeSolo onExit={() => setActive(null)}/>;
            case 'memory-match': return <MemorySolo onExit={() => setActive(null)}/>;
            case 'quick-math': return <QuickMathSolo onExit={() => setActive(null)}/>;
            case 'sliding-puzzle': return <SlidingPuzzle onExit={() => setActive(null)}/>;
            case 'word-scramble': return <WordScramble onExit={() => setActive(null)} language={language}/>;
            case 'focus-tap': return <FocusTap onExit={() => setActive(null)}/>;
            case 'guided-breathing': return <GuidedBreathing onExit={() => setActive(null)}/>;
            case 'free-draw': return <FreeDraw onExit={() => setActive(null)}/>;
            default: return null;
        }
    };
    const GameCard = ({ g }: {
        g: CatalogGame;
    }) => {
        const Icon = ICONS[g.icon] ?? Gamepad2;
        return (<div className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg">
        <div className={cn('mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow', ACCENT_BG[g.accent] ?? ACCENT_BG.teal)}>
          <Icon className="h-6 w-6"/>
        </div>
        <h3 className="font-bold text-foreground">{g.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{uiText(g.tagline)}</p>
        <div className="mt-3"><GameBadges modes={g.modes} players={g.maxPlayers > 1 ? `${g.maxPlayers} players` : '1 player'} minutes={g.avgMinutes} age={g.ageGroups[0]}/></div>
        <div className="mt-4 flex gap-2">
          {g.modes.includes('SOLO') && uiText((<Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => setActive({ kind: 'solo', slug: g.slug })}>
              <Play className="mr-1 h-3.5 w-3.5"/>{uiText(" Play")}</Button>))}
          {g.modes.includes('DUEL') && user && uiText((<Button size="sm" variant="outline" className="flex-1 border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-950/40" onClick={() => setActive({ kind: 'room', code: '', slug: g.slug })}>
              <Users className="mr-1 h-3.5 w-3.5"/>{uiText(" Multiplayer")}</Button>))}
        </div>
      </div>);
    };
    // ---------- Active game / room ----------
    if (user?.role === 'STUDENT' && (!initialRoomCode || active?.kind !== 'room' || active.code !== initialRoomCode)) {
        return <div className="mx-auto max-w-sm py-16 text-center"><Gamepad2 className="mx-auto mb-5 size-12 text-indigo-500"/><h2 className="text-xl font-semibold">{uiText("A game, with your teacher.")}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{uiText("Your teacher will send you an invitation when it is time to play. Accept it to join their game.")}</p><Button variant="outline" className="mt-6" onClick={onExit}>{uiText("Back to learning")}</Button></div>;
    }
    if (active?.kind === 'solo') {
        const g = games.find((x) => x.slug === active.slug);
        return <div className="py-2">{soloFor(active.slug) ?? <p className="text-center text-muted-foreground">{uiText("Game unavailable.")}</p>}{g && <span className="sr-only">{g.name}</span>}</div>;
    }
    if (active?.kind === 'room') {
        // Multiplayer: create-or-join flow when no code yet
        if (!active.code)
            return (<CreateRoomFlow gameSlug={active.slug} games={games} onBack={() => setActive(null)} onJoined={(code) => setActive({ kind: 'room', code, slug: active.slug })} onExit={onExit}/>);
        return <MultiplayerRoom key={active.code} roomCode={active.code} game={{ slug: active.slug, name: games.find((g) => g.slug === active.slug)?.name ?? 'Multiplayer' }} onExit={() => { setActive(null); void loadStats(); }}/>;
    }
    const soloGames = games.filter((g) => g.category !== 'RELAX');
    const relaxGames = games.filter((g) => g.category === 'RELAX');
    return (<div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card/15 backdrop-blur">
            <Gamepad2 className="h-8 w-8"/>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{uiText("Brain Games & Activities")}</h1>
            <p className="mt-1 text-sm text-teal-50/90">{uiText("Play solo, challenge your tutor or classmates, or take a calm break. ")}{user ? uiText("Welcome back, {{value1}}!", { value1: user.name.split(' ')[0] }) : uiText("Log in to save your progress.")}</p>
          </div>
          {stats && uiText((<div className="flex gap-4 text-center">
              <div><p className="text-2xl font-extrabold tabular-nums">{uiText(stats.plays)}</p><p className="text-xs text-teal-100">{uiText("games played")}</p></div>
              <div><p className="text-2xl font-extrabold tabular-nums">{uiText(stats.wins)}</p><p className="text-xs text-teal-100">{uiText("wins")}</p></div>
              <div><p className="text-2xl font-extrabold tabular-nums">{uiText(achieved.length)}</p><p className="text-xs text-teal-100">{uiText("badges")}</p></div>
            </div>))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto scroll-slim">
          <TabsTrigger value="arcade"><Gamepad2 className="mr-1.5 h-4 w-4"/>{uiText(" Arcade")}</TabsTrigger>
          <TabsTrigger value="multiplayer"><Users className="mr-1.5 h-4 w-4"/>{uiText(" Multiplayer Arena")}</TabsTrigger>
          <TabsTrigger value="relax"><Wind className="mr-1.5 h-4 w-4"/>{uiText(" Relax & Create")}</TabsTrigger>
          <TabsTrigger value="achievements"><Award className="mr-1.5 h-4 w-4"/>{uiText(" My Achievements")}</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4"/>{uiText(" Game History")}</TabsTrigger>
        </TabsList>

        {/* Arcade */}
        <TabsContent value="arcade" className="mt-5">
          {loading ? uiText((<div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Loading games\u2026")}</div>)) : uiText((<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {uiText(soloGames.map((g) => <GameCard key={g.id} g={g}/>))}
            </div>))}
        </TabsContent>

        {/* Multiplayer */}
        <TabsContent value="multiplayer" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-1">
              <h3 className="flex items-center gap-2 font-bold text-foreground"><LogIn className="h-4 w-4 text-teal-600"/>{uiText(" Join with a code")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{uiText("Got a room code from a friend or your teacher?")}</p>
              <div className="mt-3 flex gap-2">
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={uiText("ABC123")} maxLength={6} className="font-mono tracking-widest" aria-label={uiText("Room code")}/>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={joinByCode}>{uiText("Join")}</Button>
              </div>
              {joinError && <p className="mt-2 text-sm text-rose-500">{uiText(joinError)}</p>}
            </div>
            <div className="lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {uiText(games.filter((g) => g.modes.includes('DUEL') || g.modes.includes('GROUP')).map((g) => <GameCard key={g.id} g={g}/>))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Relax */}
        <TabsContent value="arcade"/>
        <TabsContent value="relax" className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {uiText(relaxGames.map((g) => <GameCard key={g.id} g={g}/>))}
          </div>
          {gallery.length > 0 && uiText((<div className="mt-8">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-foreground"><Palette className="h-4 w-4 text-fuchsia-500"/>{uiText(" My gallery")}</h3>
              <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {uiText(gallery.map((p) => (<img key={p.id} src={p.data} alt={uiText(p.title)} className="aspect-square w-full rounded-xl border border-border object-cover"/>)))}
              </div>
            </div>))}
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="mt-5">
          {!user ? uiText((<p className="py-10 text-center text-muted-foreground">{uiText("Log in to track achievements.")}</p>)) : (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {achieved.length === 0 && <p className="py-6 text-sm text-muted-foreground">{uiText("Play a few games to earn your first badge!")}</p>}
              {achieved.map((a) => (<div key={a.code} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Trophy className="h-5 w-5"/>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{a.name}</p>
                    <p className="text-sm text-muted-foreground">{uiText(a.description)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{uiText(new Date(a.earnedAt).toLocaleDateString())}</p>
                  </div>
                </div>))}
            </div>)}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-5">
          {!user ? uiText((<p className="py-10 text-center text-muted-foreground">{uiText("Log in to see your game history.")}</p>)) : history.length === 0 ? uiText((<p className="py-10 text-center text-muted-foreground">{uiText("No games yet \u2014 your matches will appear here.")}</p>)) : (<div className="max-h-96 space-y-2 overflow-y-auto scroll-slim pr-1">
              {history.map((h) => (<div key={h.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <Badge variant="outline" className="border-border text-muted-foreground">{uiText(h.mode)}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{h.game.name} <span className="font-normal text-muted-foreground">· {uiText(h.difficulty.toLowerCase())}</span></p>
                    <p className="text-xs text-muted-foreground">{uiText(new Date(h.startedAt).toLocaleString())} · {h.players.map((p) => `${p.name} ${p.score}`).join(' vs ')}</p>
                  </div>
                  {h.myResult === 'WIN' && <Badge className="border-0 bg-teal-100 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300">{uiText("Win")}</Badge>}
                  {h.myResult === 'LOSS' && <Badge variant="outline" className="border-border text-muted-foreground">{uiText("Loss")}</Badge>}
                  <span className="text-sm font-bold tabular-nums text-foreground">{uiText(h.myScore)}</span>
                </div>))}
            </div>)}
        </TabsContent>
      </Tabs>
    </div>);
}
/** Create-room flow: pick difficulty + optional invite, then enter the lobby. */
function CreateRoomFlow({ gameSlug, games, onBack, onJoined, onExit }: {
    gameSlug: string;
    games: CatalogGame[];
    onBack: () => void;
    onJoined: (code: string) => void;
    onExit: () => void;
}) {
    const { user } = useApp();
    const { toast } = useToast();
    const [difficulty, setDifficulty] = useState('MEDIUM');
    const [inviteEmail, setInviteEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const game = games.find((g) => g.slug === gameSlug);
    const createRoom = async (toEmail?: string) => {
        setBusy(true);
        try {
            let toUserId: string | undefined;
            if (toEmail) {
                // resolve by email via a lightweight lookup endpoint
                const res = await api<{
                    userId: string;
                }>('/api/games/lookup', { method: 'POST', json: { email: toEmail } });
                toUserId = res.userId;
            }
            if (toUserId) {
                const res = await api<{
                    invitationId: string;
                    roomCode: string;
                }>('/api/games/invitations', {
                    method: 'POST', json: { action: 'create', toUserId, gameSlug, difficulty },
                });
                toast({ title: 'Invitation sent!', description: `Room code ${res.roomCode} — waiting for ${toEmail} to accept.` });
                onJoined(res.roomCode);
            }
            else {
                // Open room without invite: create via invitations-less endpoint
                const res = await api<{
                    roomCode: string;
                }>('/api/games/open-room', { method: 'POST', json: { gameSlug, difficulty } });
                onJoined(res.roomCode);
            }
        }
        catch (e) {
            toast({ title: e instanceof Error ? e.message : 'Could not create the room', variant: 'destructive' });
        }
        finally {
            setBusy(false);
        }
    };
    return (<div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-bold text-foreground">{uiText("Start ")}{game?.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{uiText("Real players only \u2014 invite someone by email or share the room code after creating it.")}</p>
      <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium text-foreground">{uiText("Difficulty")}</p>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger aria-label={uiText("Difficulty")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="EASY">{uiText("Easy")}</SelectItem>
            <SelectItem value="MEDIUM">{uiText("Medium")}</SelectItem>
            <SelectItem value="HARD">{uiText("Hard")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 space-y-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-teal-600 hover:bg-teal-700" disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : <Users className="mr-1.5 h-4 w-4"/>}{uiText(" Create a room")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{uiText("Create room")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{uiText("Invite a specific player by email (they accept from their Game Center), or open the room to anyone with the code.")}</p>
            <InviteForm busy={busy} onSubmit={(email) => { setCreateOpen(false); void createRoom(email || undefined); }}/>
          </DialogContent>
        </Dialog>
        <Button variant="outline" className="w-full" onClick={onBack}>{uiText("Back")}</Button>
      </div>
      {!user && <p className="mt-3 text-center text-xs text-muted-foreground">{uiText("You need an account to play multiplayer.")}</p>}
    </div>);
}
function InviteForm({ busy, onSubmit }: {
    busy: boolean;
    onSubmit: (email: string) => void;
}) {
    const [email, setEmail] = useState('');
    return (<div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">{uiText("Invite by email (optional)")}</p>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={uiText("friend@tutorsphere.app")} aria-label={uiText("Player email")}/>
      </div>
      <Button className="w-full bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => onSubmit(email.trim())}>
        <Sparkles className="mr-1.5 h-4 w-4"/> {email ? uiText("Create & invite") : uiText("Create open room")}
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => onSubmit('')}>{uiText("Skip \u2014 open room")}</Button>
    </div>);
}
