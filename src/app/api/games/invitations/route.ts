import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, body } from '@/lib/api'
import { requireUser, ApiError } from '@/lib/auth'

const INVITE_TTL_MS = 1000 * 60 * 15

/** GET /api/games/invitations — my pending incoming invitations. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const invitations = await db.gameInvitation.findMany({
      where: { toUserId: user.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      include: {
        room: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const gameIds = invitations.map((i) => i.gameId)
    const games = await db.game.findMany({ where: { id: { in: gameIds } }, select: { id: true, name: true, icon: true, slug: true } })
    const fromIds = invitations.map((i) => i.fromUserId)
    const users = await db.user.findMany({ where: { id: { in: fromIds } }, select: { id: true, name: true, role: true } })
    return ok({
      invitations: invitations.map((i) => ({
        id: i.id, roomCode: i.room.code, createdAt: i.createdAt, expiresAt: i.expiresAt,
        game: games.find((g) => g.id === i.gameId) ?? null,
        from: users.find((u) => u.id === i.fromUserId) ?? null,
      })),
    })
  })
}

/**
 * POST /api/games/invitations — create a room + invitation, or respond to one.
 * body: { action: 'create', toUserId, gameSlug, mode?, difficulty?, timeLimitSec?, message? }
 *     | { action: 'accept', invitationId } → { roomCode }
 *     | { action: 'decline', invitationId }
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{
      action: string; toUserId?: string; gameSlug?: string; mode?: string
      difficulty?: string; timeLimitSec?: number; invitationId?: string
    }>(req)

    if (data.action === 'create') {
      if (user.role === 'STUDENT') throw new ApiError(403, 'Students can play games only when invited by a teacher')
      if (!data.toUserId || !data.gameSlug) throw new ApiError(400, 'toUserId and gameSlug are required')
      const game = await db.game.findUnique({ where: { slug: data.gameSlug } })
      if (!game || !game.active) throw new ApiError(404, 'Game not found or disabled')
      if (!game.modes.includes('DUEL')) throw new ApiError(400, `${game.name} does not support duels yet`)
      const target = await db.user.findUnique({ where: { id: data.toUserId } })
      if (!target) throw new ApiError(404, 'Player not found — check the email address')
      if (target.role === 'STUDENT' && user.role !== 'TUTOR') throw new ApiError(403, 'Only teachers can invite students to games')
      if (target.status !== 'ACTIVE') throw new ApiError(400, 'Player cannot receive invitations')

      // Generate a short unique room code
      let code = ''
      for (let i = 0; i < 5; i++) {
        code = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
        if (!(await db.gameRoom.findUnique({ where: { code } }))) break
      }
      const room = await db.gameRoom.create({
        data: {
          code, gameId: game.id, hostUserId: user.id, mode: 'DUEL',
          difficulty: data.difficulty ?? 'MEDIUM', maxPlayers: 2,
          timeLimitSec: Math.min(900, Math.max(60, data.timeLimitSec ?? 300)),
        },
      })
      const invitation = await db.gameInvitation.create({
        data: {
          roomId: room.id, fromUserId: user.id, toUserId: target.id, gameId: game.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      })
      return ok({ invitationId: invitation.id, roomCode: code })
    }

    if (data.action === 'accept') {
      if (!data.invitationId) throw new ApiError(400, 'invitationId required')
      const invitation = await db.gameInvitation.findUnique({ where: { id: data.invitationId }, include: { room: true } })
      if (!invitation || invitation.toUserId !== user.id) throw new ApiError(404, 'Invitation not found')
      if (user.role === 'STUDENT') {
        const inviter = await db.user.findUnique({ where: { id: invitation.fromUserId }, select: { role: true } })
        if (inviter?.role !== 'TUTOR') throw new ApiError(403, 'Students can accept games only from a teacher')
      }
      if (invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) throw new ApiError(410, 'Invitation expired')
      if (invitation.room.status !== 'LOBBY') throw new ApiError(409, 'This game has already started')
      await db.gameInvitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED' } })
      return ok({ roomCode: invitation.room.code })
    }

    if (data.action === 'decline') {
      if (!data.invitationId) throw new ApiError(400, 'invitationId required')
      const invitation = await db.gameInvitation.findUnique({ where: { id: data.invitationId } })
      if (!invitation || invitation.toUserId !== user.id) throw new ApiError(404, 'Invitation not found')
      await db.gameInvitation.update({ where: { id: invitation.id }, data: { status: 'DECLINED' } })
      return ok({ ok: true })
    }

    throw new ApiError(400, 'Unknown action')
  })
}
