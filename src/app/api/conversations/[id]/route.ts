import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser, signPayload } from '@/lib/auth'
import { notify } from '@/lib/settings'

async function getParticipant(conversationId: string, userId: string) {
  const convo = await db.conversation.findUnique({ where: { id: conversationId } })
  if (!convo) return null
  if (convo.participantAId !== userId && convo.participantBId !== userId) return null
  return convo
}

/** GET /api/conversations/:id — messages (marks incoming as read). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const convo = await getParticipant(id, user.id)
    if (!convo) return fail(404, 'Conversation not found')
    await db.message.updateMany({
      where: { conversationId: id, readAt: null, NOT: { senderId: user.id } },
      data: { readAt: new Date() },
    })
    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { sender: { select: { name: true, avatarUrl: true } },reactions:true },
    })
    const otherId = convo.participantAId === user.id ? convo.participantBId : convo.participantAId
    const other = await db.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, avatarUrl: true, role: true, country: true,lastSeenAt:true } })
    return ok({ messages: messages.reverse(), other, socketToken: signPayload({ conversationId: id, userId: user.id, name: user.name, role: user.role }, 2 * 3600000) })
  })
}

/** POST /api/conversations/:id — send a message. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser(req)
    const { id } = await params
    const data = await body<{ body?: string; attachmentUrl?: string;replyToId?:string }>(req)
    const convo = await getParticipant(id, user.id)
    if (!convo) return fail(404, 'Conversation not found')
    const text = typeof data.body==='string'?data.body.trim().slice(0,4000):''
    if (!text && !data.attachmentUrl) return fail(400, 'Message cannot be empty')
    const assetId=data.attachmentUrl?.match(/^\/api\/media\/([a-zA-Z0-9-]+)$/)?.[1]
    const asset=assetId?await db.mediaAsset.findFirst({where:{id:assetId,ownerId:user.id,scope:'conversation',scopeId:id}}):null
    if(data.attachmentUrl&&!asset)return fail(400,'Choose an attachment uploaded to this conversation by your own account')
    const reply=data.replyToId?await db.message.findFirst({where:{id:data.replyToId,conversationId:id},include:{sender:{select:{name:true}}}}):null
    if(data.replyToId&&!reply)return fail(400,'The message you are replying to is not in this conversation')

    const msg = await db.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: { conversationId:id,senderId:user.id,body:text,attachmentUrl:asset?'/api/media/'+asset.id:null,attachmentType:asset?.mime || null,replyToId:reply?.id,replyBody:reply?(reply.body || (reply.attachmentType?.startsWith('audio/')?'Voice message':'Image')).slice(0,300):null,replySenderName:reply?.sender.name },
        include:{reactions:true},
      })
      await tx.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } })
      return m
    })
    const otherId = convo.participantAId === user.id ? convo.participantBId : convo.participantAId
    await notify(otherId, 'message', `New message from ${user.name}`, text.slice(0,120)||(asset?.mime.startsWith('audio/')?'Voice message':'Image'), 'messages')
    return ok({ message: msg })
  })
}
