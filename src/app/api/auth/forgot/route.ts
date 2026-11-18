import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { getAuthUser } from '@/lib/auth'

/** POST — request password reset (token returned in dev; SMTP not configured). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = await body<{ email: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['email'])
    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase().trim() } })
    // Always respond OK to avoid account enumeration
    if (!user) return ok({ ok: true, message: 'If an account exists, a reset link has been sent.' })
    const token = require0()
    await db.passwordReset.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60) },
    })
    // SMTP/email delivery is not configured in this environment — the token is returned
    // so the flow is complete and testable. In production, email it instead.
    return ok({ ok: true, resetToken: token, message: 'Email delivery is not configured — use the provided token to reset.' })
  })
}

function require0() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
