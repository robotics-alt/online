'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
type Game = {
    id: string;
    name: string;
    tagline: string;
    description: string;
    icon: string;
    sortOrder: number;
    active: boolean;
};
export default function GameDetailsEditor() {
    const [games, setGames] = useState<Game[]>([]), [editing, setEditing] = useState<Game | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const load = () => api<{
        games: Game[];
    }>('/api/games?all=1').then(d => setGames(d.games));
    useEffect(() => { void load().catch(e => setError(e.message)); }, []);
    return <section className="mb-7 rounded-2xl border bg-card p-6"><h2 className="text-xl font-bold">{uiText("Game content")}</h2><p className="mt-2 text-sm text-muted-foreground">{uiText("Edit game names, descriptions, icons and display order.")}</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{games.map(g => <button className="rounded-xl border p-4 text-left hover:border-primary" key={g.id} onClick={() => { setEditing({ ...g }); setError(''); }}><strong>{g.name}</strong><p className="mt-1 text-sm text-muted-foreground">{uiText(g.tagline)}</p></button>)}</div><Dialog open={!!editing} onOpenChange={o => {
            if (!o)
                setEditing(null);
        }}><DialogContent className="max-h-[90dvh] overflow-auto"><DialogTitle>{uiText("Edit learning game")}</DialogTitle><DialogDescription>{uiText("The game engine stays the same. Text and visibility update in the catalogue.")}</DialogDescription>{editing && <><label>{uiText("Name")}<Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label><label>{uiText("Tagline")}<Input value={editing.tagline} onChange={e => setEditing({ ...editing, tagline: e.target.value })}/></label><label>{uiText("Description")}<Textarea rows={5} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}/></label><label>{uiText("Icon name")}<Input value={editing.icon} onChange={e => setEditing({ ...editing, icon: e.target.value })}/></label><label>{uiText("Display order")}<Input type="number" value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })}/></label><label className="flex gap-2"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })}/>{uiText("Active")}</label>{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}<Button disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                    await api('/api/games', { method: 'PATCH', json: { ...editing, gameId: editing.id } });
                    await load();
                    setEditing(null);
                }
                catch (e) {
                    setError((e as Error).message);
                }
                finally {
                    setBusy(false);
                }
            }}>{uiText("Save game")}</Button></>}</DialogContent></Dialog></section>;
}
