'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, Upload, FileJson, Loader2 } from 'lucide-react'
import { DICT } from '@/lib/i18n'
import { api, LANGUAGES, useApp } from '@/lib/store'
import { uiText } from '@/lib/ui-text'
import { Button } from '@/components/ui/button'

export default function JsonTranslationSettings() {
  const [language, setLanguage] = useState('ar')
  const [dictionaries, setDictionaries] = useState<Record<string, Record<string, string>>>({})
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => { api<{ settings: { translations: typeof dictionaries } }>('/api/admin/settings')
    .then(data => { setDictionaries(data.settings.translations || {}); setLoaded(true) })
    .catch(error => setMessage(error.message)) }, [])
  const keys = [...new Set([...Object.keys(DICT.en), ...Object.keys(dictionaries[language] || {})])].sort()
  function download() {
    const dictionary = Object.fromEntries(keys.map(key => [key, dictionaries[language]?.[key] || DICT[language]?.[key] || DICT.en[key] || '']))
    const url = URL.createObjectURL(new Blob([JSON.stringify(dictionary, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `translations-${language}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importFile(file: File) {
    setMessage('')
    try {
      if (file.size > 3 * 1024 * 1024) throw Error('Choose a translation JSON file smaller than 3 MB')
      const parsed: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Use a JSON object containing keyword and translated text pairs')
      const entries = Object.entries(parsed)
      if (!entries.length || entries.length > 10000) throw Error('Import between 1 and 10,000 translation keywords')
      for (const [key, text] of entries) {
        if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,100}$/.test(key) || typeof text !== 'string' || text.length > 2000)
          throw Error('Every keyword must have a text value of up to 2,000 characters')
        const known = new Set((DICT.en[key] || '').match(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}/g) || [])
        if (DICT.en[key] && (text.match(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}/g) || []).some(token => !known.has(token)))
          throw Error(`Unknown placeholder in keyword ${key}. Keep the original placeholder names.`)
      }
      setDictionaries(previous => ({ ...previous, [language]: { ...previous[language], ...(parsed as Record<string, string>) } }))
      setDirty(true)
      setMessage(`Imported ${entries.length} keywords. Save translations to publish.`)
    } catch (error) { setMessage((error as Error).message) }
  }
  async function save() {
    setBusy(true); setMessage('')
    try {
      await api('/api/admin/settings', { method: 'PUT', json: { translations: dictionaries } })
      useApp.getState().setPublicData(await api('/api/public'))
      window.dispatchEvent(new Event('platform-settings-updated'))
      setDirty(false); setMessage('Translation JSON saved successfully.')
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="admin-feature-panel" data-translation-settings>
    <div className="flex items-start gap-3"><FileJson className="mt-1 shrink-0 text-primary" /><div>
      <h2 className="text-xl font-bold">{uiText('Translation JSON files')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{uiText('Download the complete file, edit its text values, then upload it here. Keep keyword names and placeholders unchanged.')}</p>
    </div></div>
    <div className="my-5 flex flex-wrap items-center gap-3">
      <label className="grid gap-2 text-sm">{uiText('Language')}<select aria-label="Translation language" className="feature-select min-w-48" value={language} onChange={event => setLanguage(event.target.value)}>
        {LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select></label>
      <span className="text-sm text-muted-foreground" data-translation-key-count={keys.length}>{uiText('{{value1}} keywords', { value1: keys.length })}</span>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={download} disabled={!loaded || busy}><Download size={16} />{uiText('Download JSON')}</Button>
      <Button variant="outline" disabled={!loaded || busy} onClick={() => fileInput.current?.click()}><Upload size={16} />{uiText('Upload JSON')}</Button>
      <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Upload translation JSON" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} />
      <Button disabled={!loaded || !dirty || busy} onClick={() => void save()}>{busy && <Loader2 size={16} className="animate-spin" />}{uiText('Save translations')}</Button>
    </div>
    {message && <p className="mt-4 rounded-xl border p-3 text-sm" role="status">{uiText(message)}</p>}
  </section>
}
