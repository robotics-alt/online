import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { teacherBookingVisibility } from '@/lib/booking-visibility'

/** GET /api/tutor/students — student directory with history, goals and notes. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['TUTOR'])
    const bookings = await db.booking.findMany({
      where: { ...teacherBookingVisibility, tutorId: user.id },
      orderBy: { startUtc: 'desc' },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true, country: true, timezone: true } },
        subject: { select: { name: true } },
      },
    })
    const byStudent = new Map<string, {
      student: { id: string; name: string; avatarUrl: string | null; country: string | null; timezone: string }
      lessons: number; completed: number; lastLesson: Date | null; subjects: Set<string>; nextLesson: Date | null
    }>()
    for (const b of bookings) {
      const entry = byStudent.get(b.studentId) ?? {
        student: { id: b.student.id, name: b.student.name, avatarUrl: b.student.avatarUrl, country: b.student.country, timezone: b.student.timezone },
        lessons: 0, completed: 0, lastLesson: null as Date | null, subjects: new Set<string>(), nextLesson: null as Date | null,
      }
      entry.lessons += 1
      if (b.status === 'COMPLETED') {
        entry.completed += 1
        if (!entry.lastLesson || b.startUtc > entry.lastLesson) entry.lastLesson = b.startUtc
      }
      if (['CONFIRMED', 'RESCHEDULED'].includes(b.status) && b.startUtc > new Date() && (!entry.nextLesson || b.startUtc < entry.nextLesson)) {
        entry.nextLesson = b.startUtc
      }
      if (b.subject) entry.subjects.add(b.subject.name)
      byStudent.set(b.studentId, entry)
    }
    const studentIds = [...byStudent.keys()]
    const [goals, assignments] = await Promise.all([
      db.learningGoal.findMany({ where: { tutorId: user.id } }),
      db.assignment.findMany({ where: { tutorId: user.id }, include: { submissions: true }, orderBy: { createdAt: 'desc' } }),
    ])
    const students = [...byStudent.values()].map((s) => ({
      ...s,
      subjects: [...s.subjects],
      goals: goals.filter((g) => g.studentId === s.student.id),
      assignments: assignments.filter((a) => a.studentId === s.student.id).map((a) => ({ id: a.id, title: a.title, status: a.status, dueDate: a.dueDate, submissions: a.submissions.length })),
    }))
    students.sort((a, b) => b.completed - a.completed)
    return ok({ students })
  })
}
