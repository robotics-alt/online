import { randomUUID } from 'crypto'
import { db } from './db'
import { ApiError } from './auth'

export const CALL_WAIT_MS = 15 * 60 * 1000
export interface LessonCall {
  id: string; bookingId: string; roomId: string; tutorId: string; studentId: string
  tutorName: string; studentName: string; subject: string; scheduledAt: string; durationMin: number
  status: 'ringing' | 'accepted' | 'active' | 'ended'
  createdAt: string; deadline: string; acceptedAt?: string; studentJoinedAt?: string; teacherJoinedAt?: string; endedAt?: string
  endReason?: 'no_answer' | 'declined' | 'hangup' | 'lesson_unavailable' | 'completed'
}
const key = (id: string) => `lesson-call:${id}`
export function callDurationSeconds(call: LessonCall): number {
  if (!call.studentJoinedAt || !call.teacherJoinedAt || !call.endedAt) return 0
  return Math.max(0, Math.floor((Date.parse(call.endedAt) - Math.max(Date.parse(call.studentJoinedAt), Date.parse(call.teacherJoinedAt))) / 1000))
}
export function expireCall(call: LessonCall, now = Date.now()): LessonCall {
  if (call.status !== 'ended' && !call.studentJoinedAt && now >= Date.parse(call.deadline)) {
    return { ...call, status: 'ended', endedAt: new Date(now).toISOString(), endReason: 'no_answer' }
  }
  if (call.status !== 'ended' && call.studentJoinedAt && now >= Date.parse(call.studentJoinedAt) + (call.durationMin + 45) * 60000) {
    return { ...call, status: 'ended', endedAt: new Date(now).toISOString(), endReason: 'completed' }
  }
  return call
}
export async function getLessonCall(id: string): Promise<LessonCall | null> {
  const row = await db.setting.findUnique({ where: { key: key(id) } })
  if (!row) return null
  const stored = JSON.parse(row.value) as LessonCall
  // Read-time expiration survives restarts; mutations persist the terminal state transactionally.
  return expireCall(stored)
}
export async function listLessonCalls(userId: string): Promise<LessonCall[]> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'lesson-call:' } } })
  return rows.map((row) => expireCall(JSON.parse(row.value) as LessonCall))
    .filter((call) => (call.tutorId === userId || call.studentId === userId) && call.status !== 'ended')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export async function startLessonCall(bookingId: string, tutorId: string): Promise<LessonCall> {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { tutor: true, student: true, subject: true } })
    if (!booking || booking.tutorId !== tutorId) throw new ApiError(404, 'Lesson not found')
    if (!['CONFIRMED', 'RESCHEDULED'].includes(booking.status)) throw new ApiError(400, 'Only confirmed lessons can be called')
    if (booking.lessonFormat === 'FACE_TO_FACE') throw new ApiError(400, 'This is a face-to-face appointment')
    if (Date.now() > booking.endUtc.getTime() + 45 * 60000) throw new ApiError(400, 'This lesson has ended')
    const rows = await tx.setting.findMany({ where: { key: { startsWith: 'lesson-call:' } } })
    const calls = rows.map((row) => expireCall(JSON.parse(row.value) as LessonCall)).filter((call) => call.status !== 'ended')
    const existing = calls.find((call) => call.bookingId === bookingId)
    if (existing) return existing
    if (calls.some((call) => call.tutorId === tutorId || call.studentId === booking.studentId)) throw new ApiError(409, 'A participant already has an active lesson call')
    const now = Date.now()
    const call: LessonCall = {
      id: randomUUID(), bookingId, roomId: `call-${randomUUID()}`, tutorId, studentId: booking.studentId,
      tutorName: booking.tutor.name, studentName: booking.student.name, subject: booking.subject?.name || 'Private lesson',
      scheduledAt: booking.startUtc.toISOString(), durationMin: booking.durationMin,
      status: 'ringing', createdAt: new Date(now).toISOString(), deadline: new Date(now + CALL_WAIT_MS).toISOString(),
    }
    await tx.setting.create({ data: { key: key(call.id), value: JSON.stringify(call) } })
    return call
  })
}
export async function updateLessonCall(id: string, userId: string, action: 'accept' | 'decline' | 'end' | 'join'): Promise<LessonCall> {
  return db.$transaction(async (tx) => {
    const row = await tx.setting.findUnique({ where: { key: key(id) } })
    if (!row) throw new ApiError(404, 'Call not found')
    let call = expireCall(JSON.parse(row.value) as LessonCall)
    if (call.studentId !== userId && call.tutorId !== userId) throw new ApiError(403, 'You are not a participant of this call')
    if (call.status === 'ended') {
      if (action !== 'end') throw new ApiError(410, 'This call has ended')
      return call
    }
    const now = new Date().toISOString()
    if (action === 'accept' || action === 'decline') {
      if (userId !== call.studentId) throw new ApiError(403, 'Only the invited student can answer')
      if (call.studentJoinedAt) throw new ApiError(409, 'The lesson is already in progress')
      call = action === 'accept' ? { ...call, status: 'accepted', acceptedAt: call.acceptedAt || now } : { ...call, status: 'ended', endedAt: now, endReason: 'declined' }
    } else if (action === 'end') call = { ...call, status: 'ended', endedAt: now, endReason: 'hangup' }
    else if (userId === call.studentId) call = { ...call, status: 'active', studentJoinedAt: call.studentJoinedAt || now, acceptedAt: call.acceptedAt || now }
    else call = { ...call, teacherJoinedAt: call.teacherJoinedAt || now }
    await tx.setting.update({ where: { key: key(id) }, data: { value: JSON.stringify(call) } })
    return call
  })
}
