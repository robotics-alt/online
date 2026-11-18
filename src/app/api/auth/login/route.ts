import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail } from '@/lib/api'
import { verifyPassword, createSession, SESSION_COOKIE } from '@/lib/auth'
import { audit } from '@/lib/settings'

export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = await body<{ email: string; password: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['email', 'password'])
    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase().trim() } })
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      return fail(401, 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') return fail(403, 'This account has been suspended. Contact support.')

    const { token } = await createSession(user.id, req.headers.get('x-forwarded-for') ?? undefined, req.headers.get('user-agent') ?? undefined)
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      onboarded: user.onboarded,
    })
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    await audit(user.id, 'LOGIN', 'user', user.id)
    return res
  })
}
