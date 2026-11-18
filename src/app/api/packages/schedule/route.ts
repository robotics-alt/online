import{NextRequest}from'next/server'
import{requireUser}from'@/lib/auth'
import{handle,body,ok,fail}from'@/lib/api'
import{db}from'@/lib/db'
import{available,ids,planPurchase,type PlanSlot}from'@/lib/package-service'
export async function GET(req:NextRequest){return handle(async()=>{const p=req.nextUrl.searchParams;const user=await requireUser(req,['STUDENT']);const credit=p.get('creditId')?await db.lessonCredit.findFirst({where:{id:p.get('creditId')!,studentId:user.id}}):null;if(p.get('creditId')&&!credit)return fail(404,'Credit not found');const pkg=await db.package.findUnique({where:{id:credit?.packageId||p.get('packageId')||''}});if(!pkg)return fail(404,'Package not found');return ok({slots:await available(ids(credit?.allowedTeacherIds||pkg.teacherIds),ids(credit?.allowedGroupIds||pkg.groupClassIds),p.get('week')||'',p.get('timezone')||user.timezone)})})}
export async function POST(req:NextRequest){return handle(async()=>{const user=await requireUser(req,['STUDENT']);const data=await body<{packageId?:string;creditId?:string;week:string;timezone:string;slots:PlanSlot[];paymentMethod?:string;couponCode?:string;paymentReference?:string}>(req);return ok(await planPurchase(user.id,data))})}
