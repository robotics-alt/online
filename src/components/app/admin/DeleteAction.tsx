'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export default function DeleteAction({ label, onDelete }: {
    label: string;
    onDelete: () => Promise<void>;
}) { const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''); return <><Button type="button" variant="outline" size="sm" className="text-destructive" aria-label={uiText("Delete {{value1}}", { value1: label })} onClick={() => setOpen(true)}><Trash2 size={15}/>{uiText("Delete")}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>{uiText("Delete ")}{uiText(label)}?</DialogTitle><DialogDescription>{uiText("This removes it from the catalogue. Existing lesson and financial history is preserved.")}</DialogDescription>{error && <p role="alert">{uiText(error)}</p>}<div className="flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>{uiText("Keep it")}</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try {
    await onDelete();
    setOpen(false);
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}>{uiText("Delete ")}{uiText(label)}</Button></div></DialogContent></Dialog></>; }
