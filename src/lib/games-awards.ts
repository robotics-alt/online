import { db } from '@/lib/db'
import { ACHIEVEMENT_BY_GAME } from '@/lib/games-config'

/** Award achievements idempotently. Returns codes that were newly earned. */
export async function awardAchievements(userId: string, codes: string[], matchId?: string): Promise<string[]> {
  if (codes.length === 0) return []
  const defs = await db.gameAchievement.findMany({ where: { code: { in: codes } } })
  const earned: string[] = []
  for (const def of defs) {
    const existing = await db.userGameAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: def.id } },
    })
    if (!existing) {
      await db.userGameAchievement.create({ data: { userId, achievementId: def.id, matchId } })
      earned.push(def.code)
    }
  }
  return earned
}

/** Standard achievements derived from a finished match/round for a user. */
export async function achievementsForOutcome(opts: {
  userId: string
  gameSlug: string
  won: boolean
  played: boolean
  totalWins: number
  totalMatches: number
  bestScore?: number
  focusStarThreshold?: number
}): Promise<string[]> {
  const codes: string[] = []
  if (opts.played) codes.push('FIRST_PLAY')
  if (opts.won) {
    codes.push('FIRST_WIN')
    const specific = ACH_BY_SLUG[opts.gameSlug]
    if (specific) codes.push(specific)
    if (opts.totalWins >= 5) codes.push('FIVE_STREAK')
  }
  if (opts.totalMatches >= 10) codes.push('GOOD_SPORT')
  if (opts.gameSlug === 'focus-tap' && (opts.bestScore ?? 0) >= 900) codes.push('FOCUS_STAR')
  return codes
}

const ACH_BY_SLUG = ACHIEVEMENT_BY_GAME
