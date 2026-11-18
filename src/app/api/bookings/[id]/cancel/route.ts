import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getSettings, notify, audit } from '@/lib/settings'

/** POST /api/bookings/:id/cancel — student, tutor or admin cancels with refund rules. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const { reason } = await body<{ reason?: string }>(req).catch(() => ({ reason: '' }))
    const settings = await getSettings()

    const booking = await db.booking.findUnique({ where: { id } })
    if (!booking) return fail(404, 'Booking not found')
    if(booking.packagePurchaseId&&(await db.packagePurchase.findUnique({where:{id:booking.packagePurchaseId}}))?.status==='PENDING')return fail(409,'Ask an administrator to reject the complete package purchase before changing its reserved lessons')
    const isStudent = booking.studentId === user.id
    const isTutor = booking.tutorId === user.id
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPPORT'
    if (!isStudent && !isTutor && !isAdmin) return fail(403, 'Not allowed')
    if (!['CONFIRMED', 'RESCHEDULED', 'PENDING_PAYMENT'].includes(booking.status)) {
      return fail(400, `A ${booking.status.toLowerCase()} lesson cannot be cancelled`)
    }

    const noticeOk = booking.startUtc.getTime() - Date.now() >= settings.minCancelNoticeHours * 3600 * 1000
    const shouldRefund = booking.status === 'PENDING_PAYMENT' || (['CONFIRMED', 'RESCHEDULED'].includes(booking.status) && (noticeOk || isTutor || isAdmin))

    await db.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data: {
          status: 'CANCELLED',
          cancelReason: reason || null,
          cancelledBy: user.id,
        },
      })
      if (!changed.count) throw Object.assign(new Error('Booking has already changed. Refresh and try again.'), { status: 409 })
      if (shouldRefund) {
        if (booking.paymentMethod === 'WALLET' && booking.priceCents > 0) {
          const u = await tx.user.update({ where: { id: booking.studentId }, data: { walletCents: { increment: booking.priceCents } } })
          const balanceAfter = u.walletCents
          await tx.ledgerEntry.create({
            data: { userId: booking.studentId, type: 'REFUND', amountCents: booking.priceCents, balanceAfterCents: balanceAfter, refType: 'BOOKING', refId: booking.id, description: 'Lesson cancelled — refund to wallet' },
          })
        } else if (booking.paymentMethod === 'CREDIT' && booking.creditId) {
          const credit=await tx.lessonCredit.findUnique({where:{id:booking.creditId}})
          if(credit)await tx.lessonCredit.update({where:{id:credit.id},data:{remaining:{increment:1},...(credit.remainingValueCents!==null?{remainingValueCents:{increment:booking.priceCents}}:{})}})
        }
      }
      const redemption=await tx.couponRedemption.findUnique({where:{bookingId:booking.id}})
      if(redemption&&redemption.status!=='REVERSED'){await tx.couponRedemption.update({where:{id:redemption.id},data:{status:'REVERSED'}});if(booking.couponId)await tx.coupon.update({where:{id:booking.couponId},data:{usedCount:{decrement:1}}})}
      await tx.payment.updateMany({ where: { refId: booking.id, purpose: 'LESSON', status: 'PENDING' }, data: { status: 'CANCELLED' } })
      if (isTutor) {
        await tx.tutorProfile.update({ where: { id: booking.tutorProfileId }, data: { lessonsCancelled: { increment: 1 } } }).catch(() => null)
      }
    })

    const refundNote = shouldRefund ? booking.paymentMethod === 'WALLET' ? 'Your reserved wallet funds were returned.' : booking.paymentMethod === 'CREDIT' ? 'Your package credit was returned.' : 'Contact the administrator about any payment already made.' : ''
    await notify(booking.studentId, 'booking', 'Lesson cancelled', `The lesson on ${booking.startUtc.toUTCString()} was cancelled. ${refundNote}`, 'lessons')
    if (booking.status !== 'PENDING_PAYMENT') await notify(booking.tutorId, 'booking', 'Lesson cancelled', `A lesson on ${booking.startUtc.toUTCString()} was cancelled by the ${isStudent ? 'student' : isTutor ? 'tutor' : 'administrator'}.`, 'calendar')
    await audit(user.id, 'BOOKING_CANCEL', 'booking', id, { reason, refunded: shouldRefund })
    return ok({ ok: true, refunded: shouldRefund })
  })
}
