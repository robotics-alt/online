export interface BoardAccess { locked: boolean; studentId: string | null }
export function chooseBoardStudent(students: string[], requested?: string | null): string {
  const unique = [...new Set(students)]
  if (unique.length === 0) throw new Error('No student is connected yet')
  if (unique.length === 1) return unique[0]
  if (!requested || !unique.includes(requested)) throw new Error('Choose the student who can use the whiteboard')
  return requested
}
export function mayWriteBoard(role: string, userId: string, access: BoardAccess) {
  return role === 'tutor' || !access.locked && access.studentId === userId
}
