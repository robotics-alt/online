'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function VoiceRecorder({ onRecorded, disabled = false }: {
    onRecorded: (file: File) => void;
    disabled?: boolean;
}) {
    const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [error, setError] = useState(''), recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), cancelled = useRef(false), timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const stop = (cancel = false) => { cancelled.current = cancel; if (recorder.current?.state === 'recording')
        recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (timer.current)
        clearInterval(timer.current); setRecording(false); };
    useEffect(() => () => { cancelled.current = true; if (recorder.current?.state === 'recording')
        recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (timer.current)
        clearInterval(timer.current); }, []);
    const start = async () => { setError(''); try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
            throw new Error('Voice recording needs a supported browser and a secure connection');
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
        const device = new MediaRecorder(stream.current, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 }), chunks: BlobPart[] = [];
        recorder.current = device;
        cancelled.current = false;
        device.ondataavailable = event => { if (event.data.size)
            chunks.push(event.data); };
        device.onstop = () => { stream.current?.getTracks().forEach(track => track.stop()); if (!cancelled.current && chunks.length) {
            const type = device.mimeType || 'audio/webm';
            onRecorded(new File(chunks, 'voice-message.' + (type.includes('mp4') ? 'm4a' : 'webm'), { type }));
        } };
        device.start(250);
        setSeconds(0);
        setRecording(true);
        let elapsed = 0;
        timer.current = setInterval(() => { setSeconds(++elapsed); if (elapsed >= 90)
            stop(); }, 1000);
    }
    catch (error) {
        setError((error as Error).message);
        stream.current?.getTracks().forEach(track => track.stop());
    } };
    return <div className="voice-recorder">{recording ? <div className="voice-recording"><span className="recording-dot"/><time>{uiText(Math.floor(seconds / 60))}:{uiText(String(seconds % 60).padStart(2, '0'))}</time><Button type="button" size="icon" variant="ghost" aria-label={uiText("Cancel recording")} onClick={() => stop(true)}><X size={17}/></Button><Button type="button" size="icon" aria-label={uiText("Send voice message")} onClick={() => stop()}><Square size={16}/></Button></div> : <Button type="button" size="icon" variant="ghost" disabled={disabled} aria-label={uiText("Record voice message")} onClick={() => void start()}><Mic size={20}/></Button>}{error && <p className="voice-error" role="alert">{uiText(error)}</p>}</div>;
}
