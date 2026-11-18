import{settleGroup}from'@/lib/group-settlement'
import{NextRequest}from'next/server'
import{db}from'@/lib/db'
import{requireUser,verifyPayload}from'@/lib/auth'
import{body,handle,fail,ok}from'@/lib/api'
import{classroomAccess,removeAssets,type ClassroomContext}from'@/lib/media-storage'
export async function POST(req:NextRequest){return handle(async()=>{
 const user=await requireUser(req,['TUTOR']),data=await body<{token:string}>(req),context=verifyPayload<ClassroomContext&{role:string}>(data.token)
 if(!context||context.userId!==user.id||context.role!=='tutor'||!await classroomAccess(context,user.id))return fail(403,'Only this classroom teacher can end the lesson')
 await db.setting.upsert({where:{key:'classroom-ended:'+context.roomId},create:{key:'classroom-ended:'+context.roomId,value:new Date().toISOString()},update:{value:new Date().toISOString()}})
 if(context.groupClassId)await settleGroup(context.groupClassId)
 await removeAssets({scope:'classroom',scopeId:context.roomId})
 return ok({ok:true})
})}
