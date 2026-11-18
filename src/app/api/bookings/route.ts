import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getSettings, notify, audit } from '@/lib/settings'
import { parseAmountToCents } from '@/lib/money'
import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import { teacherBookingVisibility } from '@/lib/booking-visibility'

/** GET /api/bookings — role-aware list. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const sp = req.nextUrl.searchParams
    const status = sp.get('status') ?? ''
    const range = sp.get('range') ?? 'all' // upcoming | past | all

    const where: Prisma.BookingWhereInput = user.role === 'TUTOR'
      ? { tutorId: user.id }
      : user.role === 'STUDENT'
        ? { studentId: user.id }
        : {}
    if (status) where.status = status as Prisma.EnumBookingStatusFilter
    if (user.role === 'TUTOR') where.AND = [teacherBookingVisibility]
    if (range === 'upcoming') {
      where.startUtc = { gte: new Date() }
      where.status = { in: ['CONFIRMED', 'PENDING_PAYMENT', 'RESCHEDULED'] }
    } else if (range === 'past') {
      where.OR = [
        { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REFUNDED', 'DISPUTED'] } },
        { startUtc: { lt: new Date() }, status: { in: ['CONFIRMED', 'RESCHEDULED'] } },
      ]
    }

    const bookings = await db.booking.findMany({
      where,
      orderBy: { startUtc: range === 'past' ? 'desc' : 'asc' },
      take: 100,
      include: {
        student: { select: { id: true, name: true, avatarUrl: true, country: true } },
        tutor: { select: { id: true, name: true, avatarUrl: true, country: true } },
        subject: { select: { name: true } },
        review: { select: { id: true, rating: true } },
      },
    })
    return ok({ bookings })
  })
}

interface BookBody {
  tutorProfileId: string
  startUtc: string
  durationMin?: number
  isTrial?: boolean
  paymentMethod?: 'WALLET' | 'CREDIT' | 'BANK_TRANSFER' | 'CASH'
  lessonFormat?: 'ONLINE' | 'FACE_TO_FACE'
  privateDetails?: { phone?: string; email?: string; location?: string; paymentReference?: string }
  creditId?: string
  couponCode?: string
  studentNotes?: string
  subjectId?: string
}

/** POST /api/bookings — create a booking with payment (wallet/credit/external). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['STUDENT', 'ADMIN'])
    const data = await body<BookBody>(req)
    requireFields(data as unknown as Record<string, unknown>, ['tutorProfileId', 'startUtc'])
    const settings = await getSettings()

    const tutor = await db.tutorProfile.findUnique({
      where: { id: data.tutorProfileId },
      include: { user: true },
    })
    if (!tutor || tutor.status !== 'APPROVED') return fail(404, 'Tutor is not available for booking')
    const lessonFormat = data.lessonFormat ?? 'ONLINE'
    if (!['ONLINE', 'FACE_TO_FACE'].includes(lessonFormat) || (lessonFormat === 'ONLINE' ? !tutor.onlineEnabled : !tutor.faceToFaceEnabled)) return fail(400, 'This teacher does not offer the selected lesson format')
    const details = data.privateDetails ?? {}
    const phone = typeof details.phone === 'string' ? details.phone.trim() : ''
    const email = typeof details.email === 'string' ? details.email.trim() : ''
    const location = typeof details.location === 'string' ? details.location.trim() : ''
    const paymentReference = typeof details.paymentReference === 'string' ? details.paymentReference.trim() : ''
    if (phone.length > 40 || email.length > 254 || location.length > 1000 || paymentReference.length > 200) return fail(400, 'Contact or payment details are too long')
    if (lessonFormat === 'FACE_TO_FACE' && (!/^[+\d][\d\s().-]{5,39}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || location.length < 5)) return fail(400, 'Enter a valid phone number, email and full meeting location')
    const startUtc = new Date(data.startUtc)
    if (isNaN(startUtc.getTime())) return fail(400, 'Invalid start time')
    const durationMin = data.durationMin ?? settings.slotDurationMin
    if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 180) return fail(400, 'Choose a lesson duration between 15 and 180 minutes')
    const endUtc = new Date(startUtc.getTime() + durationMin * 60000)

    // --- Validation ---
    if (startUtc.getTime() < Date.now() + settings.bookingNoticeHours * 3600 * 1000) {
      return fail(400, `Lessons must be booked at least ${settings.bookingNoticeHours}h in advance`)
    }
    if (tutor.vacationMode) return fail(400, 'This tutor is currently on vacation mode')
    const horizon = new Date(Date.now() + settings.bookingHorizonDays * 86400000)
    if (startUtc > horizon) return fail(400, `Bookings are limited to ${settings.bookingHorizonDays} days ahead`)

    // Trial: once per student+tutor pair
    const isTrial = Boolean(data.isTrial) && settings.trialLessonEnabled
    if (data.isTrial && !settings.trialLessonEnabled) return fail(400, 'Trial lessons are currently disabled')
    if (isTrial) {
      const prior = await db.booking.findFirst({
        where: { studentId: user.id, tutorId: tutor.userId, isTrial: true, status: { notIn: ['CANCELLED'] } },
      })
      if (prior) return fail(400, 'You have already used your trial lesson with this tutor')
    }

    // --- Price ---
    let priceCents = isTrial ? 0 : Math.round((tutor.hourlyRateCents * durationMin) / settings.slotDurationMin)
    const originalPriceCents=priceCents
    let couponId: string | undefined
    let couponCode:string|undefined
    if (data.couponCode && !isTrial) {
      const coupon = await db.coupon.findUnique({ where: { code: data.couponCode.toUpperCase() } })
      if (!coupon || !coupon.active || coupon.usedCount >= coupon.maxUses || (coupon.expiresAt && coupon.expiresAt < new Date())) {
        return fail(400, 'This coupon code is not valid')
      }
      priceCents = Math.round(priceCents * (100 - coupon.percentOff) / 100)
      couponId = coupon.id
      couponCode=coupon.code
    }

    // --- Overlap + payment in a single transaction ---
    const paymentMethod = isTrial ? 'NONE' : data.paymentMethod ?? 'WALLET'
    if (!['NONE', 'WALLET', 'CREDIT', 'BANK_TRANSFER', 'CASH'].includes(paymentMethod)) return fail(400, 'Choose an available payment method')
    if (!isTrial && paymentMethod === 'NONE') return fail(400, 'Choose a payment method for your full lesson')
    if (paymentMethod === 'BANK_TRANSFER' && !paymentReference) return fail(400, 'Enter your bank transfer reference for admin verification')
    const roomId = `room-${randomBytes(8).toString('hex')}`
    const result = await db.$transaction(async (tx) => {
      // Overlap protection (in addition to the unique(tutorId, startUtc) constraint)
      const overlapping = await tx.booking.count({
        where: {
          tutorId: tutor.userId,
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'RESCHEDULED'] },
          startUtc: { lt: endUtc },
          endUtc: { gt: startUtc },
        },
      })
      if (overlapping > 0) throw Object.assign(new Error('This slot was just booked — please choose another time'), { status: 409 })
      const groups=await tx.groupClass.findMany({where:{tutorId:tutor.userId,status:'PUBLISHED',startUtc:{lt:endUtc}}})
      if(groups.some(group=>+group.startUtc+group.durationMin*60000>+startUtc))throw Object.assign(new Error('This time overlaps a group class'),{status:409})

      let creditId: string | undefined
      if (paymentMethod === 'WALLET') {
        const reserved = await tx.user.updateMany({ where: { id: user.id, walletCents: { gte: priceCents } }, data: { walletCents: { decrement: priceCents } } })
        if (!reserved.count) {
          throw Object.assign(new Error('Insufficient wallet balance — please top up your credits'), { status: 400 })
        }
        const u = await tx.user.findUnique({ where: { id: user.id }, select: { walletCents: true } })
        const balanceAfter = u!.walletCents
        await tx.ledgerEntry.create({
          data: { userId: user.id, type: 'SPEND', amountCents: -priceCents, balanceAfterCents: balanceAfter, refType: 'BOOKING', refId: roomId, description: `Lesson payment — ${tutor.user.name}` },
        })
      } else if (paymentMethod === 'CREDIT') {
        const credit = await tx.lessonCredit.findFirst({
          where: {
            id: data.creditId, studentId: user.id, remaining: { gt: 0 },
            AND: [
              { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
              { OR: [{ tutorId: null }, { tutorId: tutor.userId }] },
            ],
          },
        })
        if (!credit) throw Object.assign(new Error('Lesson credit not available for this tutor'), { status: 400 })
        const allowed:string[]=JSON.parse(credit.allowedTeacherIds||'[]');const groups:string[]=JSON.parse(credit.allowedGroupIds||'[]')
        if(allowed.length?!allowed.includes(tutor.userId):groups.length>0)throw Object.assign(new Error('This tutor is not included in your package'),{status:400})
        if(data.couponCode)throw Object.assign(new Error('Coupons apply to the package purchase, not credit lessons'),{status:400})
        if(credit.purchaseId)throw Object.assign(new Error('Schedule your weekly package lessons from Packages'),{status:400})
        if(credit.remainingValueCents!==null)priceCents=Math.floor(credit.remainingValueCents/credit.remaining)
        const reservedCredit = await tx.lessonCredit.updateMany({ where: { id: credit.id, remaining: { gt: 0 } }, data: { remaining: { decrement: 1 },...(credit.remainingValueCents!==null?{remainingValueCents:{decrement:priceCents}}:{}) } })
        if (!reservedCredit.count) throw Object.assign(new Error('Lesson credit is no longer available'), { status: 409 })
        creditId = credit.id
      }

      if (couponId) {
        const coupon=await tx.coupon.findUniqueOrThrow({where:{id:couponId}});const claimed=await tx.coupon.updateMany({where:{id:couponId,usedCount:{lt:coupon.maxUses},active:true},data:{usedCount:{increment:1}}});if(!claimed.count)throw Object.assign(new Error('Coupon usage limit reached'),{status:409})
      }

      const booking = await tx.booking.create({
        data: {
          couponId,couponCode,couponRecorded:true,couponDiscountCents:couponId?originalPriceCents-priceCents:0,
          studentId: user.id,
          tutorId: tutor.userId,
          tutorProfileId: tutor.id,
          subjectId: data.subjectId || null,
          startUtc, endUtc, durationMin,
          status: isTrial ? 'CONFIRMED' : 'PENDING_PAYMENT',
          approvalRequired: !isTrial,
          lessonFormat,
          isTrial,
          priceCents,
          paymentMethod,
          creditId,
          roomId,
          studentNotes: data.studentNotes || null,
          privateDetails: lessonFormat === 'FACE_TO_FACE' || paymentReference ? { create: { phone: lessonFormat === 'FACE_TO_FACE' ? phone : null, email: lessonFormat === 'FACE_TO_FACE' ? email : null, location: lessonFormat === 'FACE_TO_FACE' ? location : null, paymentReference: paymentReference || null } } : undefined,
        },
      })
      if(couponId)await tx.couponRedemption.create({data:{couponId,code:couponCode!,studentId:user.id,bookingId:booking.id,discountCents:originalPriceCents-priceCents}})
      if (!isTrial) await tx.payment.create({ data: { userId: user.id, amountCents: priceCents, method: paymentMethod, status: 'PENDING', purpose: 'LESSON', refId: booking.id, description: 'Awaiting administrator approval' } })
      if (paymentMethod === 'WALLET') await tx.ledgerEntry.updateMany({ where: { userId: user.id, refType: 'BOOKING', refId: roomId }, data: { refId: booking.id } })
      return booking
    }).catch((err: Error & { status?: number }) => {
      if (err.status) throw Object.assign(new Error(err.message), { status: err.status })
      if (err.message?.includes('Unique constraint')) throw Object.assign(new Error('This slot was just booked — please choose another time'), { status: 409 })
      throw err
    })

    if (isTrial) await notify(tutor.userId, 'booking', `New trial with ${user.name}`, `${new Date(startUtc).toUTCString()} — ${lessonFormat === 'ONLINE' ? 'Online' : 'Face to face'}`, 'calendar')
    else {
      const admins = await db.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } })
      await Promise.all(admins.map((admin) => notify(admin.id, 'payment', 'Booking awaiting approval', `${user.name} requested a full lesson. Verify payment in Bookings.`, 'bookings')))
    }
    await notify(user.id, 'booking', isTrial ? 'Trial confirmed' : 'Awaiting admin approval', isTrial ? `Your free trial with ${tutor.user.name} is confirmed.` : 'Your payment and appointment will be reviewed by an administrator.', 'lessons')
    await audit(user.id, 'BOOKING_CREATE', 'booking', result.id, { priceCents, paymentMethod })

    return ok({ booking: { id: result.id, roomId: result.roomId, startUtc: result.startUtc, priceCents: result.priceCents, status: result.status } })
  })
}
