import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, fail, ok } from '@/lib/api'
import { requireUser, hashPassword, verifyPassword } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { normalizeLanguages } from '@/lib/profile-data'
import { timezoneForCountry } from '@/lib/country-timezones'
import {preferenceKey} from '@/lib/locale-preferences'

/** PUT — update profile / preferences / password. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser(req)
    const data = await body<{
      name?: string; avatarUrl?: string; country?: string; timezone?: string
      currency?: string; language?: string;usePlatformDefaults?:boolean
      spokenLanguages?:unknown
      currentPassword?: string; newPassword?: string
      studyHours?:{day:number;hours:number}[];interests?:string;
      level?: string; goal?: string; preferredLanguage?: string; budgetCents?: number; availability?: string
    }>(req)

    if(data.budgetCents!==undefined){const minimum=(await db.tutorProfile.aggregate({where:{status:'APPROVED',user:{status:'ACTIVE'}},_min:{hourlyRateCents:true}}))._min.hourlyRateCents??100;if(!Number.isInteger(data.budgetCents)||data.budgetCents<minimum||data.budgetCents>10000000)return fail(400,'Your hourly budget must be at least '+(minimum/100).toFixed(2)+' USD')}
    if(data.studyHours!==undefined&&(!Array.isArray(data.studyHours)||!data.studyHours.length||data.studyHours.length>7||new Set(data.studyHours.map(r=>r.day)).size!==data.studyHours.length||data.studyHours.some(r=>!Number.isInteger(r.day)||r.day<0||r.day>6||!Number.isFinite(r.hours)||r.hours<.5||r.hours>12)))return fail(400,'Choose study days and between 0.5 and 12 hours per day')
    const userUpdate: Record<string, unknown> = {}
    const settings=await getSettings()
    if(data.currency !== undefined && !settings.enabledCurrencies.includes(data.currency))return fail(400,'This currency is disabled')
    if(data.language !== undefined && !settings.enabledLanguages.includes(data.language))return fail(400,'This interface language is disabled')
    if(data.spokenLanguages !== undefined){if(auth.role==='TUTOR')return fail(400,'Submit teacher language changes from your professional profile for approval');try{userUpdate.spokenLanguages=JSON.stringify(normalizeLanguages(data.spokenLanguages))}catch(error){return fail(400,(error as Error).message)}}
    if(data.country !== undefined && data.timezone === undefined)userUpdate.timezone=timezoneForCountry(data.country,auth.timezone)
    if (data.name !== undefined) {
      if (data.name.trim().length < 2) return fail(400, 'Name is too short')
      userUpdate.name = data.name.trim()
    }
    if (data.avatarUrl !== undefined) userUpdate.avatarUrl = data.avatarUrl || null
    if (data.country !== undefined) userUpdate.country = data.country || null
    if (data.timezone !== undefined) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: data.timezone }).format() }
      catch { return fail(400, 'Choose a valid timezone') }
      userUpdate.timezone = data.timezone
    }
    if (data.currency !== undefined) userUpdate.currency = data.currency
    if (data.language !== undefined) userUpdate.language = data.language
    if (data.newPassword !== undefined) {
      if (data.newPassword.length < 8) return fail(400, 'New password must be at least 8 characters')
      const full = await db.user.findUnique({ where: { id: auth.id } })
      if (!full) return fail(404, 'User not found')
      if (!verifyPassword(data.currentPassword ?? '', full.passwordHash)) {
        return fail(400, 'Current password is incorrect')
      }
      userUpdate.passwordHash = hashPassword(data.newPassword)
    }
    await db.$transaction(async tx=>{
      if (Object.keys(userUpdate).length > 0) await tx.user.update({ where: { id: auth.id }, data: userUpdate })
      for(const kind of ['language','currency'] as const){const value=data[kind];if(value!==undefined)await tx.setting.upsert({where:{key:preferenceKey(auth.id,kind)},create:{key:preferenceKey(auth.id,kind),value},update:{value}})}
      if(data.usePlatformDefaults)await tx.setting.deleteMany({where:{key:{in:[preferenceKey(auth.id,'language'),preferenceKey(auth.id,'currency')]}}})
    })

    if (auth.role === 'STUDENT' && (data.level !== undefined || data.goal !== undefined || data.preferredLanguage !== undefined || data.budgetCents !== undefined || data.availability !== undefined||data.studyHours!==undefined||data.interests!==undefined)) {
      const sp: Record<string, unknown> = {}
      if(data.studyHours!==undefined)sp.availability=JSON.stringify(data.studyHours)
      if(data.interests!==undefined)sp.interests=String(data.interests).slice(0,1000)
      if (data.level !== undefined) sp.level = data.level
      if (data.goal !== undefined) sp.goal = data.goal
      if (data.preferredLanguage !== undefined) sp.preferredLanguage = data.preferredLanguage
      if (data.budgetCents !== undefined) sp.budgetCents = data.budgetCents
      if (data.availability !== undefined) sp.availability = data.availability
      await db.studentProfile.upsert({
        where: { userId: auth.id },
        update: sp,
        create: { userId: auth.id, ...sp },
      })
    }

    if(auth.role==='STUDENT'&&data.studyHours?.length&&data.budgetCents!==undefined)await db.user.update({where:{id:auth.id},data:{onboarded:true}})
    return ok({ ok: true })
  })
}

/** DELETE — account deletion (GDPR-style). */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser(req)
    if (auth.role === 'ADMIN') return fail(403, 'Admin accounts cannot be self-deleted')
    await db.session.deleteMany({ where: { userId: auth.id } })
    await db.user.update({ where: { id: auth.id }, data: { status: 'SUSPENDED', email: `deleted+${auth.id}@tutorsphere.invalid`, name: 'Deleted User' } })
    return ok({ ok: true })
  })
}
