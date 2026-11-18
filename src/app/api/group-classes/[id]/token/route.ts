import{NextRequest}from'next/server'
import{db}from'@/lib/db'
import{requireUser,signPayload}from'@/lib/auth'
import{handle,fail,ok}from'@/lib/api'
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
 const user=await requireUser(req),group=await db.groupClass.findUnique({where:{id:(await params).id},include:{enrollments:{where:{status:'CONFIRMED'}}}})
 if(!group||group.status!=='PUBLISHED')return fail(404,'Classroom not found')
 const teacher=group.tutorId===user.id
 if(!teacher&&!group.enrollments.some(item=>item.studentId===user.id))return fail(403,'An approved place in this class is required')
 if(group.enrollments.length<group.minStudents)return fail(423,`This class needs at least ${group.minStudents} confirmed students before opening`)
 const now=Date.now(),end=+group.startUtc+group.durationMin*60000
 if(now<+group.startUtc-15*60000)return fail(423,'The group classroom opens 15 minutes before the class')
 if(now>end+45*60000)return fail(423,'This class has ended')
 if(await db.setting.findUnique({where:{key:'classroom-ended:'+group.roomId}}))return fail(410,'This class has ended')
 const role=teacher?'tutor':'student',token=signPayload({bookingId:'group:'+group.id,groupClassId:group.id,roomId:group.roomId,userId:user.id,name:user.name,role},3*3600000)
 return ok({token,roomId:group.roomId,role,startsAt:group.startUtc.toISOString(),endsAt:new Date(end).toISOString(),lessonLabel:group.title,groupClassId:group.id,call:null})
})}
