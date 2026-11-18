import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

/** GET /api/admin/finance — ledger, payments and financial totals. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const type = req.nextUrl.searchParams.get('type') ?? ''
    const where: Prisma.LedgerEntryWhereInput = type ? { type: type as Prisma.EnumLedgerTypeFilter } : {}
    const [entries, payments, commissionAgg, spendAgg, refundAgg, payoutAgg] = await Promise.all([
      db.ledgerEntry.findMany({
        where, orderBy: { createdAt: 'desc' }, take: 80,
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 60, include: { user: { select: { name: true, email: true } } } }),
      db.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { commissionCents: true } }),
      db.ledgerEntry.aggregate({ where: { type: 'SPEND' }, _sum: { amountCents: true } }),
      db.ledgerEntry.aggregate({ where: { type: 'REFUND' }, _sum: { amountCents: true } }),
      db.ledgerEntry.aggregate({ where: { type: 'PAYOUT' }, _sum: { amountCents: true } }),
    ])
    const totals = {
      commissionCents: commissionAgg._sum.commissionCents ?? 0,
      processedVolumeCents: spendAgg._sum.amountCents ?? 0,
      refundsCents: refundAgg._sum.amountCents ?? 0,
      payoutsCents: payoutAgg._sum.amountCents ?? 0,
    }
    return ok({ entries, payments, totals })
  })
}
