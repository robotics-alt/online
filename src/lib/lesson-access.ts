export const CLASSROOM_EARLY_MS = 15 * 60 * 1000
export const CLASSROOM_GRACE_MS = 45 * 60 * 1000

export function canJoinLesson(lesson: { status: string; startUtc: string; endUtc: string; lessonFormat?: string }, now = Date.now()) {
  return lesson.lessonFormat !== 'FACE_TO_FACE' && ['CONFIRMED', 'RESCHEDULED'].includes(lesson.status)
    && now >= new Date(lesson.startUtc).getTime() - CLASSROOM_EARLY_MS
    && now <= new Date(lesson.endUtc).getTime() + CLASSROOM_GRACE_MS
}
