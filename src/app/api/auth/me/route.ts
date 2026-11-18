import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { getAuthUser } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import {preferenceKey,effectivePreference} from '@/lib/locale-preferences'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await getAuthUser(req)
    if (!user) return ok({ user: null })
    const settings=await getSettings()
    const preferences=await db.setting.findMany({where:{key:{in:[preferenceKey(user.id,'language'),preferenceKey(user.id,'currency')]}}})
    const preferenceMap=new Map(preferences.map(p=>[p.key,p.value]))
    const languageChoice=preferenceMap.get(preferenceKey(user.id,'language')),currencyChoice=preferenceMap.get(preferenceKey(user.id,'currency'))
    user.language=effectivePreference(languageChoice,settings.enabledLanguages,settings.defaultLanguage)
    user.currency=effectivePreference(currencyChoice,settings.enabledCurrencies,settings.defaultCurrency)
    const details=await db.user.findUnique({where:{id:user.id},select:{spokenLanguages:true}})
    const [unreadNotifications, unreadMessages] = await Promise.all([
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.message.count({
        where: {
          readAt: null,
          NOT: { senderId: user.id },
          conversation: { OR: [{ participantAId: user.id }, { participantBId: user.id }] },
        },
      }),
    ])
    const tutorProfile = user.role === 'TUTOR'
      ? await db.tutorProfile.findUnique({ where: { userId: user.id }, select: { id: true, status: true } })
      : null
    return ok({ user: { ...user,languagePreferenceSet:Boolean(languageChoice),currencyPreferenceSet:Boolean(currencyChoice),spokenLanguages:details?.spokenLanguages,tutorProfileId: tutorProfile?.id ?? null, tutorStatus: tutorProfile?.status ?? null }, unreadNotifications, unreadMessages })
  })
}
