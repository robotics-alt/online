import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { handle, fail, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { getLessonCall, callDurationSeconds } from '@/lib/lesson-calls'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, ['STUDENT'])
    const call = await getLessonCall((await params).id)
    if (!call || call.studentId !== user.id) return fail(404, 'Call not found')
    const review = await db.review.findUnique({ where: { bookingId: call.bookingId }, select: { id: true } })
    const durationSeconds = callDurationSeconds(call)
    return ok({ eligible: call.status === 'ended' && durationSeconds > 0 && !review, pending: call.status !== 'ended', callId: call.id, bookingId: call.bookingId, tutorName: call.tutorName, durationSeconds })
  })
}
