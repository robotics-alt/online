import {NextRequest} from 'next/server'
import {requireUser} from '@/lib/auth'
import {db} from '@/lib/db'
import {handle,ok} from '@/lib/api'
export async function POST(req:NextRequest){return handle(async()=>{const user=await requireUser(req);await db.user.update({where:{id:user.id},data:{lastSeenAt:new Date()}});return ok({ok:true})})}
