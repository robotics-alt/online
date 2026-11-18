import{NextRequest}from'next/server'
import{requireAdmin}from'@/lib/auth'
import{handle,ok,fail}from'@/lib/api'
import{db}from'@/lib/db'
import{financialAccount}from'@/lib/admin-finance'
export async function GET(req:NextRequest){return handle(async()=>{await requireAdmin(req);const id=req.nextUrl.searchParams.get('id')||undefined;const user=id?await db.user.findUnique({where:{id},select:{id:true,name:true,email:true,role:true,avatarUrl:true,country:true,timezone:true,walletCents:true,status:true,createdAt:true,tutorProfile:{select:{id:true,headline:true,commissionPercent:true,status:true}}}}):null;if(id&&!user)return fail(404,'User not found');const result=await financialAccount(id);const ids=[...new Set(result.groups.map(g=>g.group.tutorId))];const teachers=await db.user.findMany({where:{id:{in:ids}},select:{id:true,name:true}});for(const p of result.payments)if(p.lesson&&!p.lesson.teacher)p.lesson.teacher=teachers.find(t=>t.id===p.lesson!.teacherId)?.name||'Teacher';return ok({user,...result})})}
