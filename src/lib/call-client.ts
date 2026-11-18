'use client'
import { api, useApp } from './store'
import type { LessonCall } from './lesson-calls'
import { primeCallAudio } from '@/hooks/use-call-ringtone'

export async function callStudent(bookingId: string) {
  primeCallAudio()
  const { call } = await api<{ call: LessonCall }>('/api/lesson-calls', { method: 'POST', json: { bookingId } })
  useApp.getState().go('classroom', { bookingId, callId: call.id })
  return call
}
