import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getSettings, notify } from '@/lib/settings'
import{packageWeek}from'@/lib/package-week'
import { zonedToUtc, weekdayInTz,dateKeyInTz,addDaysKey } from '@/lib/tz'

/** POST /api/bookings/:id/reschedule — move a confirmed lesson to a new available slot. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const data = await body<{ newStartUtc: string; durationMin?: number }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['newStartUtc'])
    const settings = await getSettings()

    const booking = await db.booking.findUnique({ where: { id } })
    if (!booking) return fail(404, 'Booking not found')
    if (booking.studentId !== user.id && booking.tutorId !== user.id && user.role !== 'ADMIN') {
      return fail(403, 'Not allowed')
    }
    if (!['CONFIRMED', 'RESCHEDULED'].includes(booking.status)) {
      return fail(400, 'Only confirmed lessons can be rescheduled')
    }

    const newStart = new Date(data.newStartUtc)
    if (isNaN(newStart.getTime())) return fail(400, 'Invalid new start time')
    const durationMin = data.durationMin ?? booking.durationMin
    const newEnd = new Date(newStart.getTime() + durationMin * 60000)
    if (newStart.getTime() < Date.now() + settings.bookingNoticeHours * 3600 * 1000) {
      return fail(400, `Lessons must be at least ${settings.bookingNoticeHours}h in the future`)
    }

    // Verify the new slot matches the tutor's availability rules
    const tutor = await db.tutorProfile.findUnique({
      where: { id: booking.tutorProfileId },
      include: { user: { select: { timezone: true } }, rules: true, exceptions: true },
    })
    if (!tutor) return fail(404, 'Tutor not found')
    if (tutor.vacationMode) return fail(400, 'Tutor is on vacation mode')
    const tz = tutor.user.timezone
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(newStart)
    const startLocalMin = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(newStart).split(':')[0]) * 60 + Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, minute: '2-digit', hour12: false }).format(newStart))
    const weekday = weekdayInTz(zonedToUtc(dateKey, 720, tz), tz)
    const inRule = tutor.rules.some((r) => r.weekday === weekday && startLocalMin >= r.startMin && startLocalMin + durationMin <= r.endMin)
    if (!inRule) return fail(400, 'The new time is outside the tutor\'s availability')
    const blocked = tutor.exceptions.some((e) => e.date === dateKey && (e.allDay || ((e.startMin ?? 0) < startLocalMin + durationMin && (e.endMin ?? 1440) > startLocalMin)))
    if (blocked) return fail(400, 'The tutor is unavailable at that time')

    await db.$transaction(async (tx) => {
      if(booking.packagePurchaseId&&booking.creditId){const purchase=await tx.packagePurchase.findUniqueOrThrow({where:{id:booking.packagePurchaseId}});const student=await tx.user.findUniqueOrThrow({where:{id:booking.studentId},select:{timezone:true}});const week=packageWeek(dateKeyInTz(newStart,student.timezone)),from=zonedToUtc(week,0,student.timezone),until=zonedToUtc(addDaysKey(week,7),0,student.timezone);const count=await tx.booking.count({where:{id:{not:booking.id},creditId:booking.creditId,status:{not:'CANCELLED'},startUtc:{gte:from,lt:until}}})+await tx.groupEnrollment.count({where:{creditId:booking.creditId,status:{in:['PENDING','CONFIRMED']},group:{startUtc:{gte:from,lt:until}}}});if(count>=purchase.weeklyLessons)throw Object.assign(new Error('This package has reached its lesson limit for the selected week'),{status:400})}
      const overlapping = await tx.booking.count({
        where: {
          tutorId: booking.tutorId,
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
          id: { not: booking.id },
          startUtc: { lt: newEnd },
          endUtc: { gt: newStart },
        },
      })
      if (overlapping > 0) throw Object.assign(new Error('The tutor is already booked at that time'), { status: 409 })
      await tx.booking.update({
        where: { id },
        data: { startUtc: newStart, endUtc: newEnd, durationMin, status: 'CONFIRMED' },
      })
    }).catch((err: Error & { status?: number }) => {
      if (err.status) throw Object.assign(new Error(err.message), { status: err.status })
      if (err.message?.includes('Unique constraint')) throw Object.assign(new Error('That time conflicts with another lesson'), { status: 409 })
      throw err
    })

    await notify(booking.studentId, 'booking', 'Lesson rescheduled', `Your lesson now starts ${newStart.toUTCString()}.`, 'lessons')
    await notify(booking.tutorId, 'booking', 'Lesson rescheduled', `A lesson was moved to ${newStart.toUTCString()}.`, 'calendar')
    return ok({ ok: true, startUtc: newStart.toISOString(), endUtc: newEnd.toISOString() })
  })
}
