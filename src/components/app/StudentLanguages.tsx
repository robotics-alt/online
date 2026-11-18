'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { api, useApp } from '@/lib/store';
import { readList, type LanguageItem } from '@/lib/profile-data';
import LanguageListEditor from './LanguageListEditor';
import { Button } from '@/components/ui/button';
export default function StudentLanguages() { const user = useApp(state => state.user), [items, setItems] = useState<LanguageItem[]>(readList(user?.spokenLanguages)), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''); return <section className="professional-entry"><h3 className="text-base font-semibold">{uiText("Languages you speak")}</h3><LanguageListEditor value={items} onChange={setItems}/>{notice && <p className="text-sm" role="status">{uiText(notice)}</p>}<Button disabled={busy} onClick={async () => { setBusy(true); setNotice(''); try {
    await api('/api/me', { method: 'PUT', json: { spokenLanguages: items } });
    await useApp.getState().refreshMe();
    setNotice('Languages saved');
}
catch (error) {
    setNotice((error as Error).message);
}
finally {
    setBusy(false);
} }}>{busy ? uiText("Saving\u2026") : uiText("Save languages")}</Button></section>; }
