'use client';
import { uiText } from "@/lib/ui-text";
import { useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ChevronLeft, ChevronRight, Download, FileUp, Loader2, Plus } from 'lucide-react';
import { type BoardDocument } from '@/lib/board-document';
import { exportBoard, type DrawBoardStroke } from '@/lib/board-export';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export default function BoardPagesToolbar({ document, role, socket, draw, fit, onFitChange }: {
    fit: 'width' | 'height' | 'normal';
    onFitChange: (fit: 'width' | 'height' | 'normal') => void;
    document: BoardDocument;
    role: string;
    socket: Socket | null;
    draw: DrawBoardStroke;
}) {
    const [pendingPdf, setPendingPdf] = useState<File | null>(null), [importFit, setImportFit] = useState<'width' | 'height' | 'normal'>('width'), [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), input = useRef<HTMLInputElement | null>(null);
    const active = Math.max(0, document.pages.findIndex(page => page.id === document.activePageId));
    const switchTo = async (pageId: string) => {
        if (!socket?.connected)
            throw new Error('Reconnect to the classroom first');
        const result = await socket.timeout(8000).emitWithAck('wb_page_switch', { pageId });
        if (!result.ok)
            throw new Error(result.error);
    };
    const add = async (page: Record<string, unknown> = {}) => {
        if (!socket?.connected)
            throw new Error('Reconnect to the classroom first');
        const result = await socket.timeout(10000).emitWithAck('wb_page_add', page);
        if (!result.ok)
            throw new Error(result.error);
        return result.pageId as string;
    };
    const act = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await fn();
        }
        catch (error) {
            setError((error as Error).message);
        }
        finally {
            setBusy(false);
            setProgress('');
        }
    };
    const importPdf = async (file: File) => act(async () => {
        if (file.size > 30 * 1024 * 1024)
            throw new Error('Choose a PDF book smaller than 30 MB');
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        pdfjs.GlobalWorkerOptions.rendererSrc = '/pdfjs/pdf.renderer.min.mjs';
        const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl: '/pdfjs/standard_fonts/', cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, wasmUrl: '/pdfjs/wasm/' }), pdf = await task.promise;
        try {
            if (pdf.numPages + document.pages.length > 100)
                throw new Error('Import a book with fewer pages. A board supports 100 pages.');
            let first = '';
            for (let number = 1; number <= pdf.numPages; number++) {
                setProgress(`Importing PDF page ${number} of ${pdf.numPages}…`);
                const page = await pdf.getPage(number), original = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: Math.min(1.5, 1400 / Math.max(original.width, original.height)) }), canvas = window.document.createElement('canvas');
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport, background: '#ffffff' }).promise;
                let background = canvas.toDataURL('image/jpeg', .76);
                if (background.length > 850000)
                    background = canvas.toDataURL('image/jpeg', .48);
                const id = await add({ name: `${file.name.slice(0, 65)} · ${number}`, width: canvas.width, height: canvas.height, background });
                if (!first)
                    first = id;
                canvas.width = 1;
                canvas.height = 1;
                page.cleanup();
            }
            if (first)
                await switchTo(first);
        }
        finally {
            await task.destroy();
        }
    });
    return <div className="board-pages-toolbar"><div><select aria-label={uiText("Board page fit")} value={fit} onChange={e => onFitChange(e.target.value as typeof fit)}><option value="width">{uiText("Full width")}</option><option value="height">{uiText("Full height")}</option><option value="normal">{uiText("Normal fit")}</option></select><Button variant="ghost" size="icon" disabled={busy || !socket?.connected || role !== 'tutor' || active === 0} aria-label={uiText("Previous board page")} onClick={() => void act(() => switchTo(document.pages[active - 1].id))}><ChevronLeft size={17}/></Button><select aria-label={uiText("Active board page")} disabled={busy || !socket?.connected || role !== 'tutor'} value={document.activePageId} onChange={event => void act(() => switchTo(event.target.value))}>{document.pages.map((page, index) => <option key={page.id} value={page.id}>{uiText(index + 1)}. {page.name}</option>)}</select><Button variant="ghost" size="icon" disabled={busy || !socket?.connected || role !== 'tutor' || active === document.pages.length - 1} aria-label={uiText("Next board page")} onClick={() => void act(() => switchTo(document.pages[active + 1].id))}><ChevronRight size={17}/></Button><span>{uiText(active + 1)} / {uiText(document.pages.length)}</span></div><div>{role === 'tutor' && <><Button variant="outline" size="sm" disabled={busy || !socket?.connected} onClick={() => void act(async () => { await switchTo(await add()); })}><Plus size={15}/>{uiText("Page")}</Button><input className="sr-only" ref={input} type="file" accept="application/pdf" onChange={event => {
                const file = event.target.files?.[0];
                if (file)
                    setPendingPdf(file);
                event.target.value = '';
            }}/><Button variant="outline" size="sm" disabled={busy || !socket?.connected} onClick={() => input.current?.click()}><FileUp size={15}/>{uiText("PDF book")}</Button></>}<Button variant="outline" size="sm" disabled={busy || !socket?.connected} onClick={() => void act(() => exportBoard(document, draw))}>{busy ? <Loader2 className="animate-spin" size={15}/> : <Download size={15}/>}{uiText("Download board")}</Button></div>{(progress || error) && <p className={error ? 'text-destructive' : ''} role={error ? 'alert' : 'status'}>{error || uiText(progress)}</p>}<Dialog open={Boolean(pendingPdf)} onOpenChange={open => {
            if (!open)
                setPendingPdf(null);
        }}><DialogContent><DialogTitle>{uiText("Import PDF book")}</DialogTitle><DialogDescription>{pendingPdf?.name}{uiText(". Each PDF page becomes a board page. You can change the viewing size later.")}</DialogDescription><label className="grid gap-2 text-sm">{uiText("PDF display size")}<select className="feature-select" aria-label={uiText("PDF display size")} value={importFit} onChange={e => setImportFit(e.target.value as typeof importFit)}><option value="width">{uiText("Full width")}</option><option value="height">{uiText("Full height")}</option><option value="normal">{uiText("Normal fit")}</option></select></label><Button onClick={() => {
            const file = pendingPdf;
            setPendingPdf(null);
            onFitChange(importFit);
            if (file)
                void importPdf(file);
        }}>{uiText("Import book")}</Button></DialogContent></Dialog></div>;
}
