import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { requireUser, verifyPayload } from '@/lib/auth'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { uploadRoot, classroomAccess, type ClassroomContext } from '@/lib/media-storage'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req), form = await req.formData()
    const file = form.get('file'), scope = String(form.get('scope') || ''), scopeId = String(form.get('scopeId') || '')
    if (!(file instanceof File) || !file.size || file.size > 15*1024*1024) return fail(400,'Choose a file smaller than 15 MB')
    if (!['certificate','conversation','classroom','thumbnail','branding'].includes(scope)) return fail(400,'Choose a valid upload destination')
    if(scope==='branding'&&user.role!=='ADMIN')return fail(403,'Only administrators can upload branding images')
    let context: ClassroomContext | null = null, expiresAt: Date | null = null
    if (scope === 'certificate' && user.role !== 'TUTOR') return fail(403,'Only teachers can upload qualification documents')
    if (scope === 'thumbnail' && user.role !== 'TUTOR') return fail(403,'Only teachers can upload class thumbnails')
    if (scope === 'conversation') {
      const convo = await db.conversation.findUnique({ where: { id:scopeId } })
      if (!convo || ![convo.participantAId,convo.participantBId].includes(user.id)) return fail(404,'Conversation not found')
    }
    if (scope === 'classroom') {
      context = verifyPayload<ClassroomContext>(String(form.get('token') || ''))
      if (!context || context.userId !== user.id || context.roomId !== scopeId || !await classroomAccess(context,user.id)) return fail(403,'This classroom is not available')
      expiresAt = new Date(Date.now()+4*3600000)
      if(context.groupClassId){const group=await db.groupClass.findUnique({where:{id:context.groupClassId}});if(group)expiresAt=new Date(+group.startUtc+(group.durationMin+45)*60000)}
      else if(context.callId){const row=await db.setting.findUnique({where:{key:'lesson-call:'+context.callId}});if(row){const call=JSON.parse(row.value);expiresAt=new Date(Date.parse(call.studentJoinedAt||call.createdAt)+(call.durationMin+45)*60000)}}
      else if(context.bookingId){const booking=await db.booking.findUnique({where:{id:context.bookingId}});if(booking)expiresAt=new Date(+booking.endUtc+45*60000)}
    }
    let bytes:Buffer = Buffer.from(await file.arrayBuffer()); let mime = file.type
    if (mime.startsWith('image/')) {
      if (!['image/jpeg','image/png','image/webp'].includes(mime)) return fail(400,'Choose a JPEG, PNG or WebP image')
      try {
        bytes = await sharp(bytes,{limitInputPixels:40000000}).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:76}).toBuffer()
        if (bytes.length > 600000) bytes = await sharp(bytes).resize(1100,1100,{fit:'inside'}).webp({quality:55}).toBuffer()
      } catch { return fail(400,'This image could not be read') }
      mime = 'image/webp'
    } else if (scope === 'certificate' && mime === 'application/pdf' && bytes.subarray(0,5).toString() === '%PDF-') {
      if (bytes.length > 10*1024*1024) return fail(400,'Certificates must be smaller than 10 MB')
    } else if (scope === 'conversation' && /^audio\/(webm|ogg|mp4|mpeg)/.test(mime)) {
      if(bytes.length<12)return fail(400,'This voice recording is incomplete')
      if (bytes.length > 5*1024*1024 || !(bytes.readUInt32BE(0) === 0x1a45dfa3 || bytes.subarray(0,4).toString() === 'OggS' || bytes.subarray(4,8).toString() === 'ftyp' || bytes.subarray(0,3).toString() === 'ID3' || bytes[0] === 0xff)) return fail(400,'Choose a supported voice recording smaller than 5 MB')
      mime = mime.split(';')[0]
    } else return fail(400,'This file type is not supported here')
    const storageKey = randomUUID()+'.bin'
    await fs.mkdir(uploadRoot,{recursive:true}); await fs.writeFile(path.join(uploadRoot,storageKey),bytes)
    const asset = await db.mediaAsset.create({ data: { ownerId:user.id,scope,scopeId:scope === 'certificate' || scope === 'thumbnail' ? user.id : scopeId,mime,name:file.name.slice(0,120),bytes:bytes.length,storageKey,expiresAt,context:JSON.stringify(context || {}) } }).catch(async(error) => { await fs.unlink(path.join(uploadRoot,storageKey)).catch(()=>{}); throw error })
    return ok({ asset: { id:asset.id,url:'/api/media/'+asset.id,mime:asset.mime,bytes:asset.bytes,name:asset.name } })
  })
}
