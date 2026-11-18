import { NextRequest } from 'next/server'
import { db } from './db'
import { createHash, randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'
import type { Role } from '@prisma/client'

// ---------- Password hashing (scrypt, no external deps) ----------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const candidate = scryptSync(password, salt, 64)
    return timingSafeEqual(candidate, Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

// ---------- Session tokens ----------
const SESSION_SECRET = process.env.SESSION_SECRET || 'tutorsphere-dev-secret-change-in-production'
export const SESSION_COOKIE = 'ts_session'

export function newSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHmac('sha256', SESSION_SECRET).update(token).digest('hex')
}

export async function createSession(userId: string, ip?: string, userAgent?: string) {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days
  await db.session.create({
    data: { token: hashToken(token), userId, ip, userAgent, expiresAt },
  })
  return { token, expiresAt }
}

export function signPayload(payload: object, ttlMs = 1000 * 60 * 60 * 2): string {
  const body = { ...payload, exp: Date.now() + ttlMs }
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyPayload<T = Record<string, unknown>>(signed: string): T | null {
  try {
    const [data, sig] = signed.split('.')
    const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
    if (sig !== expected) return null
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) return null
    return parsed as T
  } catch {
    return null
  }
}

// ---------- Request auth ----------
export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  status: string
  avatarUrl: string | null
  country: string | null
  timezone: string
  currency: string
  language: string
  walletCents: number
  onboarded: boolean
  emailVerified: boolean
}

export function getSessionToken(req: NextRequest): string | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (cookie) return cookie
  const header = req.headers.get('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getSessionToken(req)
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  const u = session.user
  if (u.status !== 'ACTIVE') return null
  return {
    id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
    avatarUrl: u.avatarUrl, country: u.country, timezone: u.timezone,
    currency: u.currency, language: u.language, walletCents: u.walletCents,
    onboarded: u.onboarded, emailVerified: u.emailVerified,
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function requireUser(req: NextRequest, roles?: Role[]): Promise<AuthUser> {
  const user = await getAuthUser(req)
  if (!user) throw new ApiError(401, 'Authentication required')
  if (roles && !roles.includes(user.role)) throw new ApiError(403, 'Insufficient permissions')
  return user
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  return requireUser(req, ['ADMIN', 'SUPPORT'])
}
