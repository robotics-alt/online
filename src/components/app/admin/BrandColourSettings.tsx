'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp } from '@/lib/store';
import { DEFAULT_BRAND, contrastColour, type BrandColours } from '@/lib/brand-colours';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function BrandColourSettings() { const [form, setForm] = useState<BrandColours>(DEFAULT_BRAND), [busy, setBusy] = useState(false), [message, setMessage] = useState(''); useEffect(() => { api<{
    settings: {
        branding: BrandColours;
    };
}>('/api/admin/settings').then(d => setForm(d.settings.branding || DEFAULT_BRAND)).catch(e => setMessage(e.message)); }, []); return <section className="admin-feature-panel" data-brand-settings><h2 className="text-xl font-bold">{uiText("Platform colours")}</h2><p className="mt-2 text-sm text-muted-foreground">{uiText("Choose the system\u2019s main and supporting colours. Text contrast is calculated automatically.")}</p><div className="my-6 grid gap-5 sm:grid-cols-2">{uiText((['primary', 'secondary'] as const).map(key => <label key={key} className="grid gap-3 text-sm font-medium capitalize">{uiText(key)}{uiText(" colour")}<div className="flex gap-3"><input aria-label={uiText("{{value1}} colour picker", { value1: key })} type="color" className="h-11 w-14 rounded-lg border bg-transparent p-1" value={/^#[0-9a-f]{6}$/i.test(form[key]) ? form[key] : '#000000'} onChange={e => setForm({ ...form, [key]: e.target.value })}/><Input aria-label={uiText("{{value1}} colour hex", { value1: key })} maxLength={7} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></div></label>))}</div><div className="mb-5 rounded-xl border p-5"><p className="mb-3 text-sm text-muted-foreground">{uiText("Preview")}</p><button className="rounded-xl px-5 py-3 font-semibold" style={{ background: form.primary, color: contrastColour(form.primary) }}>{uiText("Primary button")}</button><span className="ms-4 rounded-lg px-3 py-2 text-sm" style={{ background: form.secondary, color: contrastColour(form.secondary) }}>{uiText("Supporting colour")}</span></div><label className="mb-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowPersonalAccents} onChange={e => setForm({ ...form, allowPersonalAccents: e.target.checked })}/>{uiText("Allow users to override the main colour on their own device")}</label><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try {
    await api('/api/admin/settings', { method: 'PUT', json: { branding: form } });
    useApp.getState().setPublicData(await api('/api/public'));
    window.dispatchEvent(new Event('platform-settings-updated'));
    setMessage('Platform colours saved.');
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} }}>{uiText("Save platform colours")}</Button><Button variant="outline" onClick={() => setForm(DEFAULT_BRAND)}>{uiText("Reset preview")}</Button></div>{message && <p role="status" className="mt-4 text-sm">{message}</p>}</section>; }
