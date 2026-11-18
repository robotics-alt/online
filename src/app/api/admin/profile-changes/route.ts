import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin,ApiError } from '@/lib/auth'
import { body,handle,fail,ok } from '@/lib/api'
import { audit,notify } from '@/lib/settings'
export async function GET(req:NextRequest){return handle(async()=>{
  await requireAdmin(req)
  const changes=await db.tutorProfileChange.findMany({where:{status:'PENDING'},orderBy:{createdAt:'asc'}})
  const profiles=await db.tutorProfile.findMany({where:{id:{in:changes.map(item=>item.tutorId)}},include:{user:{select:{name:true,email:true}}}})
  return ok({changes:changes.map(change=>({...change,profile:profiles.find(profile=>profile.id===change.tutorId)}))})
})}
export async function POST(req:NextRequest){return handle(async()=>{
  const admin=await requireAdmin(req),data=await body<{id:string;action:string;reason?:string}>(req)
  if(!['approve','reject'].includes(data.action))return fail(400,'Choose approve or reject')
  const row=await db.tutorProfileChange.findUnique({where:{id:data.id}})
  if(!row||row.status!=='PENDING')return fail(409,'This change has already been reviewed')
  await db.$transaction(async tx=>{
    const profile=await tx.tutorProfile.findUnique({where:{id:row.tutorId}})
    if(!profile||profile.status!=='APPROVED')throw new ApiError(409,'The teacher profile is not currently approved')
    const changed=await tx.tutorProfileChange.updateMany({where:{id:row.id,status:'PENDING'},data:{status:data.action==='approve'?'APPROVED':'REJECTED',reviewedAt:new Date(),reviewedBy:admin.id,reason:data.reason?.slice(0,1000)||null}})
    if(!changed.count)throw new ApiError(409,'This change has already been reviewed')
    if(data.action==='approve'){
      const{subjectIds,...fields}=JSON.parse(row.patchJson),allowed=['headline','about','experience','education','certifications','methodology','motivation','languages','nativeLanguage','videoUrl','yearsExperience','languageItems','experienceItems','skillItems']
      if(Object.keys(fields).some(key=>!allowed.includes(key)))throw new ApiError(400,'Invalid profile change')
      await tx.tutorProfile.update({where:{id:row.tutorId},data:fields})
      if(subjectIds){await tx.tutorSubject.deleteMany({where:{tutorId:row.tutorId}});await tx.tutorSubject.createMany({data:subjectIds.map((subjectId:string)=>({tutorId:row.tutorId,subjectId}))})}
      if(fields.languageItems)await tx.user.update({where:{id:row.userId},data:{spokenLanguages:fields.languageItems}})
    }
  })
  await notify(row.userId,'tutor',data.action==='approve'?'Profile changes approved':'Profile changes need attention',data.reason || (data.action==='approve'?'Your approved professional details are now visible to students.':'Your existing approved profile remains unchanged.'),'profile')
  await audit(admin.id,'PROFILE_CHANGE_'+data.action.toUpperCase(),'tutorProfileChange',row.id)
  return ok({ok:true})
})}
