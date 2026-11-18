'use client';
import { uiText } from "@/lib/ui-text";
/**
 * Polls for incoming game invitations and offers Accept / Decline.
 * Mounted once inside AppShell.
 */
import { useEffect, useRef, useState } from 'react';
import { useApp, api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gamepad2 } from 'lucide-react';
interface GameInvite {
    id: string;
    roomCode: string;
    game: {
        slug: string;
        name: string;
    } | null;
    from: {
        name: string;
        role: string;
    } | null;
    expiresAt: string;
}
export default function GameInvitationWatcher() {
    const { user, go } = useApp();
    const [invite, setInvite] = useState<GameInvite | null>(null);
    const seen = useRef(new Set<string>());
    useEffect(() => {
        if (!user)
            return;
        let cancelled = false;
        const poll = async () => {
            try {
                const res = await api<{
                    invitations: GameInvite[];
                }>('/api/games/invitations');
                if (cancelled)
                    return;
                const pending = res.invitations.find((i) => !seen.current.has(i.id));
                if (pending)
                    setInvite(pending);
            }
            catch { /* ignore */ }
        };
        void poll();
        const t = setInterval(poll, 12000);
        window.addEventListener('refresh-game-invitations', poll);
        return () => { cancelled = true; clearInterval(t); window.removeEventListener('refresh-game-invitations', poll); };
    }, [user?.id]);
    const respond = async (accept: boolean) => {
        if (!invite)
            return;
        seen.current.add(invite.id);
        const current = invite;
        setInvite(null);
        try {
            if (accept) {
                const res = await api<{
                    roomCode: string;
                }>('/api/games/invitations', {
                    method: 'POST', json: { action: 'accept', invitationId: current.id },
                });
                if (useApp.getState().view.name === 'classroom')
                    window.dispatchEvent(new CustomEvent('lesson-game-accepted', { detail: { roomCode: res.roomCode, gameSlug: current.game?.slug ?? 'tic-tac-toe' } }));
                else
                    go('games', { room: res.roomCode, game: current.game?.slug ?? 'tic-tac-toe' });
            }
            else {
                await api('/api/games/invitations', { method: 'POST', json: { action: 'decline', invitationId: current.id } });
            }
        }
        catch { /* expired invites fail gracefully */ }
    };
    return (<Dialog open={!!invite} onOpenChange={(open) => { if (!open) {
        seen.current.add(invite?.id ?? '');
        setInvite(null);
    } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Gamepad2 className="h-4 w-4"/></span>{uiText("Game challenge!")}</DialogTitle>
          <DialogDescription>
            {invite?.from?.name ?? uiText("Someone")}{uiText(" invites you to a ")}{invite?.game?.name ?? uiText("game")}{uiText(" duel. Do you accept?")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => respond(true)}>{uiText("Accept & join")}</Button>
          <Button variant="outline" className="flex-1" onClick={() => respond(false)}>{uiText("Decline")}</Button>
        </div>
      </DialogContent>
    </Dialog>);
}
