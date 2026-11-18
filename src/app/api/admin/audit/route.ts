import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/audit — security and activity logs. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { name: true, email: true, role: true } } },
    })
    return ok({ logs })
  })
}
