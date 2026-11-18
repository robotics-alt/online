import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { notify, audit } from '@/lib/settings'
import type { Prisma, Role } from '@prisma/client'

/** GET /api/admin/users — searchable, filterable user list. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim() ?? ''
    const role = sp.get('role') ?? ''
    const status = sp.get('status') ?? ''
    const where: Prisma.UserWhereInput = {
      ...(role ? { role: role as Role } : {}),
      ...(status ? { status: status as 'ACTIVE' | 'SUSPENDED' } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    }
    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, name: true, email: true, role: true, status: true, country: true,
        createdAt: true, walletCents: true, emailVerified: true,
        tutorProfile: { select: { id: true, status: true, headline: true, commissionPercent: true, lessonsCompleted: true } },
      },
    })
    return ok({ users })
  })
}
