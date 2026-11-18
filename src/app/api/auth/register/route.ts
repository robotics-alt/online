import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail } from '@/lib/api'
import { hashPassword, createSession, SESSION_COOKIE } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { Prisma } from '@prisma/client'
import { normalizeLanguages } from '@/lib/profile-data'
import { timezoneForCountry } from '@/lib/country-timezones'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  return handle(async () => {
    const settings = await getSettings()
    if (!settings.allowRegistrations) return fail(403, 'Registrations are currently disabled')
    const data = await body<{ email: string; password: string; name: string; role?: string; country?: string; timezone?: string; spokenLanguages?:unknown;avatarData?:string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['email', 'password', 'name'])
    if (!EMAIL_RE.test(data.email)) return fail(400, 'Please enter a valid email address')
    if (data.password.length < 8) return fail(400, 'Password must be at least 8 characters')
    if (data.name.trim().length < 2) return fail(400, 'Please enter your full name')
    if(typeof data.avatarData!=='string'||data.avatarData.length>250000||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(data.avatarData))return fail(400,'Add a profile photo to continue')
    let avatarUrl:string
    try{const bytes=Buffer.from(data.avatarData.split(',')[1],'base64');const photo=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize(384,384,{fit:'cover'}).webp({quality:72}).toBuffer();if(photo.length>150000)return fail(400,'Choose a smaller profile photo');avatarUrl='data:image/webp;base64,'+photo.toString('base64')}catch{return fail(400,'This profile photo could not be read')}
    const role = data.role === 'TUTOR' ? 'TUTOR' : 'STUDENT'
    let spokenLanguages
    try{spokenLanguages=normalizeLanguages(data.spokenLanguages ?? [{name:'English',level:'B1 · Intermediate'}])}catch(error){return fail(400,(error as Error).message)}
    const timezone=timezoneForCountry(data.country || '',data.timezone || 'UTC')
    try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format()}catch{return fail(400,'Choose a valid country and timezone')}

    try {
      const user = await db.user.create({
        data: {
          email: data.email.toLowerCase().trim(),
          passwordHash: hashPassword(data.password),
          name: data.name.trim(),
          role,avatarUrl,
          country: data.country || null,
          timezone,
          language: settings.defaultLanguage, currency: settings.defaultCurrency,
          spokenLanguages: JSON.stringify(spokenLanguages),
          walletCents:role==='STUDENT'?settings.registrationWalletCents:0,
          ledgerEntries:role==='STUDENT'&&settings.registrationWalletCents>0?{create:{type:'ADJUSTMENT',fundingSource:'PROMOTIONAL',amountCents:settings.registrationWalletCents,balanceAfterCents:settings.registrationWalletCents,refType:'WELCOME',description:'Registration welcome credit'}}:undefined,
          notificationPrefs: { create: {} },
          studentProfile: role === 'STUDENT' ? { create: {} } : undefined,
          tutorProfile: role === 'TUTOR' ? { create: { status: 'DRAFT',languageItems:JSON.stringify(spokenLanguages),languages:spokenLanguages.map(item=>item.name).join(', ') } } : undefined,
        },
      })
      const { token } = await createSession(user.id, req.headers.get('x-forwarded-for') ?? undefined, req.headers.get('user-agent') ?? undefined)
      const res = NextResponse.json({ ok: true, userId: user.id, role, needsVerification: true, message: 'Email verification is not configured (no SMTP). You can use the platform normally.' })
      res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
      return res
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return fail(409, 'An account with this email already exists')
      }
      throw e
    }
  })
}
