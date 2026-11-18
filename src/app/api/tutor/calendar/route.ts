import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { zonedToUtc, addDaysKey } from '@/lib/tz'
import { teacherBookingVisibility } from '@/lib/booking-visibility'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const month = req.nextUrl.searchParams.get('month') || ''
    const timezone = req.nextUrl.searchParams.get('timezone') || user.timezone
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(400, 'Choose a valid month')
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() } catch { return fail(400, 'Choose a valid timezone') }
    const [year, monthNumber] = month.split('-').map(Number)
    const first = new Date(Date.UTC(year, monthNumber - 1, 1))
    const gridStart = addDaysKey(month + '-01', -(first.getUTCDay() + 6) % 7)
    const start = zonedToUtc(gridStart, 0, timezone)
    const end = zonedToUtc(addDaysKey(gridStart, 42), 0, timezone)
    const bookings = await db.booking.findMany({ where: { ...teacherBookingVisibility, tutorId: user.id, startUtc: { gte: start, lt: end } }, orderBy: { startUtc: 'asc' }, include: { student: { select: { id: true, name: true, avatarUrl: true } }, subject: { select: { name: true } } } })
    const groups=await db.groupClass.findMany({where:{tutorId:user.id,status:{in:['PUBLISHED','COMPLETED']},startUtc:{gte:start,lt:end}},include:{enrollments:{where:{status:'CONFIRMED'},select:{id:true}}}})
    const groupLessons=groups.map(group=>({id:'group:'+group.id,groupClassId:group.id,tutorId:user.id,startUtc:group.startUtc,endUtc:new Date(+group.startUtc+group.durationMin*60000),durationMin:group.durationMin,status:group.status==='COMPLETED'?'COMPLETED':group.enrollments.length>=group.minStudents?'CONFIRMED':'ENROLLING',isTrial:false,priceCents:group.priceCents,lessonFormat:'ONLINE',student:{id:'group:'+group.id,name:group.title,avatarUrl:null},subject:{name:`${group.enrollments.length}/${group.maxStudents} students · ${group.subject}`}}))
    return ok({ bookings:[...bookings,...groupLessons].sort((a,b)=>+a.startUtc-+b.startUtc), timezone, month })
  })
}
