import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { notify, audit } from '@/lib/settings'
import type { Role } from '@prisma/client'

interface UserAction {
  action: 'suspend' | 'activate' | 'grant_credits' | 'set_commission' | 'change_role' | 'approve_tutor' | 'reject_tutor'
  fundingSource?: string
  amountCents?: number
  note?: string
  commissionPercent?: number
  role?: Role
  reason?: string
}

/** POST /api/admin/users/:id — admin actions on a user. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const { id } = await params
    const data = await body<UserAction>(req)
    requireFields(data as unknown as Record<string, unknown>, ['action'])
    const user = await db.user.findUnique({ where: { id }, include: { tutorProfile: true } })
    if (!user) return fail(404, 'User not found')
    if (user.role === 'ADMIN' && admin.id !== user.id && (data.action === 'suspend' || data.action === 'change_role')) {
      return fail(403, 'Admin accounts cannot be suspended or demoted by other admins')
    }

    switch (data.action) {
      case 'suspend':
        await db.user.update({ where: { id }, data: { status: 'SUSPENDED' } })
        await db.session.deleteMany({ where: { userId: id } })
        await notify(id, 'account', 'Account suspended', data.note || 'Your account has been suspended. Contact support for details.')
        break
      case 'activate':
        await db.user.update({ where: { id }, data: { status: 'ACTIVE' } })
        await notify(id, 'account', 'Account restored', 'Your account has been reactivated.')
        break
      case 'grant_credits': {
        const amount = Number(data.amountCents)
        if (!Number.isInteger(amount) || !amount || Math.abs(amount)>100000000) return fail(400,'Enter a non-zero amount up to 1,000,000 USD')
        const cash=data.fundingSource==='REAL_MONEY'
        if(cash&&amount<0)return fail(400,'Cash deposits must be positive')
        if(!data.note?.trim())return fail(400,'A reason or payment reference is required')
        await db.$transaction(async tx=>{
          const changed=await tx.user.updateMany({where:{id,...(amount<0?{walletCents:{gte:-amount}}:{})},data:{walletCents:{increment:amount}}})
          if(!changed.count)throw Object.assign(new Error('Insufficient balance'),{status:400})
          const u=await tx.user.findUniqueOrThrow({where:{id},select:{walletCents:true}})
          const entry=await tx.ledgerEntry.create({data:{userId:id,type:cash?'TOPUP':'ADJUSTMENT',fundingSource:cash?'REAL_MONEY':'PROMOTIONAL',amountCents:amount,balanceAfterCents:u.walletCents,refType:'ADMIN',refId:admin.id,description:data.note!.trim()}})
          if(cash)await tx.payment.create({data:{userId:id,amountCents:amount,method:'CASH',status:'SUCCEEDED',purpose:'TOPUP',refId:entry.id,description:data.note!.trim()}})
        })
        await notify(id, 'payment', amount > 0 ? 'Credits added' : 'Credits adjusted', `${amount > 0 ? '+' : ''}${(amount / 100).toFixed(2)} USD ${data.note || ''}`)
        break
      }
      case 'set_commission': {
        if (!user.tutorProfile) return fail(400, 'User is not a tutor')
        const pct = Number(data.commissionPercent)
        if (!Number.isFinite(pct) || pct < 0 || pct > 90) return fail(400, 'Commission must be 0–90%')
        await db.tutorProfile.update({ where: { userId: id }, data: { commissionPercent: pct } })
        break
      }
      case 'change_role':
        if (!data.role) return fail(400, 'role is required')
        await db.user.update({ where: { id }, data: { role: data.role } })
        break
      default:
        return fail(400, 'Unknown action — use the applications endpoints for tutor approval')
    }
    await audit(admin.id, `ADMIN_${data.action.toUpperCase()}`, 'user', id, data as object)
    return ok({ ok: true })
  })
}
