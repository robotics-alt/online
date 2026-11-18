import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getSettings, notify, audit } from '@/lib/settings'

/**
 * POST /api/bookings/:id/complete — tutor (or admin) marks the lesson as completed.
 * Releases tutor earnings (net of commission) into the tutor's wallet with ledger entries.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const settings = await getSettings()

    const booking = await db.booking.findUnique({ where: { id } })
    if (!booking) return fail(404, 'Booking not found')
    if (booking.tutorId !== user.id && user.role !== 'ADMIN') return fail(403, 'Only the tutor or an admin can complete a lesson')
    if (booking.status !== 'CONFIRMED' && booking.status !== 'RESCHEDULED' && booking.status !== 'NO_SHOW') {
      return fail(400, `Cannot complete a ${booking.status.toLowerCase()} lesson`)
    }

    const tutorProfile = await db.tutorProfile.findUnique({ where: { id: booking.tutorProfileId } })
    if (!tutorProfile) return fail(404, 'Tutor profile missing')

    const commissionPercent = booking.isTrial
      ? settings.trialCommissionPercent
      : (tutorProfile.commissionPercent ?? settings.commissionPercent)
    const commissionCents = Math.round((booking.priceCents * commissionPercent) / 100)
    const tutorNetCents = booking.priceCents - commissionCents

    let newStudent = false
    await db.$transaction(async (tx) => {
      const claimed=await tx.booking.updateMany({where:{id,status:booking.status},data:{status:'COMPLETED',completedAt:new Date(),commissionCents,tutorNetCents}})
      if(!claimed.count)throw Object.assign(new Error('Lesson already updated'),{status:409})
      // Release earnings (paid lessons only; wallet/credit payments were collected at booking)
      if (booking.paymentMethod !== 'EXTERNAL' && booking.priceCents > 0) {
        const u=await tx.user.update({where:{id:booking.tutorId},data:{walletCents:{increment:tutorNetCents}},select:{walletCents:true}})
        const balanceAfter=u.walletCents
        await tx.ledgerEntry.create({
          data: { userId: booking.tutorId, type: 'EARNING', amountCents: tutorNetCents, balanceAfterCents: balanceAfter, refType: 'BOOKING', refId: booking.id, description: `Lesson completed (net of ${commissionPercent}% commission)` },
        })
      }
      const priorLessons = await tx.booking.count({
        where: { tutorId: booking.tutorId, studentId: booking.studentId, status: 'COMPLETED' },
      })
      newStudent = priorLessons === 1
      await tx.tutorProfile.update({
        where: { id: booking.tutorProfileId },
        data: {
          lessonsCompleted: { increment: 1 },
          ...(newStudent ? { studentsCount: { increment: 1 } } : {}),
        },
      })
    })

    await notify(booking.studentId, 'booking', 'Lesson completed', 'Thanks for learning with us! You can now rate your tutor.', 'lessons')
    await notify(booking.tutorId, 'booking', 'Earnings released', `You earned ${(tutorNetCents / 100).toFixed(2)} USD from this lesson.`, 'earnings')
    await audit(user.id, 'BOOKING_COMPLETE', 'booking', id, { commissionCents, tutorNetCents })
    return ok({ ok: true, commissionCents, tutorNetCents })
  })
}
