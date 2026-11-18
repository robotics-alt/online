'use client'

import { useSyncExternalStore } from 'react'

export function getDeviceTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

function subscribe(onChange: () => void) {
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}

/** Use this device's local timezone for display, independently of a tutor's saved availability zone. */
export function useDeviceTimezone() {
  return useSyncExternalStore(subscribe, getDeviceTimezone, () => 'UTC')
}
