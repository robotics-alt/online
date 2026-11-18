import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/stats — dashboard statistics + chart series. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const [
      totalStudents, totalTutors, activeTutors, pendingApplications,
      totalBookings, completedLessons, cancelledLessons,
      newStudentsThisMonth, activeSubscriptions,
      completedBookings, ledgerSpend, payoutsPending, refundsTotal, commissionTotal,
    ] = await Promise.all([
      db.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      db.user.count({ where: { role: 'TUTOR' } }),
      db.tutorProfile.count({ where: { status: 'APPROVED' } }),
      db.tutorProfile.count({ where: { status: 'PENDING' } }),
      db.booking.count(),
      db.booking.count({ where: { status: 'COMPLETED' } }),
      db.booking.count({ where: { status: 'CANCELLED' } }),
      db.user.count({ where: { role: 'STUDENT', createdAt: { gte: monthStart } } }),
      db.lessonCredit.count({ where: { remaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      db.booking.findMany({ where: { status: 'COMPLETED' }, select: { priceCents: true, commissionCents: true, tutorNetCents: true, completedAt: true, createdAt: true } }),
      db.ledgerEntry.aggregate({ where: { type: 'SPEND' }, _sum: { amountCents: true } }),
      db.payoutRequest.aggregate({ where: { status: { in: ['REQUESTED', 'APPROVED'] } }, _sum: { amountCents: true } }),
      db.ledgerEntry.aggregate({ where: { type: 'REFUND' }, _sum: { amountCents: true } }),
      db.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { commissionCents: true } }),
    ])

    const grossVolume = completedBookings.reduce((s, b) => s + b.priceCents, 0)
    const platformRevenue = commissionTotal._sum.commissionCents ?? 0
    const tutorPayable = completedBookings.reduce((s, b) => s + b.tutorNetCents, 0)

    // Bookings per day for the last 30 days
    const bookings30: { date: string; count: number; revenueCents: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(dayStart.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const dayBookings = completedBookings.filter((b) => (b.completedAt ?? b.createdAt).toISOString().slice(0, 10) === key)
      bookings30.push({ date: key, count: dayBookings.length, revenueCents: dayBookings.reduce((s, b) => s + b.commissionCents, 0) })
    }
    // Revenue per month for 6 months
    const revenue6: { month: string; revenueCents: number; grossCents: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const key = d.toISOString().slice(0, 7)
      const monthBookings = completedBookings.filter((b) => (b.completedAt ?? b.createdAt).toISOString().slice(0, 7) === key)
      revenue6.push({
        month: key,
        revenueCents: monthBookings.reduce((s, b) => s + b.commissionCents, 0),
        grossCents: monthBookings.reduce((s, b) => s + b.priceCents, 0),
      })
    }
    const subjectDist = await db.booking.groupBy({
      by: ['subjectId'], where: { status: 'COMPLETED', subjectId: { not: null } }, _count: { id: true },
    })
    const subjects = await db.subject.findMany({ select: { id: true, name: true } })
    const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]))

    return ok({
      cards: {
        totalStudents, totalTutors, activeTutors, pendingApplications,
        totalBookings, completedLessons, cancelledLessons,
        newStudentsThisMonth, activeSubscriptions,
        grossVolumeCents: grossVolume,
        platformRevenueCents: platformRevenue,
        tutorPayableCents: tutorPayable,
        pendingWithdrawalsCents: payoutsPending._sum.amountCents ?? 0,
        refundsCents: refundsTotal._sum.amountCents ?? 0,
        walletLiabilityCents: ledgerSpend._sum.amountCents ?? 0,
      },
      bookings30, revenue6,
      subjectDist: subjectDist.map((s) => ({ name: subjectMap[s.subjectId ?? ''] ?? 'Other', count: s._count.id })),
    })
  })
}
