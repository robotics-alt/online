'use client';
import { uiText } from "@/lib/ui-text";
import { useApp } from '@/lib/store';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Palette, Monitor } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACCENTS, applyAccent, type Accent } from '@/hooks/use-appearance-preferences';
/**
 * Light/dark mode toggle. Uses CSS visibility for the icon (no hydration
 * state needed) and reads the resolved theme at click time.
 */
export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const allowColours = useApp(s => s.publicData?.settings.branding?.allowPersonalAccents) ?? false;
    const [accent, setAccent] = useState<Accent>('violet');
    useEffect(() => { try {
        const saved = localStorage.getItem('tutorsphere-accent');
        if (saved && saved in ACCENTS)
            setAccent(saved as Accent);
    }
    catch { } }, []);
    return (<Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={uiText("Appearance")}><Palette className="size-5"/></Button></PopoverTrigger><PopoverContent align="end" className="w-72 rounded-2xl p-5"><h2 className="font-semibold">{uiText("Appearance")}</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">{uiText("Personalise this device.")}</p><div className="grid grid-cols-3 gap-2" role="group" aria-label={uiText("Theme")}>{uiText([{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }, { value: 'system', label: 'System', Icon: Monitor }].map(({ value, label, Icon }) => <button key={value} aria-pressed={theme === value} onClick={() => setTheme(value)} className="flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border text-xs aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"><Icon size={19}/>{uiText(label)}</button>))}</div>{allowColours && <><p className="mb-3 mt-5 text-xs font-medium">{uiText("Accent colour")}</p><div className="flex justify-between" role="group" aria-label={uiText("Accent colour")}>{uiText(Object.entries(ACCENTS).map(([name, colour]) => <button key={name} aria-label={uiText("{{value1}} accent", { value1: name })} aria-pressed={accent === name} className="size-9 rounded-full border-4 border-background outline-offset-2 aria-pressed:outline aria-pressed:outline-2" style={{ background: colour, outlineColor: colour }} onClick={() => { setAccent(name as Accent); applyAccent(name); try {
        localStorage.setItem('tutorsphere-accent', name);
    }
    catch { } ; window.dispatchEvent(new Event('appearance-change')); }}/>))}</div></>}{!allowColours && <p className="mt-4 text-xs text-muted-foreground">{uiText("Platform colours are managed by the administrator.")}</p>}</PopoverContent></Popover>);
}
