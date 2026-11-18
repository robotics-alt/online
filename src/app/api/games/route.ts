import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, body } from '@/lib/api'
import { requireUser, requireAdmin, signPayload, ApiError } from '@/lib/auth'
import { validateSoloResult, ACHIEVEMENT_BY_GAME } from '@/lib/games-config'
import { awardAchievements, achievementsForOutcome } from '@/lib/games-awards'

function serializeGame(g: {
  id: string; slug: string; name: string; tagline: string; description: string; icon: string
  category: string; modes: string; minPlayers: number; maxPlayers: number; difficulty: string
  ageGroups: string; avgMinutes: number; accent: string; engine: string; active: boolean
}) {
  return {
    ...g,
    modes: JSON.parse(g.modes) as string[],
    difficulty: g.difficulty.split(','),
    ageGroups: g.ageGroups.split(','),
  }
}

/** GET /api/games — public catalog of active games (admins may pass ?all=1). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const all = req.nextUrl.searchParams.get('all') === '1'
    if (all) await requireAdmin(req)
    const games = await db.game.findMany({
      where: all ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return ok({ games: games.map(serializeGame) })
  })
}

/**
 * POST /api/games — issue a short-lived signed token for the realtime game
 * service, or record a solo result (action-based dispatch).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = await body<{ action?: string }>(req)
    const user = await requireUser(req)

    if (data.action === 'token') {
      const token = signPayload(
        { userId: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
        1000 * 60 * 60 * 2,
      )
      return ok({ token })
    }

    if (data.action === 'solo-result') {
      if (user.role === 'STUDENT') throw new ApiError(403, 'Your teacher must invite you to a game')
      const { gameSlug, difficulty, score, durationSec, stats } = data as {
        gameSlug?: string; difficulty?: string; score?: number; durationSec?: number; stats?: Record<string, unknown>
      }
      if (!gameSlug) throw new ApiError(400, 'gameSlug required')
      const game = await db.game.findUnique({ where: { slug: gameSlug } })
      if (!game || !game.active) throw new ApiError(404, 'Game not found or disabled')
      const s = Math.round(Number(score ?? 0))
      const d = Math.round(Number(durationSec ?? 0))
      const verdict = validateSoloResult(game.slug, s, d)
      if (!verdict.ok) throw new ApiError(422, `Result rejected: ${verdict.reason}`)

      const match = await db.gameMatch.create({
        data: {
          gameId: game.id, mode: 'SOLO', difficulty: difficulty ?? 'MEDIUM', status: 'FINISHED',
          winnerUserId: user.id, durationSec: d, endedAt: new Date(),
          players: { create: { userId: user.id, name: user.name, score: s, result: 'WIN', stats: JSON.stringify(stats ?? {}) } },
        },
      })

      const totalMatches = await db.gameMatchPlayer.count({ where: { userId: user.id } })
      const totalWins = await db.gameMatchPlayer.count({ where: { userId: user.id, result: 'WIN' } })
      const codes = await achievementsForOutcome({
        userId: user.id, gameSlug: game.slug, played: true,
        won: true, // solo completion counts as a win over the puzzle/clock
        totalWins, totalMatches,
        bestScore: s,
      })
      // Game-specific mastery conditions
      if (game.slug === 'memory-match' && (stats as { misses?: number } | undefined)?.misses === 0) codes.push('MEMORY_MASTER')
      if (game.slug === 'tic-tac-toe' && difficulty === 'HARD') codes.push(ACHIEVEMENT_BY_GAME['tic-tac-toe'])
      const earned = await awardAchievements(user.id, codes, match.id)

      return ok({ matchId: match.id, score: s, earned })
    }

    throw new ApiError(400, 'Unknown action')
  })
}

/** PATCH /api/games — admin: enable/disable a game. */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const { gameId, active,name,tagline,description,icon,sortOrder } = await body<{ gameId: string; active?: boolean;name?:string;tagline?:string;description?:string;icon?:string;sortOrder?:number }>(req)
    if(name!==undefined&&(!name.trim()||name.length>100)||tagline!==undefined&&tagline.length>200||description!==undefined&&description.length>4000||sortOrder!==undefined&&!Number.isInteger(sortOrder))throw new ApiError(400,'Enter a name, short tagline and description up to 4000 characters')
    const game = await db.game.update({ where: { id: gameId }, data: { ...(typeof active==='boolean'?{active}:{}),...(name!==undefined?{name:name.trim()}:{}),...(tagline!==undefined?{tagline}:{}),...(description!==undefined?{description}:{}),...(icon!==undefined?{icon:icon.slice(0,60)}:{}),...(sortOrder!==undefined?{sortOrder}:{}) } })
    return ok({ game: serializeGame(game) })
  })
}
