import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

/** GET /api/admin/bookings — all bookings with filters. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const sp = req.nextUrl.searchParams
    const status = sp.get('status') ?? ''
    const q = sp.get('q')?.trim() ?? ''
    const where: Prisma.BookingWhereInput = {
      ...(status ? { status: status as Prisma.EnumBookingStatusFilter } : {}),
      ...(q ? {
        OR: [
          { student: { name: { contains: q } } },
          { tutor: { name: { contains: q } } },
          { roomId: { contains: q } },
        ],
      } : {}),
    }
    const bookings = await db.booking.findMany({
      where,
      orderBy: { startUtc: 'desc' },
      take: 100,
      include: {
        privateDetails: true,
        student: { select: { name: true, email: true } },
        tutor: { select: { name: true, email: true } },
        subject: { select: { name: true } },
      },
    })
    return ok({ bookings })
  })
}
