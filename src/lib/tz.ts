// Timezone utilities using the Intl API (no external deps).
// Availability rules are stored in the TUTOR's local wall-clock time.
// Bookings are stored in UTC. Clients convert to their own timezone.

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - date.getTime()
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. dateKey = YYYY-MM-DD, minutes = minutes from midnight. */
export function zonedToUtc(dateKey: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, minutes)
  const offset1 = tzOffsetMs(new Date(guess), timeZone)
  const candidate = new Date(guess - offset1)
  // Handle DST boundary: re-check offset at the candidate instant
  const offset2 = tzOffsetMs(candidate, timeZone)
  if (offset2 !== offset1) return new Date(guess - offset2)
  return candidate
}

/** Get the YYYY-MM-DD key of a Date in a given timezone. */
export function dateKeyInTz(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '01'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Weekday (0-6, Sunday=0) of a Date in a given timezone. */
export function weekdayInTz(date: Date, timeZone: string): number {
  const key = dateKeyInTz(date, timeZone)
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Minutes-from-midnight of a Date in a given timezone. */
export function minutesInTz(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit' })
  const parts = dtf.formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Format a UTC Date into a local wall-clock string for display. */
export function formatInTz(date: Date, timeZone: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(date)
}

export const COMMON_TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Africa/Accra', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Nairobi',
  'Asia/Dubai', 'Asia/Baghdad', 'Asia/Tehran', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney',
  'Pacific/Auckland',
]
