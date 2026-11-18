/**
 * Creates a "live now" lesson booking for classroom testing (dev only).
 * Usage: bun scripts/live-lesson.ts [studentEmail] [tutorEmail]
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'

const db = new PrismaClient()

async function main() {
  const [studentEmail, tutorEmail] = process.argv.slice(2)
  const student = await db.user.findUnique({ where: { email: studentEmail ?? 'student@tutorsphere.app' } })
  const tutor = await db.user.findUnique({ where: { email: tutorEmail ?? 'sarah@tutorsphere.app' }, include: { tutorProfile: true } })
  if (!student || !tutor?.tutorProfile) throw new Error('Users not found')

  const start = new Date(Date.now() - 5 * 60 * 1000)
  const end = new Date(Date.now() + 55 * 60 * 1000)
  const booking = await db.booking.create({
    data: {
      studentId: student.id, tutorId: tutor.id, tutorProfileId: tutor.tutorProfile.id,
      startUtc: start, endUtc: end, durationMin: 60,
      status: 'CONFIRMED', priceCents: 0, paymentMethod: 'WALLET',
      roomId: `room-${randomBytes(8).toString('hex')}`,
    },
  })
  console.log(`Live lesson created: ${booking.id} (room ${booking.roomId})`)
}

main().finally(() => db.$disconnect())
