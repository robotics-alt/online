import {NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {requireUser} from '@/lib/auth'
import {body,handle,fail,ok} from '@/lib/api'
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
  const user=await requireUser(req),id=(await params).id,data=await body<{messageId:string;emoji:string}>(req)
  const convo=await db.conversation.findUnique({where:{id}})
  if(!convo||![convo.participantAId,convo.participantBId].includes(user.id))return fail(404,'Conversation not found')
  if(!['❤️','👍','😂','🎉','👏','😮','😢','🔥'].includes(data.emoji))return fail(400,'Choose a supported reaction')
  const message=await db.message.findFirst({where:{id:data.messageId,conversationId:id}})
  if(!message)return fail(404,'Message not found')
  const existing=await db.messageReaction.findUnique({where:{messageId_userId:{messageId:message.id,userId:user.id}}})
  if(existing?.emoji===data.emoji)await db.messageReaction.delete({where:{id:existing.id}})
  else await db.messageReaction.upsert({where:{messageId_userId:{messageId:message.id,userId:user.id}},create:{messageId:message.id,userId:user.id,emoji:data.emoji},update:{emoji:data.emoji}})
  return ok({message:await db.message.findUnique({where:{id:message.id},include:{reactions:true}})})
})}
