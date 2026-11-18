'use client';
import { uiText } from "@/lib/ui-text";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, ImagePlus, Loader2, MessageCircle, Reply, Search, Send, Smile, X } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { api, useApp } from '@/lib/store';
import { mergeMessages } from '@/lib/chat-messages';
import { getRealtimeUrl } from '@/lib/realtime-url';
import { uploadMedia } from '@/lib/media-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TutorAvatar } from './TutorCard';
import VoiceRecorder from './VoiceRecorder';
import './student-experience.css';
import './platform-upgrades.css';
interface Person {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
    lastSeenAt?: string | null;
}
interface Reaction {
    userId: string;
    emoji: string;
}
interface Message {
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    readAt?: string | null;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    replyToId?: string | null;
    replyBody?: string | null;
    replySenderName?: string | null;
    reactions?: Reaction[];
}
interface Conversation {
    id: string;
    other: Person;
    lastMessage: {
        body: string;
        createdAt: string;
        senderId: string;
    } | null;
    unread: number;
}
interface Thread {
    messages: Message[];
    other: Person;
    socketToken: string;
}
const EMOJIS = ['😀', '😊', '❤️', '👍', '👏', '🎉', '🌟', '📚', '💡', '😂', '🙏', '🔥', '✅', '🤔', '🙌', '😮'];
const REACTIONS = ['❤️', '👍', '😂', '🎉', '👏', '😮', '😢', '🔥'];
const online = (person: Person | null) => Boolean(person?.lastSeenAt && Date.now() - Date.parse(person.lastSeenAt) < 65000);
export default function RichMessagesView({ embedded = false, recipientId }: {
    embedded?: boolean;
    recipientId?: string;
} = {}) {
    const { user, view, go } = useApp(), [conversations, setConversations] = useState<Conversation[]>([]), [activeId, setActiveId] = useState<string | null>(null), [other, setOther] = useState<Person | null>(null), [messages, setMessages] = useState<Message[]>([]), [loading, setLoading] = useState(true), [threadLoading, setThreadLoading] = useState(false), [text, setText] = useState(''), [search, setSearch] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState(''), [typing, setTyping] = useState(false), [replying, setReplying] = useState<Message | null>(null), [emojiOpen, setEmojiOpen] = useState(false), [reactionFor, setReactionFor] = useState<string | null>(null);
    const active = useRef<string | null>(null), socket = useRef<Socket | null>(null), inFlight = useRef(false), sequence = useRef(0), scroll = useRef<HTMLDivElement | null>(null), imageInput = useRef<HTMLInputElement | null>(null), typingHide = useRef<ReturnType<typeof setTimeout> | null>(null), stopTyping = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadList = useCallback(async () => {
        const data = await api<{
            conversations: Conversation[];
        }>('/api/conversations');
        setConversations(data.conversations);
        setLoading(false);
    }, []);
    const open = useCallback(async (id: string) => {
        const request = ++sequence.current, changed = active.current !== id;
        active.current = id;
        setActiveId(id);
        setError('');
        setTyping(false);
        if (changed) {
            setMessages([]);
            setOther(null);
            setText('');
            setReplying(null);
            setThreadLoading(true);
        }
        try {
            const data = await api<Thread>(`/api/conversations/${id}`);
            if (active.current !== id || sequence.current !== request)
                return;
            setMessages(current => mergeMessages(current, data.messages));
            setOther(data.other);
            socket.current?.emit('join_conversation', { conversationId: id, token: data.socketToken });
            void loadList().catch(() => { });
            void useApp.getState().refreshMe();
        }
        catch (error) {
            if (active.current === id)
                setError((error as Error).message);
        }
        finally {
            if (active.current === id)
                setThreadLoading(false);
        }
    }, [loadList]);
    useEffect(() => {
        if (!user)
            return;
        let cancelled = false;
        const connection = io(getRealtimeUrl(), { path: '/' });
        socket.current = connection;
        connection.on('connect', () => {
            if (active.current)
                void open(active.current);
        });
        connection.on('message', (data: {
            conversationId: string;
            message: Message;
        }) => {
            if (active.current === data.conversationId) {
                setMessages(current => mergeMessages(current, [data.message]));
                void api(`/api/conversations/${data.conversationId}`).catch(() => { });
            }
            void loadList().catch(() => { });
        });
        connection.on('typing', (data: {
            userId: string;
            conversationId?: string;
        }) => {
            if (data.userId === user.id || data.conversationId && data.conversationId !== active.current)
                return;
            setTyping(true);
            if (typingHide.current)
                clearTimeout(typingHide.current);
            typingHide.current = setTimeout(() => setTyping(false), 2500);
        });
        connection.on('stop_typing', (data: {
            conversationId?: string;
        }) => {
            if (!data?.conversationId || data.conversationId === active.current)
                setTyping(false);
        });
        void (async () => {
            try {
                await loadList();
                if (cancelled)
                    return;
                if (recipientId) {
                    const data = await api<{
                        conversationId: string;
                    }>('/api/conversations', { method: 'POST', json: { userId: recipientId } });
                    if (!cancelled)
                        void open(data.conversationId);
                }
                else if (view.params?.conversationId)
                    void open(view.params.conversationId);
            }
            catch (error) {
                if (!cancelled) {
                    setLoading(false);
                    setError((error as Error).message);
                }
            }
        })();
        const refresh = setInterval(() => {
            if (!document.hidden) {
                void loadList().catch(() => { });
                if (active.current)
                    void open(active.current);
            }
        }, 8000);
        return () => {
            cancelled = true;
            clearInterval(refresh);
            connection.disconnect();
            if (socket.current === connection)
                socket.current = null;
            if (typingHide.current)
                clearTimeout(typingHide.current);
            if (stopTyping.current)
                clearTimeout(stopTyping.current);
        };
    }, [user?.id, recipientId, view.params?.conversationId, open, loadList]);
    useEffect(() => {
        const viewport = scroll.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
        if (viewport)
            viewport.scrollTop = viewport.scrollHeight;
    }, [messages.length, activeId, typing]);
    useEffect(() => { const measure = () => document.documentElement.style.setProperty('--messenger-window-height', `${window.visualViewport?.height || window.innerHeight}px`); measure(); window.visualViewport?.addEventListener('resize', measure); return () => { window.visualViewport?.removeEventListener('resize', measure); document.documentElement.style.removeProperty('--messenger-window-height'); }; }, []);
    const send = async (file?: File) => {
        const id = active.current, body = text.trim();
        if (!id || !body && !file || inFlight.current)
            return;
        inFlight.current = true;
        setSending(true);
        setError('');
        try {
            const asset = file ? await uploadMedia(file, 'conversation', id) : null;
            const result = await api<{
                message: Message;
            }>(`/api/conversations/${id}`, { method: 'POST', json: { body, attachmentUrl: asset?.url, replyToId: replying?.id } });
            if (active.current === id) {
                setMessages(current => mergeMessages(current, [result.message]));
                setText('');
                setReplying(null);
            }
            socket.current?.emit('message_relay', { conversationId: id, message: { id: result.message.id } });
            socket.current?.emit('stop_typing', { conversationId: id });
            void loadList().catch(() => { });
        }
        catch (error) {
            setError((error as Error).message);
        }
        finally {
            inFlight.current = false;
            setSending(false);
        }
    };
    const react = async (message: Message, emoji: string) => {
        if (!active.current)
            return;
        try {
            const result = await api<{
                message: Message;
            }>(`/api/conversations/${active.current}/reactions`, { method: 'POST', json: { messageId: message.id, emoji } });
            setMessages(current => mergeMessages(current, [result.message]));
            socket.current?.emit('reaction_relay', { conversationId: active.current, messageId: message.id });
            setReactionFor(null);
        }
        catch (error) {
            setError((error as Error).message);
        }
    };
    const onType = (value: string) => {
        setText(value);
        if (!active.current)
            return;
        socket.current?.emit('typing', { conversationId: active.current });
        if (stopTyping.current)
            clearTimeout(stopTyping.current);
        stopTyping.current = setTimeout(() => socket.current?.emit('stop_typing', { conversationId: active.current }), 1200);
    };
    const back = () => { active.current = null; ++sequence.current; setActiveId(null); setOther(null); setMessages([]); setText(''); setReplying(null); setError(''); };
    if (!user)
        return <div className="p-8">{uiText("Sign in to see your messages.")}<Button onClick={() => go('auth', { mode: 'login' })}>{uiText("Log in")}</Button></div>;
    return <div className={`messenger-screen ${embedded ? 'is-embedded' : ''} ${activeId ? 'has-active-chat' : ''}`}><div className="messenger-layout">{!embedded && <section className="messenger-people" aria-label={uiText("Conversations")}><header><span><MessageCircle size={22}/></span><div><h1>{uiText("Messages")}</h1><p>{uiText("Your learning conversations")}</p></div></header><div className="messenger-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={uiText("Search people")} aria-label={uiText("Search conversations")}/></div><ScrollArea className="messenger-people-scroll">{loading ? <p className="messenger-empty">{uiText("Loading conversations\u2026")}</p> : conversations.filter(item => item.other.name.toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.id} className={`messenger-person ${activeId === item.id ? 'is-active' : ''}`} onClick={() => void open(item.id)}><span className="presence-avatar"><TutorAvatar name={item.other.name} url={item.other.avatarUrl} className="size-12"/>{online(item.other) && <i aria-label={uiText("Active now")}/>}</span><span><strong>{item.other.name}</strong><small>{item.lastMessage?.senderId === user.id ? uiText("You: ") : ''}{item.lastMessage?.body || uiText("Say hello")}</small></span><span className="messenger-person-meta"><time>{item.lastMessage ? uiText(new Date(item.lastMessage.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) : ''}</time>{item.unread > 0 && <b>{uiText(item.unread)}</b>}</span></button>)}{!loading && !conversations.length && <p className="messenger-empty">{uiText("No conversations yet. Contact a teacher to get started.")}</p>}</ScrollArea>{error && !activeId && <p role="alert" className="p-4 text-destructive">{uiText(error)}</p>}</section>}
 <section className="messenger-thread" aria-label={other ? uiText("Chat with {{value1}}", { value1: other.name }) : uiText("Chat")}>{activeId ? <><header>{!embedded && <button className="messenger-back" onClick={back} aria-label={uiText("Back to conversations")}><ArrowLeft size={22}/></button>}{other && <span className="presence-avatar"><TutorAvatar name={other.name} url={other.avatarUrl} className="size-10"/>{online(other) && <i />}</span>}<div><strong>{other?.name || uiText("Opening conversation\u2026")}</strong><small>{typing ? uiText("Typing\u2026") : online(other) ? uiText("Active now") : other?.lastSeenAt ? uiText("Last active {{value1}}", { value1: new Date(other.lastSeenAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : uiText("Offline")}</small></div></header><div ref={scroll} className="messenger-scroll"><ScrollArea className="h-full"><div className="messenger-bubbles">{threadLoading && <p className="messenger-empty">{uiText("Loading messages\u2026")}</p>}{messages.map((message, index) => { const mine = message.senderId === user.id, day = new Date(message.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }), previous = index ? new Date(messages[index - 1].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '', counts = Array.from(new Set((message.reactions || []).map(item => item.emoji))); return <div key={message.id} id={'message-' + message.id}>{day !== previous && <p className="messenger-day">{uiText(day)}</p>}<div className={`messenger-message ${mine ? 'is-mine' : ''}`}><div>{message.replyToId && <button className="message-reply-quote" onClick={() => document.getElementById('message-' + message.replyToId)?.scrollIntoView({ block: 'nearest' })}><strong>{message.replySenderName}</strong><span>{message.replyBody}</span></button>}{message.attachmentUrl && uiText((message.attachmentType?.startsWith('audio/') ? <audio className="message-audio" controls preload="none" src={message.attachmentUrl}/> : <a href={message.attachmentUrl} target="_blank" rel="noreferrer"><img className="message-image" src={message.attachmentUrl} loading="lazy" alt={uiText("Shared image")}/></a>))}{message.body && <p>{message.body}</p>}<span><time>{uiText(new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</time>{mine && uiText((message.readAt ? <CheckCheck size={13}/> : <Check size={13}/>))}</span><div className="message-tools"><button aria-label={uiText("Reply to message")} onClick={() => setReplying(message)}><Reply size={14}/></button><button aria-label={uiText("React to message")} onClick={() => setReactionFor(reactionFor === message.id ? null : message.id)}><Smile size={14}/></button></div>{reactionFor === message.id && <div className="message-reaction-picker">{uiText(REACTIONS.map(emoji => <button key={emoji} aria-label={uiText("React {{value1}}", { value1: emoji })} onClick={() => void react(message, emoji)}>{uiText(emoji)}</button>))}</div>}{counts.length > 0 && <div className="message-reactions">{uiText(counts.map(emoji => <button key={emoji} aria-pressed={message.reactions?.some(item => item.userId === user.id && item.emoji === emoji)} onClick={() => void react(message, emoji)}>{uiText(emoji)} {message.reactions?.filter(item => item.emoji === emoji).length}</button>))}</div>}</div></div></div>; })}{typing && <p className="messenger-typing">{other?.name.split(' ')[0]}{uiText(" is typing\u2026")}</p>}</div></ScrollArea></div>{error && <p className="px-4 text-sm text-destructive" role="alert">{uiText(error)}</p>}{replying && <div className="composer-reply"><Reply size={16}/><span><strong>{uiText("Replying to ")}{replying.senderId === user.id ? uiText("yourself") : other?.name}</strong><small>{replying.body || uiText("Attachment")}</small></span><button aria-label={uiText("Cancel reply")} onClick={() => setReplying(null)}><X size={18}/></button></div>}{emojiOpen && <div className="composer-emojis">{uiText(EMOJIS.map(emoji => <button key={emoji} onClick={() => { setText(old => old + emoji); setEmojiOpen(false); }}>{uiText(emoji)}</button>))}</div>}<form className="messenger-compose rich-compose" onSubmit={event => { event.preventDefault(); void send(); }}><input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => {
                const file = event.target.files?.[0];
                if (file)
                    void send(file);
                event.target.value = '';
            }}/><button type="button" className="composer-icon" disabled={sending || !other} aria-label={uiText("Send an image")} onClick={() => imageInput.current?.click()}><ImagePlus size={20}/></button><button type="button" className="composer-icon" aria-label={uiText("Choose emoji")} onClick={() => setEmojiOpen(old => !old)}><Smile size={20}/></button><Input value={text} onChange={e => onType(e.target.value)} placeholder={uiText("Write a message\u2026")} aria-label={uiText("Message")} maxLength={4000} disabled={sending || !other} autoComplete="off"/>{text.trim() ? <Button type="submit" size="icon" disabled={sending || !other} aria-label={uiText("Send message")}>{sending ? <Loader2 className="animate-spin" size={19}/> : <Send size={19}/>}</Button> : <VoiceRecorder disabled={sending || !other} onRecorded={file => void send(file)}/>}</form></> : <div className="messenger-welcome"><span><MessageCircle size={36}/></span><h2>{uiText("A conversation starts here.")}</h2><p>{uiText("Choose a person to open your messages.")}</p></div>}</section></div></div>;
}
