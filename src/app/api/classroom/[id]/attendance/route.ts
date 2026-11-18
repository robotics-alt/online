import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/** POST /api/classroom/:id/attendance — record join/leave events for attendance tracking. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const data = await body<{ event: 'join' | 'leave'; seconds?: number }>(req)

    const booking = await db.booking.findUnique({ where: { id } })
    if (!booking) return fail(404, 'Lesson not found')
    if (booking.studentId !== user.id && booking.tutorId !== user.id) return fail(403, 'Not allowed')

    if (data.event === 'join') {
      const open = await db.lessonAttendance.findFirst({ where: { bookingId: id, userId: user.id, leftAt: null } })
      if (!open) {
        await db.lessonAttendance.create({ data: { bookingId: id, userId: user.id } })
      }
      return ok({ ok: true })
    }
    // leave
    const open = await db.lessonAttendance.findFirst({ where: { bookingId: id, userId: user.id, leftAt: null }, orderBy: { joinedAt: 'desc' } })
    if (open) {
      const seconds = data.seconds ?? Math.round((Date.now() - open.joinedAt.getTime()) / 1000)
      await db.lessonAttendance.update({ where: { id: open.id }, data: { leftAt: new Date(), seconds } })
    }
    return ok({ ok: true })
  })
}
