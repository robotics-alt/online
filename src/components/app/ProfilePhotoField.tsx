'use client';
import { uiText } from "@/lib/ui-text";
import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
export async function profilePhoto(file: File) { if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024)
    throw Error('Choose a JPEG, PNG or WebP image under 15 MB'); const image = await createImageBitmap(file), canvas = document.createElement('canvas'), size = 384; canvas.width = size; canvas.height = size; const side = Math.min(image.width, image.height); canvas.getContext('2d')!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size); image.close(); let result = canvas.toDataURL('image/webp', .78); if (result.length > 160000)
    result = canvas.toDataURL('image/webp', .55); if (result.length > 200000)
    throw Error('Choose a simpler or smaller image'); return result; }
export default function ProfilePhotoField({ value, onChange }: {
    value: string;
    onChange: (value: string) => void;
}) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); return <div className="registration-photo"><label><span className="registration-photo-image">{value ? <img src={value} alt={uiText("Your profile photo")}/> : busy ? <Loader2 className="animate-spin"/> : <Camera size={28}/>}</span><span><strong>{uiText("Profile photo")}</strong><small>{busy ? uiText("Compressing photo...") : value ? uiText("Photo ready. Tap to change.") : uiText("Required for students and teachers")}</small><span className="text-xs text-muted-foreground">{uiText("JPEG, PNG or WebP. Compressed automatically.")}</span></span><input aria-label={uiText("Upload profile photo")} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
    return; setBusy(true); setError(''); try {
    onChange(await profilePhoto(file));
}
catch (err) {
    setError((err as Error).message);
}
finally {
    setBusy(false);
    e.target.value = '';
} }}/></label>{error && <p role="alert" className="text-sm text-destructive">{uiText(error)}</p>}</div>; }
