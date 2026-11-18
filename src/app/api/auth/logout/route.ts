import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handle } from '@/lib/api'
import { getSessionToken, hashToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  return handle(async () => {
    const token = getSessionToken(req)
    if (token) {
      await db.session.deleteMany({ where: { token: hashToken(token) } })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
    return res
  })
}
