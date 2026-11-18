'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/store';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
interface Game {
    slug: string;
    name: string;
    tagline: string;
    modes: string[];
}
export default function TeacherGamePicker({ students, onClose, onSent }: {
    students: {
        userId: string;
        name: string;
    }[];
    onClose: () => void;
    onSent: (roomCode: string, gameSlug: string, invitationId: string) => void;
}) {
    const [games, setGames] = useState<Game[]>([]);
    const [studentId, setStudentId] = useState(students.length === 1 ? students[0].userId : '');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    useEffect(() => {
        let cancelled = false;
        api<{
            games: Game[];
        }>('/api/games').then((data) => {
            if (!cancelled)
                setGames(data.games.filter((game) => game.modes.includes('DUEL') && ['tic-tac-toe', 'memory-match', 'quick-math'].includes(game.slug)));
        }).catch(() => {
            if (!cancelled)
                setError('Could not load games');
        });
        return () => { cancelled = true; };
    }, []);
    const send = async (slug: string) => {
        const target = students.length === 1 ? students[0].userId : studentId;
        if (!target || inFlight.current)
            return;
        inFlight.current = true;
        setSending(true);
        setError('');
        try {
            const result = await api<{
                roomCode: string;
                invitationId: string;
            }>('/api/games/invitations', { method: 'POST', json: { action: 'create', toUserId: target, gameSlug: slug } });
            onSent(result.roomCode, slug, result.invitationId);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the game');
        }
        finally {
            inFlight.current = false;
            setSending(false);
        }
    };
    return <Dialog open onOpenChange={(open) => {
            if (!open && !sending)
                onClose();
        }}><DialogContent className="teacher-game-picker sm:max-w-md"><span className="classroom-picker-icon"><Gamepad2 size={25}/></span><DialogTitle>{uiText("Send a learning game")}</DialogTitle><DialogDescription>{uiText("Choose a game. Your student receives an invitation and can join when they accept.")}</DialogDescription>{students.length > 1 && <Select value={studentId} onValueChange={setStudentId}><SelectTrigger aria-label={uiText("Student to invite")}><SelectValue placeholder={uiText("Choose a student")}/></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.userId} value={student.userId}>{student.name}</SelectItem>)}</SelectContent></Select>}{students.length === 0 && <p className="text-sm text-muted-foreground">{uiText("A student needs to join the classroom first.")}</p>}<div className="teacher-game-options">{games.map((game) => <button key={game.slug} disabled={sending || students.length === 0 || students.length > 1 && !studentId} onClick={() => void send(game.slug)}><span><strong>{game.name}</strong><small>{uiText(game.tagline)}</small></span>{sending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}</button>)}</div>{error && <p role="alert" className="text-sm text-red-600">{uiText(error)}</p>}<Button variant="outline" onClick={onClose} disabled={sending}>{uiText("Back to lesson")}</Button></DialogContent></Dialog>;
}
