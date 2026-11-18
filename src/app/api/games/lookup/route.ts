import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, body } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/**
 * POST /api/games/lookup — resolve a player by email for game invitations.
 * Returns only the minimal id needed to invite; enforces same-platform accounts.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req)
    const { email } = await body<{ email: string }>(req)
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Valid email required')
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, status: true },
    })
    if (!user || user.status !== 'ACTIVE') throw new Error('No active player found with that email')
    return ok({ userId: user.id })
  })
}
