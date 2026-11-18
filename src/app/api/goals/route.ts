import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/** GET /api/goals — student's learning goals. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const goals = await db.learningGoal.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { tutor: { select: { user: { select: { name: true } } } } },
    })
    return ok({ goals: goals.map((g) => ({ ...g, tutorName: g.tutor?.user.name ?? null })) })
  })
}

/** POST /api/goals — create a learning goal. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['STUDENT'])
    const data = await body<{ title: string; targetDate?: string; tutorId?: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['title'])
    const goal = await db.learningGoal.create({
      data: {
        studentId: user.id,
        title: data.title.slice(0, 200),
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        tutorId: data.tutorId ?? null,
      },
    })
    return ok({ goal })
  })
}

/** PATCH — mark a goal achieved. */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ goalId: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['goalId'])
    await db.learningGoal.updateMany({ where: { id: data.goalId, studentId: user.id }, data: { status: 'ACHIEVED' } })
    return ok({ ok: true })
  })
}
