'use client'
export interface UploadedAsset { id:string;url:string;mime:string;bytes:number;name:string }
export async function compressImage(file: File): Promise<File> {
  if(!file.type.startsWith('image/')) return file
  const bitmap=await createImageBitmap(file).catch(()=>null)
  if(!bitmap) return file
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas')
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.76))
  return blob?new File([blob],'image.webp',{type:blob.type}):file
}
export async function uploadMedia(file: File,scope: string,scopeId='',token=''):Promise<UploadedAsset>{
  const form=new FormData();form.set('file',await compressImage(file));form.set('scope',scope);form.set('scopeId',scopeId);if(token)form.set('token',token)
  const res=await fetch('/api/media',{method:'POST',body:form});const data=await res.json()
  if(!res.ok)throw new Error(data.error || 'Upload failed')
  return data.asset
}
