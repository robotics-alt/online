'use client';
import { uiText } from "@/lib/ui-text";
import { useEffect, useState } from 'react';
import { api, useApp, LANGUAGES } from '@/lib/store';
import type { PlatformSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const currencies = ['USD', 'EUR', 'GBP', 'GHS', 'IQD', 'TRY'], fonts = ['system', 'Arial', 'Tahoma', 'Georgia', 'Trebuchet MS', 'Verdana'];
export default function LanguageTypographySettings({ onSaved }: {
    onSaved?: () => void | Promise<void>;
} = {}) {
    const [settings, setSettings] = useState<PlatformSettings | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
    useEffect(() => { void api<{
        settings: PlatformSettings;
    }>('/api/admin/settings').then(data => setSettings(data.settings)).catch(error => setError(error.message)); }, []);
    if (!settings)
        return <section className="admin-feature-panel">{error || uiText("Loading language and typography settings\u2026")}</section>;
    const toggle = (key: 'enabledLanguages' | 'enabledCurrencies', code: string) => setSettings(old => { if (!old)
        return old; const values = old[key].includes(code) ? old[key].filter(value => value !== code) : [...old[key], code], defaultKey = key === 'enabledLanguages' ? 'defaultLanguage' : 'defaultCurrency'; return { ...old, [key]: values, [defaultKey]: values.includes(old[defaultKey]) ? old[defaultKey] : values[0] || old[defaultKey] }; });
    const save = async () => { setBusy(true); setError(''); setSaved(false); try {
        const response = await api<{
            settings: PlatformSettings;
        }>('/api/admin/settings', { method: 'PUT', json: { defaultLanguage: settings.defaultLanguage, defaultCurrency: settings.defaultCurrency, enabledLanguages: settings.enabledLanguages, enabledCurrencies: settings.enabledCurrencies, typography: settings.typography } });
        setSettings(response.settings);
        window.dispatchEvent(new Event('platform-settings-updated'));
        await onSaved?.();
        setSaved(true);
    }
    catch (error) {
        setError((error as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <section className="admin-feature-panel"><header><div><h2>{uiText("Languages, currencies & dashboard typography")}</h2><p>{uiText("Choose what visitors can use, then adjust the teacher and admin dashboard font for each interface language.")}</p></div></header><div className="profile-review-columns"><section><h3>{uiText("Interface languages")}</h3>{uiText(LANGUAGES.map(language => <label className="application-check" key={language.code}><input type="checkbox" checked={settings.enabledLanguages.includes(language.code)} onChange={() => toggle('enabledLanguages', language.code)}/>{uiText(language.label)}</label>))}<label className="mt-3 block text-sm">{uiText("Default language")}<select className="feature-select" value={settings.defaultLanguage} onChange={e => setSettings({ ...settings, defaultLanguage: e.target.value })}>{uiText(LANGUAGES.filter(language => settings.enabledLanguages.includes(language.code)).map(language => <option key={language.code} value={language.code}>{uiText(language.label)}</option>))}</select></label></section><section><h3>{uiText("Currencies")}</h3><div className="grid grid-cols-2">{uiText(currencies.map(currency => <label className="application-check" key={currency}><input type="checkbox" checked={settings.enabledCurrencies.includes(currency)} onChange={() => toggle('enabledCurrencies', currency)}/>{currency}</label>))}</div><label className="mt-3 block text-sm">{uiText("Default currency")}<select className="feature-select" value={settings.defaultCurrency} onChange={e => setSettings({ ...settings, defaultCurrency: e.target.value })}>{uiText(settings.enabledCurrencies.map(currency => <option key={currency} value={currency}>{currency}</option>))}</select></label></section></div><div className="typography-settings">{uiText(LANGUAGES.map(language => { const rule = settings.typography?.[language.code] || { font: 'system', size: 16 }; return <article key={language.code}><strong>{uiText(language.label)}</strong><label>{uiText("Font")}<select className="feature-select" value={rule.font} onChange={e => setSettings({ ...settings, typography: { ...settings.typography, [language.code]: { ...rule, font: e.target.value } } })}>{uiText(fonts.map(font => <option key={font} value={font}>{font === 'system' ? uiText("System / language fallback") : uiText(font)}</option>))}</select></label><label>{uiText("Base size")}<Input type="number" min={14} max={24} value={rule.size} onChange={e => setSettings({ ...settings, typography: { ...settings.typography, [language.code]: { ...rule, size: Number(e.target.value) } } })}/></label><p lang={language.code} style={{ fontFamily: rule.font === 'system' ? 'system-ui' : rule.font, fontSize: rule.size }}>{language.code === 'ar' ? 'دروسك القادمة وتقويم التدريس' : language.code === 'ku' ? 'وانەکان و ڕۆژژمێری مامۆستا' : language.code === 'fr' ? uiText("Vos cours et votre calendrier") : language.code === 'tr' ? uiText("Dersleriniz ve \u00F6\u011Fretim takviminiz") : uiText("Upcoming lessons and teaching calendar")}</p></article>; }))}</div>{error && <p role="alert" className="text-destructive">{uiText(error)}</p>}{saved && <p role="status" className="text-primary">{uiText("Language and typography settings saved.")}</p>}<Button disabled={busy} onClick={() => void save()}>{busy ? uiText("Saving\u2026") : uiText("Save language & typography settings")}</Button><Button className='ms-2 mt-2' variant='outline' disabled={busy} onClick={async () => { try {
        await api('/api/me', { method: 'PUT', json: { usePlatformDefaults: true } });
        await useApp.getState().refreshMe();
        window.dispatchEvent(new Event('platform-settings-updated'));
    }
    catch (e) {
        setError((e as Error).message);
    } }}>{uiText("Use platform defaults for my account")}</Button></section>;
}
