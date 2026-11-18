import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { notify } from '@/lib/settings'
import { getLessonCall, callDurationSeconds } from '@/lib/lesson-calls'

/** POST /api/reviews — student reviews a completed lesson (one per booking). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ bookingId: string; rating: number; comment?: string; callId?: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['bookingId', 'rating'])
    const rating = Math.round(Number(data.rating))
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return fail(400, 'Rating must be between 1 and 5')

    const booking = await db.booking.findUnique({ where: { id: data.bookingId } })
    if (!booking) return fail(404, 'Booking not found')
    if (booking.studentId !== user.id) return fail(403, 'You can only review your own lessons')
    const call = data.callId ? await getLessonCall(data.callId) : null
    const completedCall = call && call.bookingId === booking.id && call.studentId === user.id && call.status === 'ended' && callDurationSeconds(call) > 0
    if (booking.status !== 'COMPLETED' && !completedCall) return fail(400, 'You can review this lesson after the call has ended')

    const existing = await db.review.findUnique({ where: { bookingId: booking.id } })
    if (existing) return fail(409, 'You have already reviewed this lesson')

    const review = await db.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: { bookingId: booking.id, studentId: user.id, tutorId: booking.tutorProfileId, rating, comment: data.comment ?? '' },
      })
      await tx.tutorProfile.update({
        where: { id: booking.tutorProfileId },
        data: { ratingSum: { increment: rating }, reviewCount: { increment: 1 } },
      })
      return r
    })

    await notify(booking.tutorId, 'review', 'You received a new review', `${user.name} rated your lesson ${rating}/5.`, 'reviews')
    return ok({ review })
  })
}
