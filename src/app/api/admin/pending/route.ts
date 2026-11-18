import{NextRequest}from'next/server'
import{db}from'@/lib/db'
import{requireAdmin}from'@/lib/auth'
import{handle,ok}from'@/lib/api'
export async function GET(req:NextRequest){return handle(async()=>{const user=await requireAdmin(req);const[applications,profileChanges,lessons,groups,packages,payouts,support,notifications]=await Promise.all([db.tutorProfile.count({where:{status:'PENDING'}}),db.tutorProfileChange.count({where:{status:'PENDING'}}),db.booking.count({where:{status:'PENDING_PAYMENT'}}),db.groupEnrollment.count({where:{status:'PENDING'}}),db.packagePurchase.count({where:{status:'PENDING'}}),db.payoutRequest.count({where:{status:'REQUESTED'}}),db.supportTicket.count({where:{status:'OPEN'}}),db.notification.count({where:{userId:user.id,readAt:null}})]);return ok({counts:{applications,'profile-changes':profileChanges,bookings:lessons,'group-enrollments':groups,'package-purchases':packages,payouts,support,notifications}})})}
