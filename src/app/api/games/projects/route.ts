import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok, body } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/** GET /api/games/projects — my saved creative projects (gallery). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const projects = await db.creativeProject.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 24,
    })
    return ok({ projects })
  })
}

/** POST /api/games/projects — save a creative activity project. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const { kind, title, data } = await body<{ kind?: string; title?: string; data?: string }>(req)
    if (!data || data.length > 2_000_000) throw new Error('Project data too large or missing')
    const project = await db.creativeProject.create({
      data: { userId: user.id, kind: kind ?? 'DRAWING', title: (title ?? 'Untitled').slice(0, 80), data },
    })
    // Creative Thinker achievement on first save
    const def = await db.gameAchievement.findUnique({ where: { code: 'CREATIVE_THINKER' } })
    let earned: string[] = []
    if (def) {
      const existing = await db.userGameAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: def.id } },
      })
      if (!existing) {
        await db.userGameAchievement.create({ data: { userId: user.id, achievementId: def.id } })
        earned = [def.name]
      }
    }
    return ok({ project: { id: project.id }, earned })
  })
}
