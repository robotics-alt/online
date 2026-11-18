import { NextRequest } from 'next/server'
import { handle, body, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getLessonCall, updateLessonCall } from '@/lib/lesson-calls'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const call = await getLessonCall((await params).id)
    if (!call || (call.studentId !== user.id && call.tutorId !== user.id)) return fail(404, 'Call not found')
    return ok({ call })
  })
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ action: 'accept' | 'decline' | 'end' }>(req)
    if (!['accept', 'decline', 'end'].includes(data.action)) return fail(400, 'Invalid call action')
    return ok({ call: await updateLessonCall((await params).id, user.id, data.action) })
  })
}
