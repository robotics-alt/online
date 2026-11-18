import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, ApiError } from '@/lib/auth'
import { body, handle, fail, ok } from '@/lib/api'
import { notify, audit } from '@/lib/settings'
import { POST as cancelBooking } from '@/app/api/bookings/[id]/cancel/route'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const { id } = await context.params
    const data = await body<{ action: string; reason?: string }>(req)
    const booking = await db.booking.findUnique({ where: { id } })
    if (!booking) return fail(404, 'Booking not found')
    if(booking.packagePurchaseId&&(await db.packagePurchase.findUnique({where:{id:booking.packagePurchaseId}}))?.status==='PENDING')return fail(409,'Review this package purchase in Coupons & Packages')
    if (booking.status !== 'PENDING_PAYMENT') return fail(409, 'This booking is no longer awaiting approval')
    if (data.action === 'reject') return cancelBooking(new NextRequest(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ reason: data.reason || 'Payment not approved by administrator' }) }), context)
    if (data.action !== 'approve') return fail(400, 'Choose approve or reject')
    if (booking.endUtc < new Date()) return fail(400, 'This appointment has passed. Reject it and arrange a new time.')
    await db.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { refId: id, purpose: 'LESSON', status: 'PENDING' } })
      if (!payment) throw new ApiError(409, 'No pending payment record exists for this appointment')
      const changed = await tx.booking.updateMany({ where: { id, status: 'PENDING_PAYMENT' }, data: { status: 'CONFIRMED', approvedAt: new Date(), approvedBy: admin.id } })
      if (!changed.count) throw new ApiError(409, 'This booking has already changed')
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', description: 'Payment verified and approved by administrator' } })
    })
    await notify(booking.studentId, 'booking', 'Appointment approved', 'Your payment was approved. Your appointment is confirmed.', 'lessons')
    await notify(booking.tutorId, 'booking', 'New approved appointment', `${booking.startUtc.toUTCString()} · ${booking.lessonFormat === 'FACE_TO_FACE' ? 'Face to face — arrangements coordinated by admin' : 'Online lesson'}`, 'calendar')
    await audit(admin.id, 'BOOKING_APPROVE', 'booking', id, { paymentMethod: booking.paymentMethod })
    return ok({ ok: true })
  })
}
