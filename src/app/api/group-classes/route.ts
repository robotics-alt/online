import{NextRequest}from'next/server'
import{randomUUID}from'node:crypto'
import{db}from'@/lib/db'
import{getAuthUser,requireUser,ApiError}from'@/lib/auth'
import{body,handle,fail,ok}from'@/lib/api'
import{notify,audit}from'@/lib/settings'
export async function GET(req:NextRequest){return handle(async()=>{
 const user=await getAuthUser(req),mine=req.nextUrl.searchParams.get('mine')==='1'
 if(mine&&user?.role!=='TUTOR')return fail(403,'Teacher account required')
 const classes=await db.groupClass.findMany({where:mine?{tutorId:user!.id}:{status:'PUBLISHED',startUtc:{gte:new Date(Date.now()-3*3600000)}},orderBy:{startUtc:'asc'},take:50,include:{enrollments:{select:{studentId:true,status:true}}}})
 const teachers=await db.user.findMany({where:{id:{in:classes.map(item=>item.tutorId)},status:'ACTIVE',tutorProfile:{status:'APPROVED'}},select:{id:true,name:true,avatarUrl:true}})
 return ok({classes:classes.filter(item=>teachers.some(teacher=>teacher.id===item.tutorId)).map(({enrollments,...item})=>({...item,teacher:teachers.find(teacher=>teacher.id===item.tutorId),thumbnailUrl:item.thumbnailId?'/api/media/'+item.thumbnailId:'/class-cover.svg',enrolled:enrollments.filter(entry=>entry.status==='CONFIRMED').length,reserved:mine?enrollments.filter(entry=>['CONFIRMED','PENDING'].includes(entry.status)).length:undefined,myEnrollment:user?enrollments.find(entry=>entry.studentId===user.id)?.status||null:null}))})
})}
export async function POST(req:NextRequest){return handle(async()=>{
 const user=await requireUser(req),data=await body<Record<string,unknown>>(req)
 if(data.action==='create'){
  if(user.role!=='TUTOR')return fail(403,'Only teachers can publish group classes')
  const profile=await db.tutorProfile.findUnique({where:{userId:user.id}})
  if(profile?.status!=='APPROVED'||!profile.onlineEnabled)return fail(403,'An approved profile with online lessons enabled is required')
  const title=String(data.title||'').trim(),description=String(data.description||'').trim(),subject=String(data.subject||'').trim(),startUtc=new Date(String(data.startUtc)),durationMin=Number(data.durationMin||60),minStudents=Number(data.minStudents||5),maxStudents=Number(data.maxStudents||12),priceCents=Math.round(Number(data.priceCents||0)),thumbnailId=data.thumbnailId?String(data.thumbnailId):null
  if(title.length<5||title.length>120||description.length<20||description.length>4000||!subject||subject.length>100)return fail(400,'Add a title, subject and description of at least 20 characters')
  if(!Number.isFinite(+startUtc)||+startUtc<Date.now()+15*60000||+startUtc>Date.now()+180*86400000)return fail(400,'Choose a class time between 15 minutes and 180 days ahead')
  if(!Number.isInteger(durationMin)||durationMin<30||durationMin>180||!Number.isInteger(minStudents)||minStudents<5||!Number.isInteger(maxStudents)||maxStudents<minStudents||maxStudents>12||!Number.isInteger(priceCents)||priceCents<0||priceCents>100000)return fail(400,'Classes need at least five students, up to 12 seats, a duration of 30–180 minutes, and a valid price')
  if(thumbnailId&&!await db.mediaAsset.findFirst({where:{id:thumbnailId,scope:'thumbnail',ownerId:user.id,mime:{startsWith:'image/'}}}))return fail(400,'Use your own uploaded class thumbnail')
  const end=new Date(+startUtc+durationMin*60000)
  const group=await db.$transaction(async tx=>{
   const clash=await tx.booking.count({where:{tutorId:user.id,status:{in:['CONFIRMED','PENDING_PAYMENT','RESCHEDULED']},startUtc:{lt:end},endUtc:{gt:startUtc}}})
   const groups=await tx.groupClass.findMany({where:{tutorId:user.id,status:'PUBLISHED',startUtc:{lt:end}}})
   if(clash||groups.some(item=>+item.startUtc+item.durationMin*60000>+startUtc))throw new ApiError(409,'This time overlaps an existing lesson or class')
   return tx.groupClass.create({data:{tutorId:user.id,title,description,subject,startUtc,durationMin,minStudents,maxStudents,priceCents,thumbnailId,roomId:'group-'+randomUUID()}})
  })
  await audit(user.id,'GROUP_CLASS_CREATE','groupClass',group.id)
  return ok({class:group})
 }
 if(data.action!=='enroll'||user.role!=='STUDENT')return fail(400,'Choose a supported class action')
 const group=await db.groupClass.findUnique({where:{id:String(data.groupId||'')}})
 if(!group||group.status!=='PUBLISHED'||+group.startUtc<=Date.now())return fail(400,'This class is no longer accepting enrolments')
 const paymentMethod=group.priceCents?String(data.paymentMethod||'WALLET'):'NONE',paymentReference=String(data.paymentReference||'').trim().slice(0,200)
 if(!['WALLET','BANK_TRANSFER','CASH','NONE'].includes(paymentMethod)||group.priceCents&&paymentMethod==='NONE')return fail(400,'Choose an available payment method')
 if(paymentMethod==='BANK_TRANSFER'&&!paymentReference)return fail(400,'Enter your transfer reference for admin verification')
 const enrollment=await db.$transaction(async tx=>{
  const previous=await tx.groupEnrollment.findUnique({where:{groupId_studentId:{groupId:group.id,studentId:user.id}}})
  if(previous&&['CONFIRMED','PENDING'].includes(previous.status))throw new ApiError(409,'You already have a place or pending request in this class')
  const count=await tx.groupEnrollment.count({where:{groupId:group.id,status:{in:['CONFIRMED','PENDING']}}})
  if(count>=group.maxStudents)throw new ApiError(409,'All class places are currently reserved')
  const values={status:group.priceCents?'PENDING':'CONFIRMED',priceCents:group.priceCents,paymentMethod,paymentReference:paymentReference||null,approvedBy:null}
  const row=previous?await tx.groupEnrollment.update({where:{id:previous.id},data:values}):await tx.groupEnrollment.create({data:{...values,groupId:group.id,studentId:user.id}})
  if(paymentMethod==='WALLET'){
   const reserved=await tx.user.updateMany({where:{id:user.id,walletCents:{gte:group.priceCents}},data:{walletCents:{decrement:group.priceCents}}})
   if(!reserved.count)throw new ApiError(400,'Not enough wallet balance')
   const balance=await tx.user.findUnique({where:{id:user.id},select:{walletCents:true}})
   await tx.ledgerEntry.create({data:{userId:user.id,type:'SPEND',amountCents:-group.priceCents,balanceAfterCents:balance!.walletCents,refType:'GROUP_ENROLLMENT',refId:row.id,description:'Group class reservation'}})
  }
  if(group.priceCents)await tx.payment.create({data:{userId:user.id,amountCents:group.priceCents,method:paymentMethod,status:'PENDING',purpose:'LESSON',refId:'group:'+row.id,description:'Group class awaiting admin payment approval'}})
  return row
 })
 if(group.priceCents){const admins=await db.user.findMany({where:{role:'ADMIN',status:'ACTIVE'},select:{id:true}});await Promise.all(admins.map(admin=>notify(admin.id,'payment','Group class payment awaiting review',`${user.name} requested a place in ${group.title}.`,'bookings')))}
 await notify(user.id,'booking',group.priceCents?'Class place awaiting payment approval':'Class place confirmed',group.title,'classes')
 return ok({enrollment})
})}
