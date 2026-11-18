import {NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {handle,body,ok,fail} from '@/lib/api'
import {requireUser,hashPassword} from '@/lib/auth'
import {audit,notify} from '@/lib/settings'
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(async()=>{const admin=await requireUser(req,['ADMIN']);const{id}=await params;const d=await body<{password:string}>(req);if(typeof d.password!=='string'||d.password.length<12||d.password.length>128)return fail(400,'Use a password with 12–128 characters');const user=await db.user.findUnique({where:{id},select:{role:true}});if(!user)return fail(404,'User not found');if(user.role==='ADMIN'&&admin.id!==id)return fail(403,'Other administrators must reset their own password');await db.$transaction([db.user.update({where:{id},data:{passwordHash:hashPassword(d.password)}}),db.session.deleteMany({where:{userId:id}})]);await audit(admin.id,'PASSWORD_RESET','user',id);await notify(id,'account','Password reset','An administrator reset your password. Please sign in again.');return ok({ok:true})})}
