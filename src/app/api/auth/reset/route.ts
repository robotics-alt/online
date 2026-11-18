import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail } from '@/lib/api'
import { hashPassword, createSession, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = await body<{ token: string; password: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['token', 'password'])
    if (data.password.length < 8) return fail(400, 'Password must be at least 8 characters')
    const reset = await db.passwordReset.findUnique({ where: { token: data.token } })
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return fail(400, 'This reset link is invalid or has expired')
    }
    await db.$transaction([
      db.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(data.password) } }),
      db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      db.session.deleteMany({ where: { userId: reset.userId } }),
    ])
    const { token } = await createSession(reset.userId)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    return res
  })
}
