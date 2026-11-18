'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp, LANGUAGES } from '@/lib/store';
import JsonTranslationSettings from './JsonTranslationSettings';
import { DICT } from '@/lib/i18n';
import { uploadMedia } from '@/lib/media-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function IdentitySettings() { const [form, setForm] = useState({ platformName: '', tagline: '', contactEmail: '', supportPhone: '', logoUrl: '', iconUrl: '' }), [translations, setTranslations] = useState<Record<string, Record<string, string>>>({}), [lang, setLang] = useState('ar'), [query, setQuery] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''); useEffect(() => { api<{
    settings: typeof form & {
        translations: typeof translations;
    };
}>('/api/admin/settings').then(({ settings: s }) => { setForm({ platformName: s.platformName, tagline: s.tagline, contactEmail: s.contactEmail, supportPhone: s.supportPhone || '', logoUrl: s.logoUrl || '', iconUrl: s.iconUrl || '' }); setTranslations(s.translations || {}); }).catch(e => setMessage(e.message)); }, []); const act = async (fn: () => Promise<void>) => { setBusy(true); setMessage(''); try {
    await fn();
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} }; const refresh = async () => { useApp.getState().setPublicData(await api('/api/public')); window.dispatchEvent(new Event('platform-settings-updated')); setMessage('Saved successfully.'); }; const keys = [...new Set([...Object.keys(DICT.en), ...Object.keys(translations[lang] || {})])]; const download = () => { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify(Object.fromEntries(keys.map(k => [k, translations[lang]?.[k] || DICT[lang]?.[k] || DICT.en[k] || ''])), null, 2)], { type: 'application/json' })); a.href = url; a.download = 'translations-' + lang + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }; return <><section className="admin-feature-panel" data-identity-settings><h2 className="text-xl font-bold">{uiText("Platform branding")}</h2><div className="my-5 grid gap-4 sm:grid-cols-2">{uiText((['platformName', 'tagline', 'contactEmail', 'supportPhone'] as const).map(key => <label className="grid gap-2 text-sm" key={key}>{uiText(({ platformName: 'Platform name', tagline: 'Tagline', contactEmail: 'Support email', supportPhone: 'Support phone' })[key])}<Input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>))}{uiText((['logoUrl', 'iconUrl'] as const).map(key => <label className="grid gap-3 rounded-xl border p-4 text-sm" key={key}>{key === 'logoUrl' ? uiText("Logo") : uiText("Browser icon")}{form[key] && <img src={form[key]} alt={uiText("Preview")} className="size-20 object-contain"/>}<input aria-label={key === 'logoUrl' ? uiText("Upload platform logo") : uiText("Upload browser icon")} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file)
    void act(async () => { const asset = await uploadMedia(file, 'branding'); setForm(old => ({ ...old, [key]: asset.url })); }); }}/>{form[key] && <Button variant="ghost" onClick={() => setForm({ ...form, [key]: '' })}>{uiText("Remove image")}</Button>}</label>))}</div><Button disabled={busy} onClick={() => void act(async () => { await api('/api/admin/settings', { method: 'PUT', json: form }); await refresh(); })}>{uiText("Save branding")}</Button></section><JsonTranslationSettings/>{message && <p role="status" className="rounded-xl border p-4">{message}</p>}</>; }
