import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, body } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/**
 * POST /api/games/open-room — create a multiplayer room without a direct
 * invite. Anyone with the room code can join from the Game Center.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR', 'ADMIN'])
    const { gameSlug, difficulty } = await body<{ gameSlug?: string; difficulty?: string }>(req)
    if (!gameSlug) throw new Error('gameSlug required')
    const game = await db.game.findUnique({ where: { slug: gameSlug } })
    if (!game || !game.active) throw new Error('Game not found or disabled')
    if (!game.modes.includes('DUEL') && !game.modes.includes('GROUP')) throw new Error('This game does not support multiplayer yet')

    let code = ''
    for (let i = 0; i < 5; i++) {
      code = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
      if (!(await db.gameRoom.findUnique({ where: { code } }))) break
    }
    await db.gameRoom.create({
      data: {
        code, gameId: game.id, hostUserId: user.id,
        mode: game.modes.includes('GROUP') ? 'GROUP' : 'DUEL',
        difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty ?? '') ? difficulty! : 'MEDIUM',
        maxPlayers: game.modes.includes('GROUP') ? Math.min(8, game.maxPlayers) : 2,
        timeLimitSec: 300,
      },
    })
    return ok({ roomCode: code })
  })
}
