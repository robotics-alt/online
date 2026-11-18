import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, fail, ok } from '@/lib/api'
import { requireUser, ApiError } from '@/lib/auth'

const WD = 60 * 24

/** GET /api/tutor/availability — weekly rules + exceptions. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const profile = await db.tutorProfile.findUnique({
      where: { userId: user.id },
      include: { rules: { orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] }, exceptions: { orderBy: { date: 'asc' } } },
    })
    if (!profile) throw new ApiError(404, 'Tutor profile not found')
    return ok({ rules: profile.rules, exceptions: profile.exceptions, vacationMode: profile.vacationMode })
  })
}

interface AvailBody {
  rules?: { weekday: number; startMin: number; endMin: number }[]
  vacationMode?: boolean
  addException?: { date: string; allDay: boolean; startMin?: number; endMin?: number; reason?: string }
  removeExceptionId?: string
  vacationRange?: { from: string; to: string }
}

/** PUT /api/tutor/availability — replace weekly rules, toggle vacation, manage exceptions. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const data = await body<AvailBody>(req)
    const profile = await db.tutorProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, 'Tutor profile not found')

    if (data.vacationRange) {
      const { from, to } = data.vacationRange
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return fail(400, 'Choose valid vacation dates')
      const start = Date.parse(from + 'T00:00:00Z'); const end = Date.parse(to + 'T00:00:00Z')
      if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString().slice(0, 10) !== from || new Date(end).toISOString().slice(0, 10) !== to || end < start || end - start > 365 * 86400000) return fail(400, 'Choose a valid vacation date range within one year')
      const dates: string[] = []
      for (let time = start; time <= end; time += 86400000) dates.push(new Date(time).toISOString().slice(0, 10))
      await db.$transaction(async (tx) => {
        const existing = await tx.availabilityException.findMany({ where: { tutorId: profile.id, date: { in: dates }, allDay: true }, select: { date: true } })
        const blocked = new Set(existing.map((entry) => entry.date))
        await tx.availabilityException.createMany({ data: dates.filter((date) => !blocked.has(date)).map((date) => ({ tutorId: profile.id, date, allDay: true, reason: 'Vacation' })) })
      })
    }

    if (data.rules !== undefined) {
      const cleaned = data.rules
        .filter((r) => Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6 && r.startMin >= 0 && r.endMin <= WD && r.endMin - r.startMin >= 30)
        .slice(0, 40)
      await db.$transaction([
        db.availabilityRule.deleteMany({ where: { tutorId: profile.id } }),
        db.availabilityRule.createMany({ data: cleaned.map((r) => ({ tutorId: profile.id, weekday: r.weekday, startMin: r.startMin, endMin: r.endMin })) }),
      ])
    }
    if (data.vacationMode !== undefined) {
      await db.tutorProfile.update({ where: { id: profile.id }, data: { vacationMode: Boolean(data.vacationMode) } })
    }
    if (data.addException) {
      const ex = data.addException
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.date)) return fail(400, 'Invalid date')
      await db.availabilityException.create({
        data: {
          tutorId: profile.id, date: ex.date, allDay: Boolean(ex.allDay),
          startMin: ex.allDay ? null : (ex.startMin ?? 0),
          endMin: ex.allDay ? null : (ex.endMin ?? WD),
          reason: ex.reason ?? '',
        },
      })
    }
    if (data.removeExceptionId) {
      await db.availabilityException.deleteMany({ where: { id: data.removeExceptionId, tutorId: profile.id } })
    }
    return ok({ ok: true })
  })
}
