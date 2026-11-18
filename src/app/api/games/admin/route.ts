import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'

/** GET /api/games/admin — usage analytics + recent matches for the admin console. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const [totalMatches, weekMatches, activeRooms, achievementCount, matches, allPlayers, matchGame, games] = await Promise.all([
      db.gameMatch.count(),
      db.gameMatch.count({ where: { startedAt: { gte: since } } }),
      db.gameRoom.count({ where: { status: { in: ['LOBBY', 'PLAYING'] } } }),
      db.userGameAchievement.count(),
      db.gameMatch.findMany({
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: {
          game: { select: { name: true, slug: true } },
          players: { select: { name: true, score: true, result: true } },
        },
      }),
      db.gameMatchPlayer.findMany({ select: { matchId: true } }),
      db.gameMatch.findMany({ select: { id: true, gameId: true } }),
      db.game.findMany({ orderBy: { sortOrder: 'asc' } }),
    ])

    const matchById = new Map(matchGame.map((m) => [m.id, m.gameId]))
    const gameIdCounts = new Map<string, number>()
    for (const p of allPlayers) {
      const gid = matchById.get(p.matchId)
      if (gid) gameIdCounts.set(gid, (gameIdCounts.get(gid) ?? 0) + 1)
    }
    const popularity = games
      .map((g) => ({ slug: g.slug, name: g.name, plays: gameIdCounts.get(g.id) ?? 0 }))
      .sort((a, b) => b.plays - a.plays)

    return ok({
      stats: { totalMatches, weekMatches, activeRooms, achievementCount },
      games: games.map((g) => ({ id: g.id, slug: g.slug, name: g.name, category: g.category, active: g.active, maxPlayers: g.maxPlayers })),
      matches: matches.map((m) => ({
        id: m.id, game: m.game.name, mode: m.mode, difficulty: m.difficulty, status: m.status,
        startedAt: m.startedAt, durationSec: m.durationSec,
        players: m.players.map((p) => ({ name: p.name, score: p.score, result: p.result })),
      })),
      popularity,
    })
  })
}
