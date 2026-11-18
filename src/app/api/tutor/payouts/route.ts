import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser, ApiError } from '@/lib/auth'
import { getSettings, notify, audit } from '@/lib/settings'
import { parseAmountToCents } from '@/lib/money'

/** GET /api/tutor/payouts — payout history. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const profile = await db.tutorProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, 'Tutor profile not found')
    const payouts = await db.payoutRequest.findMany({ where: { tutorId: profile.id }, orderBy: { createdAt: 'desc' } })
    return ok({ payouts, balanceCents: user.walletCents, payoutMethod: profile.payoutMethod, payoutDetails: profile.payoutDetails })
  })
}

/** POST /api/tutor/payouts — request a withdrawal (deducts from wallet into pending state). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const data = await body<{ amount: number; method?: string; details?: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['amount'])
    const settings = await getSettings()
    const profile = await db.tutorProfile.findUnique({ where: { userId: user.id } })
    if (!profile) throw new ApiError(404, 'Tutor profile not found')
    if (profile.status !== 'APPROVED') return fail(403, 'Payouts require an approved tutor account')

    const amountCents = parseAmountToCents(data.amount)
    if (amountCents < settings.payoutMinCents) {
      return fail(400, `Minimum withdrawal is ${(settings.payoutMinCents / 100).toFixed(2)} USD`)
    }
    if (amountCents > user.walletCents) return fail(400, 'Amount exceeds your available balance')

    const payout = await db.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: user.id }, select: { walletCents: true } })
      const balanceAfter = (u?.walletCents ?? 0) - amountCents
      await tx.user.update({ where: { id: user.id }, data: { walletCents: balanceAfter } })
      await tx.ledgerEntry.create({
        data: { userId: user.id, type: 'PAYOUT', amountCents: -amountCents, balanceAfterCents: balanceAfter, refType: 'PAYOUT', description: 'Withdrawal request (pending admin approval)' },
      })
      return tx.payoutRequest.create({
        data: {
          tutorId: profile.id, amountCents,
          method: data.method ?? profile.payoutMethod ?? 'bank_transfer',
          details: data.details ?? profile.payoutDetails ?? '',
        },
      })
    })
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    for (const a of admins) {
      await notify(a.id, 'payout', 'Withdrawal request', `${user.name} requested ${(amountCents / 100).toFixed(2)} USD.`, 'admin-payouts')
    }
    await audit(user.id, 'PAYOUT_REQUEST', 'payoutRequest', payout.id, { amountCents })
    return ok({ payout })
  })
}

/** PUT — update payout account details. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const data = await body<{ method: string; details: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['method'])
    await db.tutorProfile.update({
      where: { userId: user.id },
      data: { payoutMethod: data.method, payoutDetails: data.details ?? '' },
    })
    return ok({ ok: true })
  })
}
