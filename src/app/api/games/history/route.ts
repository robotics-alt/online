import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/** GET /api/games/history — my matches, aggregated stats and achievements. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)

    const players = await db.gameMatchPlayer.findMany({
      where: { userId: user.id },
      orderBy: { id: 'desc' },
      take: 60,
    })
    const matchIds = [...new Set(players.map((p) => p.matchId))]
    const matches = await db.gameMatch.findMany({
      where: { id: { in: matchIds } },
      include: { game: { select: { slug: true, name: true, icon: true, accent: true } }, players: true },
      orderBy: { startedAt: 'desc' },
    })
    const rows = players
      .map((p) => {
        const m = matches.find((mm) => mm.id === p.matchId)
        if (!m) return null
        return {
          id: m.id, game: m.game, mode: m.mode, difficulty: m.difficulty, status: m.status,
          startedAt: m.startedAt, durationSec: m.durationSec, myScore: p.score, myResult: p.result,
          players: m.players.map((x) => ({ name: x.name, score: x.score, result: x.result, userId: x.userId })),
        }
      })
      .filter(Boolean)

    const wins = players.filter((p) => p.result === 'WIN').length
    const plays = players.length
    const byGame = new Map<string, number>()
    for (const row of rows) {
      const slug = row?.game.slug ?? ''
      const prev = byGame.get(slug) ?? 0
      byGame.set(slug, Math.max(prev, row?.myScore ?? 0))
    }

    const earned = await db.userGameAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    })

    return ok({
      matches: rows,
      stats: { plays, wins, winRate: plays ? Math.round((wins / plays) * 100) : 0, bestByGame: Object.fromEntries(byGame) },
      achievements: earned.map((e) => ({
        code: e.achievement.code, name: e.achievement.name, description: e.achievement.description,
        icon: e.achievement.icon, category: e.achievement.category, earnedAt: e.earnedAt,
      })),
    })
  })
}
