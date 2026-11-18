import{NextRequest}from'next/server'
import{getAuthUser}from'@/lib/auth'
import{db}from'@/lib/db'
import{handle,ok}from'@/lib/api'
export async function GET(_req:NextRequest){return handle(async()=>{const price=await db.tutorProfile.aggregate({where:{status:'APPROVED',user:{status:'ACTIVE'}},_min:{hourlyRateCents:true}});const user=await getAuthUser(_req);return ok({minimumHourlyRateCents:price._min.hourlyRateCents,preferences:user?.role==='STUDENT'?await db.studentProfile.findUnique({where:{userId:user.id}}):null})})}
