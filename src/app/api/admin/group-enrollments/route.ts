import{NextRequest}from'next/server'
import{db}from'@/lib/db'
import{requireAdmin,ApiError}from'@/lib/auth'
import{body,handle,fail,ok}from'@/lib/api'
import{notify,audit}from'@/lib/settings'
export async function GET(req:NextRequest){return handle(async()=>{
 await requireAdmin(req);const enrollments=await db.groupEnrollment.findMany({where:{status:'PENDING'},include:{group:true},orderBy:{createdAt:'asc'}}),students=await db.user.findMany({where:{id:{in:enrollments.map(item=>item.studentId)}},select:{id:true,name:true,email:true}})
 return ok({enrollments:enrollments.map(item=>({...item,student:students.find(student=>student.id===item.studentId)}))})
})}
export async function POST(req:NextRequest){return handle(async()=>{
 const admin=await requireAdmin(req),data=await body<{id:string;action:string}>(req)
 if(!['approve','reject'].includes(data.action))return fail(400,'Choose approve or reject')
 const row=await db.groupEnrollment.findUnique({where:{id:data.id},include:{group:true}})
 if(row?.packagePurchaseId&&(await db.packagePurchase.findUnique({where:{id:row.packagePurchaseId}}))?.status==='PENDING')return fail(409,'Review this purchase in Coupons & Packages')
 if(!row||row.status!=='PENDING')return fail(409,'This enrolment has already been reviewed')
 if(data.action==='approve'&&(row.group.status!=='PUBLISHED'||+row.group.startUtc<=Date.now()))return fail(400,'The class is no longer available. Reject the request and arrange another class.')
 await db.$transaction(async tx=>{
  const updated=await tx.groupEnrollment.updateMany({where:{id:row.id,status:'PENDING'},data:{status:data.action==='approve'?'CONFIRMED':'REJECTED',approvedBy:admin.id}})
  if(!updated.count)throw new ApiError(409,'This enrolment has already changed')
  const payment=await tx.payment.findFirst({where:{refId:'group:'+row.id,status:'PENDING'}})
  if(!payment)throw new ApiError(409,'No pending payment record was found')
  await tx.payment.update({where:{id:payment.id},data:{status:data.action==='approve'?'SUCCEEDED':'CANCELLED'}})
  if(data.action==='reject'&&row.paymentMethod==='CREDIT'&&row.creditId){const credit=await tx.lessonCredit.findUnique({where:{id:row.creditId}});if(credit)await tx.lessonCredit.update({where:{id:credit.id},data:{remaining:{increment:1},...(credit.remainingValueCents!==null?{remainingValueCents:{increment:row.priceCents}}:{})}})}
  if(data.action==='reject'&&row.paymentMethod==='WALLET'){
   const account=await tx.user.update({where:{id:row.studentId},data:{walletCents:{increment:row.priceCents}}})
   await tx.ledgerEntry.create({data:{userId:row.studentId,type:'REFUND',amountCents:row.priceCents,balanceAfterCents:account.walletCents,refType:'GROUP_ENROLLMENT',refId:row.id,description:'Rejected group class reservation'}})
  }
 })
 await notify(row.studentId,'booking',data.action==='approve'?'Group class place approved':'Group class request rejected',row.group.title,'classes')
 if(data.action==='approve')await notify(row.group.tutorId,'booking','New confirmed class member',row.group.title,'calendar')
 await audit(admin.id,'GROUP_ENROLLMENT_'+data.action.toUpperCase(),'groupEnrollment',row.id)
 return ok({ok:true})
})}
