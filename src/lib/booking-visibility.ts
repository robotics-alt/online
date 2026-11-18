import type { Prisma } from '@prisma/client'
// Preserve existing confirmed lessons while hiding unapproved requests and rejected requests.
export const teacherBookingVisibility: Prisma.BookingWhereInput = {
  status: { not: 'PENDING_PAYMENT' },
  OR: [{ approvalRequired: false }, { approvedAt: { not: null } }],
}
