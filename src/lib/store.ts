'use client'

import { create } from 'zustand'

// ---------- API helper ----------
export class ApiFail extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, options?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = options ?? {}
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: 'same-origin',
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed (${res.status})`
    throw new ApiFail(res.status, message)
  }
  return data as T
}

// ---------- Types ----------
export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'STUDENT' | 'TUTOR' | 'ADMIN' | 'SUPPORT'
  status: string
  avatarUrl: string | null
  country: string | null
  timezone: string
  currency: string
  language: string
  walletCents: number
  onboarded: boolean
  emailVerified: boolean
  tutorProfileId: string | null
  tutorStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null
  spokenLanguages?: string
  languagePreferenceSet?: boolean
  currencyPreferenceSet?: boolean
}

export interface View {
  name:
    | 'landing' | 'auth' | 'search' | 'tutor' | 'student' | 'tutor-dash' | 'admin'
    | 'messages' | 'classroom' | 'support' | 'cms' | 'help' | 'onboarding-tutor' | 'packages'
    | 'games' | 'classes'
  params?: Record<string, string>
}

export interface PublicData {
  settings: {
    logoUrl?:string
    iconUrl?:string
    supportPhone?:string
    translations?:Record<string,Record<string,string>>
    minimumHourlyRateCents?:number|null
    platformName: string
    tagline: string
    heroTitle: string
    heroSubtitle: string
    contactEmail: string
    defaultCurrency: string
    defaultLanguage: string
    enabledLanguages: string[]
    enabledCurrencies: string[]
    typography: Record<string,{font:string;size:number}>
    fxRates: Record<string, number>
    marketing?: import('./marketing-config').MarketingConfig
    branding?:import('./brand-colours').BrandColours
    trialLessonEnabled: boolean
  }
  subjects: { id: string; name: string; slug: string; category: string; description: string; icon: string }[]
  testimonials: { id: string; name: string; role: string; country: string | null; content: string; rating: number }[]
  faqs: { id: string; question: string; answer: string; category: string; order: number }[]
  cmsPages: { slug: string; title: string }[]
  stats: { students: number; tutors: number; lessons: number; countries?:number }
  featuredTutors: TutorCard[]
}

export interface TutorCard {
  id: string
  name: string
  country: string | null
  avatarUrl: string | null
  timezone: string
  headline: string
  about?: string
  hourlyRateCents: number
  trialRateCents: number
  rating: number | null
  reviewCount: number
  lessonsCompleted: number
  studentsCount?: number
  yearsExperience?: number
  languages: string
  identityVerified: boolean
  subjects: { name: string; slug: string }[]
}

const viewNames = new Set<View['name']>(['landing','auth','search','tutor','student','tutor-dash','admin','messages','classroom','support','cms','help','onboarding-tutor','packages','games','classes'])
function readNavigation(): View {
  const [name, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  if (!viewNames.has(name as View['name'])) return { name: 'landing' }
  return { name: name as View['name'], params: Object.fromEntries(new URLSearchParams(query)) }
}
function writeNavigation(view: View, replace = false) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('classroom'); url.searchParams.delete('callId')
  const query = new URLSearchParams(view.params).toString()
  url.hash = view.name === 'landing' ? '' : `/${view.name}${query ? '?' + query : ''}`
  const depth = Number(window.history.state?.tsDepth || 0) + (replace ? 0 : 1)
  const parent = replace ? window.history.state?.tsParent : readNavigation()
  window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, tsDepth: depth, tsParent: parent }, '', url)
}

interface AppState {
  view: View
  history: View[]
  user: AuthUser | null
  unreadNotifications: number
  unreadMessages: number
  publicData: PublicData | null
  currency: string
  language: string
  booted: boolean
  postCallReviewId: string | null
  setPostCallReviewId: (id: string | null) => void
  go: (view: View['name'], params?: Record<string, string>) => void
  back: () => void
  setUser: (u: AuthUser | null) => void
  setCounters: (n: { unreadNotifications?: number; unreadMessages?: number }) => void
  setPublicData: (d: PublicData) => void
  setCurrency: (c: string) => void
  setLanguage: (l: string) => void
  setBooted: (b: boolean) => void
  restoreNavigation: () => (() => void)
  refreshMe: () => Promise<void>
  logout: () => Promise<void>
  fmt: (cents: number) => string
}

export const useApp = create<AppState>((set, get) => ({
  view: { name: 'landing' },
  history: [],
  user: null,
  unreadNotifications: 0,
  unreadMessages: 0,
  publicData: null,
  currency: 'USD',
  language: 'en',
  booted: false,
  postCallReviewId: null,
  setPostCallReviewId: (postCallReviewId) => set({ postCallReviewId }),
  go: (name, params) => {
    const { view, history } = get()
    const next = { name, params }
    if (JSON.stringify(view) === JSON.stringify(next)) return
    writeNavigation(next)
    set({ view: next, history: [...history.slice(-20), view], })
    window.scrollTo({ top: 0 })
  },
  back: () => {
    if (typeof window !== 'undefined' && window.history.state?.tsDepth > 0) { window.history.back(); return }
    const { history } = get()
    const prev = history[history.length - 1] ?? { name: 'landing' as const }
    writeNavigation(prev, true)
    set({ view: prev, history: history.slice(0, -1) })
  },
  restoreNavigation: () => {
    const restore = () => { const view = readNavigation(); set({ view, history: [] }); window.scrollTo({ top: 0 }) }
    restore()
    writeNavigation(get().view, true)
    window.addEventListener('popstate', restore)
    window.addEventListener('hashchange', restore)
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore) }
  },
  setUser: (user) => set({ user, currency: user?.currency ?? get().currency, language: user?.language ?? get().language }),
  setCounters: (n) => set({ unreadNotifications: n.unreadNotifications ?? get().unreadNotifications, unreadMessages: n.unreadMessages ?? get().unreadMessages }),
  setPublicData: (publicData) => set({ publicData }),
  setCurrency: (currency) => {
    const { user } = get()
    if(!user)try { localStorage.setItem('ts-guest-currency-choice',currency) } catch {}
    set({ currency,...(user?{user:{...user,currency,currencyPreferenceSet:true}}:{}) })
    if (user) void api('/api/me', { method: 'PUT', json: { currency } }).catch(()=>get().refreshMe())
  },
  setLanguage: (language) => {
    const { user } = get()
    if(!user)try { localStorage.setItem('ts-guest-language-choice',language) } catch {}
    set({ language,...(user?{user:{...user,language,languagePreferenceSet:true}}:{}) })
    if (user) void api('/api/me', { method: 'PUT', json: { language } }).catch(()=>get().refreshMe())
  },
  setBooted: (booted) => set({ booted }),
  refreshMe: async () => {
    try {
      const data = await api<{ user: AuthUser | null; unreadNotifications: number; unreadMessages: number }>('/api/auth/me')
      set({
        user: data.user,
        unreadNotifications: data.unreadNotifications ?? 0,
        unreadMessages: data.unreadMessages ?? 0,
        currency: data.user?.currency ?? get().currency,
        language: data.user?.language ?? get().language,
      })
    } catch {
      // A temporary API/network failure must not discard a valid signed-in session.
      // A successful /api/auth/me response with user:null still clears expired sessions above.
    }
  },
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' })
    writeNavigation({ name: 'landing' }, true)
    set({ user: null, view: { name: 'landing' }, history: [], unreadNotifications: 0, unreadMessages: 0 })
  },
  fmt: (cents) => {
    const { currency, publicData } = get()
    const rate = publicData?.settings.fxRates?.[currency] ?? 1
    const converted = (cents / 100) * rate
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', GHS: '₵', IQD: ' ع.د ', TRY: '₺' }
    const symbol = symbols[currency] ?? '$'
    const decimals = currency === 'IQD' ? 0 : 2
    const amount = converted.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    return currency === 'IQD' ? `${amount}${symbol}` : `${symbol}${amount}`
  },
}))

// ---------- Shared UI helpers ----------
export const COUNTRY_OPTIONS = [
  'United States', 'United Kingdom', 'Canada', 'Spain', 'France', 'Germany', 'Italy', 'Turkey',
  'Egypt', 'Morocco', 'Iraq', 'Jordan', 'Ghana', 'Nigeria', 'Kenya', 'South Africa',
  'Brazil', 'Mexico', 'India', 'Pakistan', 'China', 'Japan', 'South Korea', 'Australia', 'Other',
]

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية (Arabic)' },
  { code: 'ku', label: 'کوردی (Kurdish Sorani)' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'fr', label: 'Français' },
]

export const RTL_LANGS = new Set(['ar', 'ku'])
