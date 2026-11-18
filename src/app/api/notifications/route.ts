import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/** GET /api/notifications — recent in-app notifications. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unread=await db.notification.count({where:{userId:user.id,readAt:null}})
    return ok({ notifications, unread })
  })
}

/** POST /api/notifications/read — mark all or specific notifications read. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ ids?: string[] }>(req).catch(() => ({ ids: undefined }))
    await db.notification.updateMany({
      where: { userId: user.id, ...(data.ids?.length ? { id: { in: data.ids } } : {}) },
      data: { readAt: new Date() },
    })
    return ok({ ok: true })
  })
}
