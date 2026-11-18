import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'

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
