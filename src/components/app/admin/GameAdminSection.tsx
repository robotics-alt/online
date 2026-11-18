'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Admin — Brain Games management: enable/disable games, usage analytics,
 * recent matches. Modern stat-card layout, dark-mode ready via tokens.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gamepad2, Loader2, RefreshCw, Users, Activity, Award, TrendingUp } from 'lucide-react';
interface AdminData {
    stats: {
        totalMatches: number;
        weekMatches: number;
        activeRooms: number;
        achievementCount: number;
    };
    games: {
        id: string;
        slug: string;
        name: string;
        category: string;
        active: boolean;
        maxPlayers: number;
    }[];
    matches: {
        id: string;
        game: string;
        mode: string;
        difficulty: string;
        status: string;
        startedAt: string;
        durationSec: number;
        players: {
            name: string;
            score: number;
            result: string | null;
        }[];
    }[];
    popularity: {
        slug: string;
        name: string;
        plays: number;
    }[];
}
export default function GameAdminSection() {
    const [data, setData] = useState<AdminData | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await api<AdminData>('/api/games/admin'));
        }
        catch { /* handled by caller layout */ }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const toggleGame = async (gameId: string, active: boolean) => {
        setToggling(gameId);
        try {
            await api('/api/games', { method: 'PATCH', json: { gameId, active } });
            await load();
        }
        finally {
            setToggling(null);
        }
    };
    if (loading)
        return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Loading games data\u2026")}</div>;
    if (!data)
        return <p className="py-10 text-center text-sm text-muted-foreground">{uiText("Could not load games data. Try refreshing.")}</p>;
    const maxPlays = Math.max(1, ...data.popularity.map((p) => p.plays));
    return (<div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {uiText([
            { label: 'Games played', value: data.stats.totalMatches, icon: Gamepad2, tone: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' },
            { label: 'This week', value: data.stats.weekMatches, icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60' },
            { label: 'Active rooms', value: data.stats.activeRooms, icon: Users, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/60' },
            { label: 'Badges earned', value: data.stats.achievementCount, icon: Award, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' },
        ].map((c) => (<div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{uiText(c.label)}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${c.tone}`}><c.icon className="h-4 w-4"/></span>
            </div>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">{c.value}</p>
          </div>)))}
      </div>

      {/* Game management */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Gamepad2 className="h-4 w-4 text-teal-600"/>{uiText(" Game catalog")}</h3>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>{uiText(" Refresh")}</Button>
        </div>
        <div className="overflow-x-auto scroll-slim">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("Game")}</TableHead>
                <TableHead>{uiText("Category")}</TableHead>
                <TableHead>{uiText("Max players")}</TableHead>
                <TableHead>{uiText("Popularity")}</TableHead>
                <TableHead className="text-right">{uiText("Enabled")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.games.map((g) => {
            const plays = data.popularity.find((p) => p.slug === g.slug)?.plays ?? 0;
            return (<TableRow key={g.id}>
                    <TableCell className="font-medium text-foreground">{g.name}</TableCell>
                    <TableCell><Badge variant="outline" className="border-border text-muted-foreground">{uiText(g.category)}</Badge></TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{uiText(g.maxPlayers)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${(plays / maxPlays) * 100}%` }}/>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{uiText(plays)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-2">
                        {toggling === g.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground"/>}
                        <Switch checked={g.active} onCheckedChange={(v) => void toggleGame(g.id, v)} aria-label={uiText("Toggle {{value1}}", { value1: g.name })}/>
                      </span>
                    </TableCell>
                  </TableRow>);
        })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent matches */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Activity className="h-4 w-4 text-teal-600"/>{uiText(" Recent matches")}</h3>
        </div>
        <div className="max-h-96 overflow-y-auto scroll-slim">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("Game")}</TableHead>
                <TableHead>{uiText("Mode")}</TableHead>
                <TableHead>{uiText("Result")}</TableHead>
                <TableHead>{uiText("When")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.matches.length === 0 && uiText((<TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">{uiText("No matches played yet.")}</TableCell></TableRow>))}
              {data.matches.map((m) => (<TableRow key={m.id}>
                  <TableCell className="font-medium text-foreground">{uiText(m.game)} <span className="text-xs text-muted-foreground">({uiText(m.difficulty.toLowerCase())})</span></TableCell>
                  <TableCell><Badge variant="outline" className="border-border text-muted-foreground">{uiText(m.mode)}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.players.map((p) => `${p.name}: ${p.score}${p.result === 'WIN' ? ' 🏆' : ''}`).join(' · ')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{uiText(new Date(m.startedAt).toLocaleString())}</TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>);
}
