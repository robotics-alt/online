'use client';
import { uiText } from "@/lib/ui-text";
import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { LANGUAGE_NAMES, LANGUAGE_LEVELS, type LanguageItem } from '@/lib/profile-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function LanguageListEditor({ value, onChange }: {
    value: LanguageItem[];
    onChange: (items: LanguageItem[]) => void;
}) {
    const id = useId();
    return <div className="language-list-editor"><datalist id={id}>{uiText(LANGUAGE_NAMES.map((name) => <option key={name} value={name}/>))}</datalist>{value.map((item, index) => <div key={index} className="language-list-row"><label>{uiText("Language")}<Input list={id} value={item.name} placeholder={uiText("Start typing a language")} maxLength={60} onChange={(e) => onChange(value.map((old, i) => i === index ? { ...old, name: e.target.value } : old))}/></label><label>{uiText("Level")}<select value={item.level} onChange={(e) => onChange(value.map((old, i) => i === index ? { ...old, level: e.target.value } : old))}>{uiText(LANGUAGE_LEVELS.map((level) => <option key={level} value={level}>{uiText(level)}</option>))}</select></label><Button type="button" variant="ghost" size="icon" aria-label={uiText("Remove {{value1}}", { value1: item.name || 'language' })} onClick={() => onChange(value.filter((_, i) => i !== index))}><X size={17}/></Button></div>)}<Button type="button" variant="outline" size="sm" disabled={value.length >= 15} onClick={() => onChange([...value, { name: '', level: LANGUAGE_LEVELS[0] }])}><Plus size={16}/>{uiText("Add language")}</Button></div>;
}
