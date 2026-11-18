import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, ok, fail } from '@/lib/api'
import { getAuthUser } from '@/lib/auth'

/** POST /api/newsletter — subscribe an email. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = await body<{ email: string }>(req)
    const email = (data.email ?? '').toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'Invalid email')
    await db.newsletterSubscriber.upsert({ where: { email }, update: {}, create: { email } })
    const user = await getAuthUser(req)
    if (user) {
      await db.notification.create({
        data: { userId: user.id, type: 'marketing', title: 'Welcome to the newsletter', body: 'Learning tips and offers are on the way.' },
      })
    }
    return ok({ ok: true })
  })
}
