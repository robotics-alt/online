import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { teacherBookingVisibility } from '@/lib/booking-visibility'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const studentId = (await params).id
    const where = { ...teacherBookingVisibility, tutorId: user.id, studentId }
    const page = Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get('page')) || 1))
    const count = await db.booking.count({ where })
    if (!count) return fail(404, 'Student not found in your lessons')
    const [bookings, completed] = await Promise.all([
      db.booking.findMany({ where, orderBy: { startUtc: 'desc' }, skip: (page - 1) * 20, take: 20, include: { subject: { select: { name: true } }, review: { select: { rating: true, comment: true } }, attendance: { select: { userId: true, seconds: true } } } }),
      db.booking.count({ where: { ...where, status: 'COMPLETED' } }),
    ])
    return ok({ bookings, count, completed, page, pages: Math.ceil(count / 20) })
  })
}
