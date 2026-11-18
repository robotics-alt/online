import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle,body,fail,ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { audit,notify } from '@/lib/settings'
import { normalizeLanguages,normalizeExperiences,normalizeSkills,readList,type ExperienceItem,type SkillItem } from '@/lib/profile-data'
const include={subjects:{include:{subject:true}},verifications:true,rules:{orderBy:[{weekday:'asc' as const},{startMin:'asc' as const}]},exceptions:{orderBy:{date:'asc' as const}},user:{select:{name:true,email:true,avatarUrl:true,country:true,timezone:true,spokenLanguages:true}}}
export async function GET(req:NextRequest){return handle(async()=>{
  const user=await requireUser(req,['TUTOR']),profile=await db.tutorProfile.findUnique({where:{userId:user.id},include})
  if(!profile)return fail(404,'Tutor profile not found')
  const pendingChange=await db.tutorProfileChange.findFirst({where:{tutorId:profile.id},orderBy:{createdAt:'desc'}})
  return ok({profile,pendingChange})
})}
export async function PUT(req:NextRequest){return handle(async()=>{
  const user=await requireUser(req,['TUTOR']),data=await body<Record<string,unknown>>(req),profile=await db.tutorProfile.findUnique({where:{userId:user.id},include:{subjects:true,rules:true}})
  if(!profile)return fail(404,'Tutor profile not found')
  const patch:Record<string,unknown>={},immediate:Record<string,unknown>={},account:Record<string,unknown>={}
  if(typeof data.headline==='string'&&data.headline.trim().length>160)return fail(400,'Keep your professional headline within 160 characters')
  if(data.action==='submit'&&['APPROVED','PENDING'].includes(profile.status))return fail(400,'Application already submitted')
  for(const key of ['headline','about','experience','education','certifications','methodology','motivation','languages','nativeLanguage','videoUrl'] as const)if(data[key]!==undefined){if(typeof data[key]!=='string'||String(data[key]).length>10000)return fail(400,'Profile text is too long or invalid');patch[key]=String(data[key]).trim()}
  try{
    if(data.languageItems!==undefined){const items=normalizeLanguages(data.languageItems);patch.languageItems=JSON.stringify(items);patch.languages=items.map(item=>item.name).join(', ')}
    if(data.experienceItems!==undefined){const items=normalizeExperiences(data.experienceItems);patch.experienceItems=JSON.stringify(items);patch.yearsExperience=items.length?Math.floor(Math.max(...items.map(item=>item.years))):0;patch.experience=items.map(item=>`${item.title} · ${item.organization} · ${item.program} · ${item.years} years`).join('\n')}
    if(data.skillItems!==undefined)patch.skillItems=JSON.stringify(normalizeSkills(data.skillItems))
  }catch(error){return fail(400,(error as Error).message)}
  if(data.yearsExperience!==undefined){if(!Number.isFinite(data.yearsExperience)||Number(data.yearsExperience)<0||Number(data.yearsExperience)>60)return fail(400,'Choose valid years of experience');if(data.experienceItems===undefined)patch.yearsExperience=Math.floor(Number(data.yearsExperience))}
  for(const [key,target] of [['hourlyRate','hourlyRateCents'],['trialRate','trialRateCents']])if(data[key]!==undefined){const amount=Number(data[key]);if(!Number.isFinite(amount)||amount<0||amount>1000)return fail(400,'Choose a valid lesson rate');immediate[target]=Math.max(key==='hourlyRate'?100:0,Math.round(amount*100))}
  for(const key of ['onlineEnabled','faceToFaceEnabled'])if(data[key]!==undefined){if(typeof data[key]!=='boolean')return fail(400,'Choose valid lesson formats');immediate[key]=data[key]}
  if(!(data.onlineEnabled??profile.onlineEnabled)&&!(data.faceToFaceEnabled??profile.faceToFaceEnabled))return fail(400,'Enable at least one lesson format')
  if(data.subjectIds!==undefined){if(!Array.isArray(data.subjectIds)||data.subjectIds.length>8||data.subjectIds.some(id=>typeof id!=='string'))return fail(400,'Choose up to eight subjects');const ids=[...new Set(data.subjectIds)];if(await db.subject.count({where:{id:{in:ids},active:true}})!==ids.length)return fail(400,'Choose available subjects');patch.subjectIds=ids}
  for(const key of ['country','avatarUrl','name'])if(data[key]!==undefined){if(typeof data[key]!=='string'||String(data[key]).length>1000)return fail(400,'Invalid account details');account[key]=data[key]}
  if(data.timezone!==undefined){try{new Intl.DateTimeFormat('en',{timeZone:String(data.timezone)}).format()}catch{return fail(400,'Choose a valid timezone')};account.timezone=data.timezone}
  for(const key of Object.keys(patch)){
    const old=key==='subjectIds'?profile.subjects.map(item=>item.subjectId).sort():(profile as unknown as Record<string,unknown>)[key]
    const proposed=key==='subjectIds'?[...(patch[key] as string[])].sort():patch[key]
    if(JSON.stringify(old)===JSON.stringify(proposed))delete patch[key]
  }
  const reviewing=profile.status==='APPROVED'&&Object.keys(patch).length>0,submitting=data.action==='submit'
  if(reviewing||submitting){
    const experiences=readList<ExperienceItem>(patch.experienceItems??profile.experienceItems),skills=readList<SkillItem>(patch.skillItems??profile.skillItems)
    const claimed=[...experiences.filter(item=>item.organization||item.program),...skills.filter(item=>/\b(ib|igcse|school|cambridge|international baccalaureate)\b/i.test(item.name))]
    if(/\b(ib|igcse|school|cambridge|international baccalaureate)\b/i.test(String(patch.experience||'')+' '+String(patch.certifications||''))&&!experiences.some(item=>item.certificateId)&&!skills.some(item=>item.certificateId))return fail(400,'Add a structured experience or skill entry and attach evidence for programme or school claims')
    if(claimed.some(item=>!item.certificateId))return fail(400,'Attach a certificate or supporting document to each school, organisation or programme claim')
    const ids=[...new Set([...experiences,...skills].map(item=>item.certificateId).filter(Boolean))] as string[]
    if(ids.length&&await db.mediaAsset.count({where:{id:{in:ids},scope:'certificate',ownerId:user.id}})!==ids.length)return fail(400,'Use qualification documents uploaded by your own account')
  }
  if(submitting){
    if(!String(patch.headline??profile.headline).trim()||String(patch.about??profile.about).length<80)return fail(400,'Add a professional headline and an introduction of at least 80 characters')
    if(!((patch.subjectIds as string[]|undefined)||profile.subjects).length||!profile.rules.length)return fail(400,'Choose at least one subject and add your weekly working hours')
    if(!readList(patch.languageItems??profile.languageItems).length)return fail(400,'Add your languages and proficiency levels')
  }
  await db.$transaction(async tx=>{
    if(reviewing){await tx.tutorProfileChange.updateMany({where:{tutorId:profile.id,status:'PENDING'},data:{status:'SUPERSEDED'}});await tx.tutorProfileChange.create({data:{tutorId:profile.id,userId:user.id,patchJson:JSON.stringify(patch)}})}
    else{
      const {subjectIds,...publicFields}=patch
      if(Object.keys(publicFields).length)await tx.tutorProfile.update({where:{id:profile.id},data:publicFields})
      if(subjectIds){await tx.tutorSubject.deleteMany({where:{tutorId:profile.id}});await tx.tutorSubject.createMany({data:(subjectIds as string[]).map(subjectId=>({tutorId:profile.id,subjectId}))})}
    }
    if(Object.keys(immediate).length||submitting)await tx.tutorProfile.update({where:{id:profile.id},data:{...immediate,...(submitting?{status:'PENDING'}:{})}})
    if(Object.keys(account).length)await tx.user.update({where:{id:user.id},data:account})
  })
  if(reviewing||submitting){const admins=await db.user.findMany({where:{role:'ADMIN',status:'ACTIVE'},select:{id:true}});await Promise.all(admins.map(admin=>notify(admin.id,'admin',reviewing?'Teacher profile changes awaiting review':'New teacher application',`${user.name} submitted professional information for review.`,'admin-applications')));await audit(user.id,reviewing?'PROFILE_CHANGE_SUBMIT':'TUTOR_APPLICATION_SUBMIT','tutorProfile',profile.id)}
  return ok({ok:true,pendingReview:reviewing,...(submitting?{status:'PENDING'}:{})})
})}
