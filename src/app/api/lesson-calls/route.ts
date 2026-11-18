import { NextRequest } from 'next/server'
import { handle, body, requireFields, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { listLessonCalls, startLessonCall } from '@/lib/lesson-calls'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const calls = await listLessonCalls(user.id)
    return ok({ calls })
  })
}
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const data = await body<{ bookingId: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['bookingId'])
    return ok({ call: await startLessonCall(data.bookingId, user.id) })
  })
}
