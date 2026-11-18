import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { requireUser } from '@/lib/auth'
import { handle, fail } from '@/lib/api'
import { classroomAccess, uploadRoot, removeAssets } from '@/lib/media-storage'
export const runtime = 'nodejs'
export async function GET(req: NextRequest,{params}:{params:Promise<{id:string}>}) {
  return handle(async()=>{
    const asset = await db.mediaAsset.findUnique({where:{id:(await params).id}})
    if(!asset) return fail(404,'File not found')
    const publicThumbnail = asset.scope === 'thumbnail' && Boolean(await db.groupClass.findFirst({where:{thumbnailId:asset.id,status:'PUBLISHED'}}))
    const settings=asset.scope==='branding'?await getSettings():null
    const publicBranding=Boolean(settings&&([settings.logoUrl,settings.iconUrl].includes('/api/media/'+asset.id)||settings.marketing.slides.some(slide=>slide.imageId===asset.id)))
    if(!publicThumbnail&&!publicBranding){
      const user = await requireUser(req)
      let allowed = user.id === asset.ownerId || user.role === 'ADMIN'
      if(asset.scope === 'conversation') { const convo=await db.conversation.findUnique({where:{id:asset.scopeId}});allowed=Boolean(convo && [convo.participantAId,convo.participantBId].includes(user.id)) }
      if(asset.scope === 'classroom') {
        allowed=(!asset.expiresAt || +asset.expiresAt>Date.now()) && await classroomAccess(JSON.parse(asset.context),user.id)
        if(!allowed){ if(asset.expiresAt && +asset.expiresAt<Date.now()) await removeAssets({scope:'classroom',scopeId:asset.scopeId}); return fail(410,'This lesson image is no longer available') }
      }
      if(!allowed) return fail(403,'This file is private')
    }
    const file=path.resolve(uploadRoot,asset.storageKey)
    if(!file.startsWith(uploadRoot+path.sep)) return fail(404,'File not found')
    const bytes=await fs.readFile(file).catch(()=>null)
    if(!bytes) return fail(404,'File not found')
    return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':asset.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`inline; filename="${asset.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`}})
  })
}
