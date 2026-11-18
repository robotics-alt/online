/**
 * Brain Games & Activities seed — game catalog + achievements.
 * Run: bun prisma/seed-games.ts  (idempotent — safe to re-run)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const GAMES = [
  {
    slug: 'tic-tac-toe', name: 'Tic-Tac-Toe', icon: 'grid-3x3', category: 'BRAIN', accent: 'teal',
    tagline: 'Classic three-in-a-row against a smart AI or a friend.',
    description: 'Win three in a row before your opponent does. Play solo against the AI (easy, medium or hard) or challenge another player to a live duel with synchronized boards and best-of-three rounds.',
    modes: ["SOLO", "DUEL"], minPlayers: 1, maxPlayers: 2, difficulty: 'EASY,MEDIUM,HARD',
    ageGroups: '5-7,8-10,11-13,14-17,adults', avgMinutes: 3, engine: 'server', sortOrder: 1,
  },
  {
    slug: 'memory-match', name: 'Memory Match', icon: 'brain', category: 'BRAIN', accent: 'violet',
    tagline: 'Flip cards, find pairs, train your memory.',
    description: 'Flip cards two at a time and memorize their positions to find all matching pairs. Play solo against the clock, or take turns in a live multiplayer memory battle.',
    modes: ["SOLO", "DUEL"], minPlayers: 1, maxPlayers: 2, difficulty: 'EASY,MEDIUM,HARD',
    ageGroups: '5-7,8-10,11-13,14-17,adults', avgMinutes: 4, engine: 'server', sortOrder: 2,
  },
  {
    slug: 'quick-math', name: 'Quick Math Battle', icon: 'sigma', category: 'QUIZ', accent: 'amber',
    tagline: 'Race the clock and your opponent through fast arithmetic.',
    description: 'Solve arithmetic questions — addition, subtraction, multiplication, division, fractions, percentages and simple equations — as fast as you can. Everyone in the room gets the same questions; faster correct answers score more points.',
    modes: ["SOLO", "DUEL", "GROUP"], minPlayers: 1, maxPlayers: 8, difficulty: 'EASY,MEDIUM,HARD',
    ageGroups: '8-10,11-13,14-17,adults', avgMinutes: 5, engine: 'server', sortOrder: 3,
  },
  {
    slug: 'sliding-puzzle', name: 'Sliding Puzzle', icon: 'puzzle', category: 'BRAIN', accent: 'rose',
    tagline: 'Slide tiles to restore the picture or the number order.',
    description: 'Rearrange shuffled tiles on a grid by sliding them into the empty space until everything is back in order. Choose 3×3 or 4×4 and beat your own best time.',
    modes: ["SOLO"], minPlayers: 1, maxPlayers: 1, difficulty: 'EASY,MEDIUM,HARD',
    ageGroups: '5-7,8-10,11-13,14-17,adults', avgMinutes: 5, engine: 'solo', sortOrder: 4,
  },
  {
    slug: 'word-scramble', name: 'Word Scramble', icon: 'letters', category: 'QUIZ', accent: 'emerald',
    tagline: 'Unscramble letters into words — in five languages.',
    description: 'Rebuild shuffled words against the clock. Word banks are available in English, Arabic, Kurdish Sorani, Turkish and French, adapted to your interface language.',
    modes: ["SOLO"], minPlayers: 1, maxPlayers: 1, difficulty: 'EASY,MEDIUM,HARD',
    ageGroups: '8-10,11-13,14-17,adults', avgMinutes: 4, engine: 'solo', sortOrder: 5,
  },
  {
    slug: 'focus-tap', name: 'Focus Tap', icon: 'zap', category: 'BRAIN', accent: 'sky',
    tagline: 'A friendly reaction and attention challenge.',
    description: 'Tap the glowing target the moment it appears to test and train your reaction speed and focus over short rounds. Scores measure your game performance only — they are not measures of intelligence or health.',
    modes: ["SOLO"], minPlayers: 1, maxPlayers: 1, difficulty: 'EASY,MEDIUM,HARD',
    ageGroups: '5-7,8-10,11-13,14-17,adults', avgMinutes: 2, engine: 'solo', sortOrder: 6,
  },
  {
    slug: 'guided-breathing', name: 'Guided Breathing', icon: 'wind', category: 'RELAX', accent: 'cyan',
    tagline: 'Follow a calm animated circle. One, two or five minutes.',
    description: 'Take a peaceful break with a slow animated breathing circle. Choose a one-, two- or five-minute session — finish early any time, nothing is forced and nothing is scored.',
    modes: ["SOLO"], minPlayers: 1, maxPlayers: 1, difficulty: 'EASY',
    ageGroups: '5-7,8-10,11-13,14-17,adults', avgMinutes: 2, engine: 'solo', sortOrder: 7,
  },
  {
    slug: 'free-draw', name: 'Free Draw', icon: 'palette', category: 'RELAX', accent: 'fuchsia',
    tagline: 'A friendly canvas — draw, doodle and save your art.',
    description: 'Relax with a simple drawing canvas: pencil, colors, eraser, undo and clear. Save your artwork to your gallery and download it any time.',
    modes: ["SOLO"], minPlayers: 1, maxPlayers: 1, difficulty: 'EASY',
    ageGroups: '5-7,8-10,11-13,14-17,adults', avgMinutes: 10, engine: 'solo', sortOrder: 8,
  },
]

const ACHIEVEMENTS = [
  { code: 'FIRST_PLAY', name: 'Game On', description: 'Play your first game in the Game Center.', icon: 'play', category: 'GENERAL' },
  { code: 'FIRST_WIN', name: 'First Victory', description: 'Win your first competitive match.', icon: 'trophy', category: 'GENERAL' },
  { code: 'MEMORY_MASTER', name: 'Memory Master', description: 'Win a Memory Match duel or finish a solo board with no misses.', icon: 'brain', category: 'BRAIN' },
  { code: 'MATH_CHAMPION', name: 'Math Champion', description: 'Win a Quick Math Battle match.', icon: 'sigma', category: 'QUIZ' },
  { code: 'TTT_STRATEGIST', name: 'Tic-Tac-Toe Strategist', description: 'Win a Tic-Tac-Toe duel (or beat hard AI).', icon: 'grid-3x3', category: 'BRAIN' },
  { code: 'PUZZLE_SOLVER', name: 'Puzzle Solver', description: 'Complete any sliding puzzle.', icon: 'puzzle', category: 'BRAIN' },
  { code: 'WORD_WIZARD', name: 'Word Wizard', description: 'Solve 10 word scrambles in one session.', icon: 'letters', category: 'QUIZ' },
  { code: 'FOCUS_STAR', name: 'Focus Star', description: 'Score over 900 points in Focus Tap.', icon: 'zap', category: 'BRAIN' },
  { code: 'CREATIVE_THINKER', name: 'Creative Thinker', description: 'Save your first creative activity project.', icon: 'palette', category: 'RELAX' },
  { code: 'CALM_MIND', name: 'Calm Mind', description: 'Complete a full guided breathing session.', icon: 'wind', category: 'RELAX' },
  { code: 'FIVE_STREAK', name: 'On a Roll', description: 'Win 5 matches in total.', icon: 'flame', category: 'GENERAL' },
  { code: 'GOOD_SPORT', name: 'Good Sport', description: 'Complete 10 matches of any kind.', icon: 'handshake', category: 'GENERAL' },
]

async function main() {
  console.log('🎮 Seeding game catalog…')
  for (const g of GAMES) {
    await db.game.upsert({
      where: { slug: g.slug },
      create: { ...g, modes: JSON.stringify(g.modes) },
      update: { ...g, modes: JSON.stringify(g.modes) },
    })
  }
  for (const a of ACHIEVEMENTS) {
    await db.gameAchievement.upsert({ where: { code: a.code }, create: a, update: a })
  }
  console.log(`   ${GAMES.length} games, ${ACHIEVEMENTS.length} achievements ready.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
