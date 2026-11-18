import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { requireUser, signPayload } from '@/lib/auth'
import { notify } from '@/lib/settings'
import { CLASSROOM_EARLY_MS, CLASSROOM_GRACE_MS } from '@/lib/lesson-access'
import { getLessonCall, listLessonCalls } from '@/lib/lesson-calls'

/** GET /api/classroom/:id/token — signed, expiring room access token for booked participants. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const booking = await db.booking.findUnique({ where: { id } })
    if (!booking) return fail(404, 'Lesson not found')
    if (booking.studentId !== user.id && booking.tutorId !== user.id && user.role !== 'ADMIN') {
      return fail(403, 'You are not a participant of this lesson')
    }
    if (!['CONFIRMED', 'RESCHEDULED', 'COMPLETED'].includes(booking.status)) {
      return fail(400, 'This lesson is not active')
    }
    if (booking.lessonFormat === 'FACE_TO_FACE') return fail(400, 'This is a face-to-face appointment')
    const now = Date.now()
    const requestedCall = req.nextUrl.searchParams.get('callId')
    const call = requestedCall ? await getLessonCall(requestedCall) : (await listLessonCalls(user.id)).find((item) => item.bookingId === id) || null
    if (requestedCall && (!call || call.bookingId !== id || (call.tutorId !== user.id && call.studentId !== user.id))) return fail(404, 'Call not found')
    if (call?.status === 'ended') return fail(410, call.endReason === 'no_answer' ? 'The student did not join within 15 minutes. This call has ended.' : 'This call has ended')
    const opensAt = booking.startUtc.getTime() - CLASSROOM_EARLY_MS
    const closesAt = booking.endUtc.getTime() + CLASSROOM_GRACE_MS
    if (!call && now < opensAt) {
      return fail(423, `The classroom opens 15 minutes before your lesson (${booking.startUtc.toUTCString()})`)
    }
    if (!call && now > closesAt) return fail(423, 'This classroom has closed')

    const role = booking.tutorId === user.id ? 'tutor' : 'student'
    const roomId = call?.roomId || booking.roomId
    if(!call&&await db.setting.findUnique({where:{key:'classroom-ended:'+roomId}}))return fail(410,'This classroom has ended')
    const token = signPayload({ bookingId: booking.id, roomId, userId: user.id, name: user.name, role, ...(call ? { callId: call.id } : {}) }, 3 * 3600 * 1000)
    const callStart = call?.studentJoinedAt || call?.createdAt
    return ok({
      token, roomId, role, call,
      startsAt: callStart || booking.startUtc.toISOString(), endsAt: callStart ? new Date(Date.parse(callStart) + booking.durationMin * 60000).toISOString() : booking.endUtc.toISOString(),
      lessonLabel: booking.isTrial ? 'Trial lesson' : `${booking.durationMin} min lesson`,
    })
  })
}
