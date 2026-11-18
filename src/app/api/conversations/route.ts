import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { notify } from '@/lib/settings'

/** GET /api/conversations — conversation list with counterpart + last message + unread count. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const convos = await db.conversation.findMany({
      where: { OR: [{ participantAId: user.id }, { participantBId: user.id }] },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participantA: { select: { id: true, name: true, avatarUrl: true, role: true,lastSeenAt:true } },
        participantB: { select: { id: true, name: true, avatarUrl: true, role: true,lastSeenAt:true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    const other = (c: typeof convos[number]) => (c.participantAId === user.id ? c.participantB : c.participantA)
    const result = await Promise.all(convos.map(async (c) => {
      const unread = await db.message.count({
        where: { conversationId: c.id, readAt: null, NOT: { senderId: user.id } },
      })
      return {
        id: c.id,
        other: other(c),
        lastMessage: c.messages[0] ? { body:c.messages[0].body || (c.messages[0].attachmentType?.startsWith('audio/')?'Voice message':'Image'),createdAt:c.messages[0].createdAt,senderId:c.messages[0].senderId } : null,
        lastMessageAt: c.lastMessageAt,
        unread,
      }
    }))
    return ok({ conversations: result })
  })
}

/** POST /api/conversations — find or create a conversation with a user. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ userId: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['userId'])
    if (data.userId === user.id) return fail(400, 'You cannot message yourself')
    const target = await db.user.findUnique({ where: { id: data.userId }, select: { id: true, role: true, status: true } })
    if (!target || target.status !== 'ACTIVE') return fail(404, 'User not found')
    // Safeguarding: keep conversations between students and tutors only (plus staff)
    const allowedPairs: string[][] = [['STUDENT', 'TUTOR'], ['STUDENT', 'STUDENT'], ['TUTOR', 'TUTOR'], ['SUPPORT', 'STUDENT'], ['SUPPORT', 'TUTOR'], ['ADMIN', 'STUDENT'], ['ADMIN', 'TUTOR']]
    const roles = [user.role, target.role].sort().join('|').split('|')
    if (!allowedPairs.some((p) => p.includes(user.role) && p.includes(target.role)) && !allowedPairs.some((p) => p.includes(roles[0]) && p.includes(roles[1]))) {
      return fail(403, 'Messaging is not permitted between these roles')
    }
    const [aId, bId] = [user.id, data.userId].sort()
    const convo = await db.conversation.upsert({
      where: { participantAId_participantBId: { participantAId: aId, participantBId: bId } },
      update: {},
      create: { participantAId: aId, participantBId: bId },
    })
    return ok({ conversationId: convo.id })
  })
}
