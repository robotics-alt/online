/**
 * Shared game configuration: score caps and plausibility windows used for
 * server-side validation of solo results (anti-cheat baseline).
 * NOTE: realtime-service duplicates the caps for multiplayer matches — keep in sync.
 */

export interface SoloResultRule {
  maxScore: number
  minDurationSec: number // below this, the reported score must be small
  maxScorePerSec: number // plausibility: score cannot grow faster than this
}

/**
 * Caps are calibrated against the maximum scores the client games can
 * legitimately produce (verified against each game's scoring formula):
 *  - tic-tac-toe:  best-of-3, 100/round win      → max 200
 *  - memory-match: 800 − 40·miss − 2·s (min 100) → max 800
 *  - quick-math:   10 questions × ≤150           → max 1500
 *  - sliding-puzzle: 1000 − 4·moves − 2·s        → max 1000
 *  - word-scramble: 1000 + 10·50                 → max 1500
 *  - focus-tap:    10 rounds × ≤120              → max 1200
 * A small margin is kept above each true maximum so legitimate perfect runs
 * are never rejected.
 */
export const SOLO_RULES: Record<string, SoloResultRule> = {
  'tic-tac-toe': { maxScore: 300, minDurationSec: 4, maxScorePerSec: 60 },
  'memory-match': { maxScore: 900, minDurationSec: 6, maxScorePerSec: 120 },
  'quick-math': { maxScore: 1600, minDurationSec: 10, maxScorePerSec: 110 },
  'sliding-puzzle': { maxScore: 1100, minDurationSec: 8, maxScorePerSec: 130 },
  'word-scramble': { maxScore: 1600, minDurationSec: 10, maxScorePerSec: 90 },
  'focus-tap': { maxScore: 1300, minDurationSec: 6, maxScorePerSec: 130 },
}

export const ACHIEVEMENT_BY_GAME: Record<string, string> = {
  'memory-match': 'MEMORY_MASTER',
  'quick-math': 'MATH_CHAMPION',
  'tic-tac-toe': 'TTT_STRATEGIST',
  'sliding-puzzle': 'PUZZLE_SOLVER',
  'word-scramble': 'WORD_WIZARD',
  'focus-tap': 'FOCUS_STAR',
}

export function validateSoloResult(gameSlug: string, score: number, durationSec: number):
  { ok: true } | { ok: false; reason: string } {
  const rule = SOLO_RULES[gameSlug]
  if (!rule) return { ok: false, reason: 'Unknown game' }
  if (!Number.isFinite(score) || score < 0 || score > rule.maxScore) return { ok: false, reason: 'Score out of allowed range' }
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 3600) return { ok: false, reason: 'Duration out of allowed range' }
  if (durationSec < rule.minDurationSec && score > rule.maxScorePerSec * Math.max(1, durationSec)) {
    return { ok: false, reason: 'Result not plausible for this duration' }
  }
  if (score > rule.maxScorePerSec * durationSec + 120) return { ok: false, reason: 'Result not plausible for this duration' }
  return { ok: true }
}
