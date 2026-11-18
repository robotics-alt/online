'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { Plus, Upload, X, CheckCircle, Loader2 } from 'lucide-react';
import { type ExperienceItem, type SkillItem } from '@/lib/profile-data';
import { uploadMedia } from '@/lib/media-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function CertificateUpload({ value, onChange }: {
    value?: string;
    onChange: (id: string) => void;
}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    return <div><label className="certificate-upload"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            setBusy(true);
            setError('');
            try {
                const asset = await uploadMedia(file, 'certificate');
                onChange(asset.id);
            }
            catch (error) {
                setError((error as Error).message);
            }
            finally {
                setBusy(false);
                e.target.value = '';
            }
        }}/>{busy ? <Loader2 className="animate-spin" size={16}/> : value ? <CheckCircle size={16}/> : <Upload size={16}/>}<span>{busy ? uiText("Uploading\u2026") : value ? uiText("Document attached \u00B7 replace") : uiText("Attach certificate or supporting document")}</span></label>{value && <a className="text-xs text-primary underline" href={'/api/media/' + value} target="_blank" rel="noreferrer">{uiText("View attached document")}</a>}{error && <p className="text-sm text-destructive" role="alert">{uiText(error)}</p>}</div>;
}
export function ExperienceEditor({ value, onChange }: {
    value: ExperienceItem[];
    onChange: (items: ExperienceItem[]) => void;
}) {
    const edit = (index: number, patch: Partial<ExperienceItem>) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
    return <div className="professional-list">{uiText(value.map((item, index) => <section key={index} className="professional-entry"><div className="professional-entry-heading"><h3>{uiText("Experience ")}{uiText(index + 1)}</h3><Button type="button" variant="ghost" size="icon" aria-label={uiText("Remove experience {{value1}}", { value1: index + 1 })} onClick={() => onChange(value.filter((_, i) => i !== index))}><X size={17}/></Button></div><label>{uiText("Role / experience")}<Input value={item.title} maxLength={120} onChange={e => edit(index, { title: e.target.value })} placeholder={uiText("Mathematics teacher")}/></label><div className="professional-two-columns"><label>{uiText("Organisation / school")}<Input value={item.organization} maxLength={160} onChange={e => edit(index, { organization: e.target.value })} placeholder={uiText("School or institution")}/></label><label>{uiText("Years of experience")}<Input type="number" min={0} max={60} step={.5} value={item.years} onChange={e => edit(index, { years: Number(e.target.value) })}/></label></div><label>{uiText("Programme / qualification")}<Input value={item.program} maxLength={120} onChange={e => edit(index, { program: e.target.value })} placeholder={uiText("For example IGCSE, IB, national curriculum")}/></label><CertificateUpload value={item.certificateId} onChange={id => edit(index, { certificateId: id })}/>{(item.organization || item.program) && <p className="text-xs text-muted-foreground">{uiText("Attach proof for school, organisation and programme claims. Administrators review it before publication.")}</p>}</section>))}<Button type="button" variant="outline" disabled={value.length >= 20} onClick={() => onChange([...value, { title: '', organization: '', program: '', years: 0 }])}><Plus size={16}/>{uiText("Add experience")}</Button></div>;
}
export function SkillEditor({ value, onChange }: {
    value: SkillItem[];
    onChange: (items: SkillItem[]) => void;
}) {
    return <div className="professional-list">{value.map((item, index) => <div className="professional-entry" key={index}><div className="professional-entry-heading"><Input value={item.name} maxLength={100} onChange={e => onChange(value.map((old, i) => i === index ? { ...old, name: e.target.value } : old))} placeholder={uiText("Skill, subject speciality or programme")}/><Button type="button" variant="ghost" size="icon" aria-label={uiText("Remove skill")} onClick={() => onChange(value.filter((_, i) => i !== index))}><X size={16}/></Button></div><CertificateUpload value={item.certificateId} onChange={id => onChange(value.map((old, i) => i === index ? { ...old, certificateId: id } : old))}/></div>)}<Button type="button" variant="outline" disabled={value.length >= 30} onClick={() => onChange([...value, { name: '' }])}><Plus size={16}/>{uiText("Add skill / speciality")}</Button></div>;
}
