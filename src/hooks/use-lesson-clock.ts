'use client'
import { useEffect, useState } from 'react'

/** Refresh classroom entry buttons as the lesson approaches, without reloading the page. */
export function useLessonClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const update = () => setNow(Date.now())
    const interval = window.setInterval(update, 15000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', update) }
  }, [])
  return now
}
