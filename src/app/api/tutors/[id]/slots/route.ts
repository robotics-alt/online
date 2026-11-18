import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { zonedToUtc, dateKeyInTz, weekdayInTz, addDaysKey } from '@/lib/tz'

/**
 * GET /api/tutors/:id/slots?from=YYYY-MM-DD&days=14
 * Generates bookable slots in UTC by intersecting the tutor's weekly rules,
 * exceptions, vacation mode, existing bookings, notice period and horizon.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const settings = await getSettings()
    const tutor = await db.tutorProfile.findUnique({
      where: { id },
      include: { user: { select: { timezone: true } }, rules: true, exceptions: true },
    })
    if (!tutor || tutor.status !== 'APPROVED') return fail(404, 'Tutor not found or not accepting bookings')
    if (tutor.vacationMode) return ok({ slots: [], vacationMode: true, timezone: tutor.user.timezone })

    const sp = req.nextUrl.searchParams
    const from = sp.get('from') ?? new Date().toISOString().slice(0, 10)
    const days = Math.min(30, Math.max(1, Number(sp.get('days') ?? 14)))
    const durationMin = settings.slotDurationMin
    const tz = tutor.user.timezone

    const rangeStart = new Date()
    const rangeEnd = zonedToUtc(addDaysKey(from, days), 0, tz)
    const bookings = await db.booking.findMany({
      where: {
        tutorId: tutor.userId,
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED','RESCHEDULED'] },
        endUtc: { gte: rangeStart },
        startUtc: { lte: rangeEnd },
      },
      select: { startUtc: true, endUtc: true },
    })
    const groups=await db.groupClass.findMany({where:{tutorId:tutor.userId,status:'PUBLISHED',startUtc:{lte:rangeEnd}},select:{startUtc:true,durationMin:true}})
    const exceptionsByDate = new Map<string, typeof tutor.exceptions>()
    for (const ex of tutor.exceptions) {
      const list = exceptionsByDate.get(ex.date) ?? []
      list.push(ex)
      exceptionsByDate.set(ex.date, list)
    }

    const now = Date.now()
    const noticeMs = settings.bookingNoticeHours * 3600 * 1000
    const slots: { startUtc: string; endUtc: string; date: string; startLocalMin: number }[] = []

    for (let i = 0; i < days; i++) {
      const dateKey = addDaysKey(from, i)
      const weekday = weekdayInTz(zonedToUtc(dateKey, 720, tz), tz) // noon to avoid DST edge on weekday calc
      const rules = tutor.rules.filter((r) => r.weekday === weekday)
      const dayExceptions = exceptionsByDate.get(dateKey) ?? []
      if (dayExceptions.some((e) => e.allDay)) continue
      for (const rule of rules) {
        for (let m = rule.startMin; m + durationMin <= rule.endMin; m += durationMin) {
          // Skip if blocked by a partial-day exception
          const blocked = dayExceptions.some(
            (e) => !e.allDay && (e.startMin ?? 0) < m + durationMin && (e.endMin ?? 1440) > m,
          )
          if (blocked) continue
          const startUtc = zonedToUtc(dateKey, m, tz)
          const endUtc = new Date(startUtc.getTime() + durationMin * 60000)
          if (startUtc.getTime() < now + noticeMs) continue
          const overlapsBooking = bookings.some(
            (b) => b.startUtc < endUtc && b.endUtc > startUtc,
          )
          if (overlapsBooking) continue
          if(groups.some(group=>group.startUtc<endUtc&&+group.startUtc+group.durationMin*60000>+startUtc))continue
          slots.push({ startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString(), date: dateKey, startLocalMin: m })
        }
      }
    }
    slots.sort((a, b) => a.startUtc.localeCompare(b.startUtc))
    return ok({ slots, timezone: tz, durationMin, vacationMode: false })
  })
}
