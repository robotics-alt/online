import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { notify, audit } from '@/lib/settings'

/** GET /api/admin/payouts — withdrawal requests queue. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const payouts = await db.payoutRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tutor: { include: { user: { select: { name: true, email: true, walletCents: true } } } } },
    })
    return ok({ payouts })
  })
}

/** POST /api/admin/payouts — approve / reject (refund) / mark paid. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const data = await body<{ payoutId: string; action: 'approve' | 'reject' | 'mark_paid'; note?: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['payoutId', 'action'])
    const payout = await db.payoutRequest.findUnique({ where: { id: data.payoutId }, include: { tutor: { include: { user: true } } } })
    if (!payout) return fail(404, 'Payout request not found')
    const tutorUserId = payout.tutor.userId

    if (data.action === 'approve') {
      if (payout.status !== 'REQUESTED') return fail(400, 'Only requested payouts can be approved')
      await db.payoutRequest.update({ where: { id: payout.id }, data: { status: 'APPROVED', note: data.note } })
      await notify(tutorUserId, 'payout', 'Withdrawal approved', `Your withdrawal of ${(payout.amountCents / 100).toFixed(2)} USD is being processed.`)
    } else if (data.action === 'reject') {
      if (!['REQUESTED', 'APPROVED'].includes(payout.status)) return fail(400, 'Cannot reject this payout')
      await db.$transaction(async (tx) => {
        await tx.payoutRequest.update({ where: { id: payout.id }, data: { status: 'REJECTED', note: data.note ?? 'Rejected by administrator' } })
        const u = await tx.user.findUnique({ where: { id: tutorUserId }, select: { walletCents: true } })
        const balanceAfter = (u?.walletCents ?? 0) + payout.amountCents
        await tx.user.update({ where: { id: tutorUserId }, data: { walletCents: balanceAfter } })
        await tx.ledgerEntry.create({
          data: { userId: tutorUserId, type: 'REFUND', amountCents: payout.amountCents, balanceAfterCents: balanceAfter, refType: 'PAYOUT', refId: payout.id, description: 'Withdrawal rejected — funds returned' },
        })
      })
      await notify(tutorUserId, 'payout', 'Withdrawal rejected', data.note || 'Your withdrawal was rejected and funds were returned to your balance.')
    } else {
      if (payout.status !== 'APPROVED') return fail(400, 'Approve the payout before marking it paid')
      await db.payoutRequest.update({ where: { id: payout.id }, data: { status: 'PAID', processedAt: new Date(), note: data.note ?? payout.note } })
      await notify(tutorUserId, 'payout', 'Withdrawal paid 💸', `${(payout.amountCents / 100).toFixed(2)} USD has been sent via ${payout.method}.`)
    }
    await audit(admin.id, `PAYOUT_${data.action.toUpperCase()}`, 'payoutRequest', payout.id, { amountCents: payout.amountCents })
    return ok({ ok: true })
  })
}
