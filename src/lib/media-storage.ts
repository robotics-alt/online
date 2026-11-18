import { promises as fs } from 'node:fs'
import path from 'node:path'
import { db } from './db'
export const uploadRoot = path.resolve(process.env.LOCAL_UPLOAD_ROOT || path.join(process.cwd(), '.local-uploads'))
export async function removeAssets(where: { scope?: string; scopeId?: string; expiresAt?: { lt: Date } }) {
  const assets = await db.mediaAsset.findMany({ where })
  for (const asset of assets) {
    const file = path.resolve(uploadRoot, asset.storageKey)
    if (file.startsWith(uploadRoot + path.sep)) await fs.unlink(file).catch(() => {})
    await db.mediaAsset.deleteMany({ where: { id:asset.id } })
  }
}
export interface ClassroomContext { roomId: string; bookingId?: string; groupClassId?: string; callId?: string; userId?: string }
export async function classroomAccess(context: ClassroomContext, userId: string): Promise<boolean> {
  if(await db.setting.findUnique({where:{key:'classroom-ended:'+context.roomId}}))return false
  if (context.groupClassId) {
    const group = await db.groupClass.findUnique({ where: { id:context.groupClassId } })
    if (!group || group.status !== 'PUBLISHED' || group.roomId !== context.roomId || Date.now() > +group.startUtc + (group.durationMin + 45)*60000) return false
    return group.tutorId === userId || Boolean(await db.groupEnrollment.findFirst({ where: { groupId:group.id,studentId:userId,status:'CONFIRMED' } }))
  }
  const booking = context.bookingId ? await db.booking.findUnique({ where: { id:context.bookingId } }) : null
  if (!booking || !['CONFIRMED','RESCHEDULED','COMPLETED'].includes(booking.status) || ![booking.studentId,booking.tutorId].includes(userId)) return false
  if (context.callId) {
    const row = await db.setting.findUnique({ where: { key:'lesson-call:'+context.callId } })
    if (!row) return false
    const call = JSON.parse(row.value)
    return call.roomId === context.roomId && call.bookingId === booking.id && call.status !== 'ended' && (call.studentJoinedAt || Date.now() < Date.parse(call.deadline)) && Date.now() < Date.parse(call.studentJoinedAt || call.createdAt) + (call.durationMin+45)*60000
  }
  return booking.roomId === context.roomId && Date.now() < +booking.endUtc + 45*60000
}
