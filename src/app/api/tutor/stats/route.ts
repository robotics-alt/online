import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireUser, ApiError } from '@/lib/auth'

/** GET /api/tutor/stats — earnings, performance and profile analytics. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const profile = await db.tutorProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, 'Tutor profile not found')

    const [completed, upcomingCount, upcoming, payoutsSum, ledger] = await Promise.all([
      db.booking.findMany({ where: { tutorId: user.id, status: 'COMPLETED' }, select: { priceCents: true, tutorNetCents: true, commissionCents: true, completedAt: true, startUtc: true } }),
      db.booking.count({ where: { tutorId: user.id, status: { in: ['CONFIRMED', 'RESCHEDULED'] }, startUtc: { gte: new Date() } } }),
      db.booking.findMany({ where: { tutorId: user.id, status: { in: ['CONFIRMED', 'RESCHEDULED'] }, startUtc: { gte: new Date() } }, orderBy: { startUtc: 'asc' }, take: 5, include: { student: { select: { name: true } }, subject: { select: { name: true } } } }),
      db.payoutRequest.aggregate({ where: { tutorId: profile.id, status: { in: ['REQUESTED', 'APPROVED', 'PAID'] } }, _sum: { amountCents: true } }),
      db.ledgerEntry.findMany({ where: { userId: user.id, type: 'EARNING' }, orderBy: { createdAt: 'asc' } }),
    ])

    const grossCents = completed.reduce((s, b) => s + b.priceCents, 0)
    const netCents = completed.reduce((s, b) => s + b.tutorNetCents, 0)
    const commissionCents = completed.reduce((s, b) => s + b.commissionCents, 0)

    // Monthly revenue for the last 6 months
    const monthly: { month: string; netCents: number; lessons: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(1)
      d.setUTCMonth(d.getUTCMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const monthLessons = completed.filter((b) => (b.completedAt ?? b.startUtc).toISOString().slice(0, 7) === key)
      monthly.push({ month: key, netCents: monthLessons.reduce((s, b) => s + b.tutorNetCents, 0), lessons: monthLessons.length })
    }

    // Attendance: completed lessons where tutor actually joined
    const tutorAttendance = await db.lessonAttendance.count({ where: { userId: user.id, booking: { status: 'COMPLETED' } } })
    const attendanceRate = completed.length > 0 ? Math.min(100, Math.round((tutorAttendance / completed.length) * 100)) : 100
    // Retention: students with 2+ completed lessons
    const studentsMulti = await db.booking.groupBy({
      by: ['studentId'], where: { tutorId: user.id, status: 'COMPLETED' }, _count: { id: true },
    })
    const retention = studentsMulti.length > 0
      ? Math.round((studentsMulti.filter((s) => s._count.id >= 2).length / studentsMulti.length) * 100)
      : 0

    return ok({
      overview: {
        grossCents, netCents, commissionCents,
        availableBalanceCents: user.walletCents,
        pendingPayoutCents: payoutsSum._sum.amountCents ?? 0,
        totalStudents: profile.studentsCount,
        completedLessons: profile.lessonsCompleted,
        upcomingLessons: upcomingCount,
        averageRating: profile.reviewCount > 0 ? Math.round((profile.ratingSum / profile.reviewCount) * 10) / 10 : null,
        reviewCount: profile.reviewCount,
        profileViews: profile.profileViews,
        conversionRate: profile.profileViews > 0 ? Math.round((profile.lessonsCompleted / profile.profileViews) * 1000) / 10 : null,
        attendanceRate, retentionRate: retention,
      },
      monthly,
      upcoming,
      ledger: ledger.slice(-10).reverse(),
    })
  })
}
