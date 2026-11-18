import { db } from '@/lib/db'
import{normalizeMarketing,type MarketingConfig}from'./marketing-config'
import{DEFAULT_BRAND,type BrandColours}from'./brand-colours'

export interface PlatformSettings {
  logoUrl: string
  iconUrl: string
  supportPhone: string
  translations: Record<string,Record<string,string>>
  platformName: string
  tagline: string
  heroTitle: string
  heroSubtitle: string
  contactEmail: string
  defaultCurrency: string
  defaultLanguage: string
  registrationWalletCents:number
  marketing:MarketingConfig
  branding:BrandColours
  enabledLanguages: string[]
  enabledCurrencies: string[]
  typography: Record<string,{font:string;size:number}>
  commissionPercent: number
  trialLessonEnabled: boolean
  trialCommissionPercent: number
  minCancelNoticeHours: number
  bookingNoticeHours: number
  bookingHorizonDays: number
  slotDurationMin: number
  payoutMinCents: number
  maintenanceMode: boolean
  allowRegistrations: boolean
  fxRates: Record<string, number>
  paymentProviders: { stripe: boolean; paypal: boolean; paystack: boolean; flutterwave: boolean }
  videoProvider: string
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  logoUrl: '', iconUrl: '', supportPhone:'', translations:{},
  platformName: 'TutorSphere',
  tagline: 'Learn Anything. From Anywhere.',
  heroTitle: 'Learn Anything. From Anywhere. With the Right Tutor.',
  heroSubtitle: 'Connect with expert tutors worldwide for personalized, interactive online lessons.',
  contactEmail: 'support@tutorsphere.app',
  defaultCurrency: 'USD',
  defaultLanguage: 'en',
  registrationWalletCents:0,
  marketing:normalizeMarketing(undefined),
  branding:DEFAULT_BRAND,
  enabledLanguages: ['en','ar','ku','tr','fr'],
  enabledCurrencies: ['USD','EUR','GBP','GHS','IQD','TRY'],
  typography: {},
  commissionPercent: 20,
  trialLessonEnabled: true,
  trialCommissionPercent: 25,
  minCancelNoticeHours: 12,
  bookingNoticeHours: 2,
  bookingHorizonDays: 30,
  slotDurationMin: 60,
  payoutMinCents: 2000,
  maintenanceMode: false,
  allowRegistrations: true,
  fxRates: { USD: 1, EUR: 0.92, GBP: 0.79, GHS: 15.4, IQD: 1310, TRY: 34.5 },
  paymentProviders: { stripe: false, paypal: false, paystack: false, flutterwave: false },
  videoProvider: 'builtin-webrtc',
}

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await db.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const settings: PlatformSettings = { ...DEFAULT_SETTINGS }
  try {
    if (map['platform']) { const saved=JSON.parse(map['platform']); return { ...DEFAULT_SETTINGS, ...saved, marketing:normalizeMarketing(saved.marketing) } }
  } catch {
    // fall through to defaults
  }
  void map
  return settings
}

export async function saveSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  if(!next.branding||!/^#[0-9a-f]{6}$/i.test(next.branding.primary)||!/^#[0-9a-f]{6}$/i.test(next.branding.secondary)||typeof next.branding.allowPersonalAccents!=='boolean')throw Object.assign(new Error('Choose valid primary and secondary colours'),{status:400})
  if(typeof next.platformName!=='string'||!next.platformName.trim()||next.platformName.length>80)throw Object.assign(new Error('Enter a platform name up to 80 characters'),{status:400})
  for(const url of [next.logoUrl,next.iconUrl])if(typeof url!=='string'||url&&!/^\/api\/media\/[a-zA-Z0-9_-]+$/.test(url))throw Object.assign(new Error('Upload a platform logo or icon'),{status:400})
  if(typeof next.supportPhone!=='string'||next.supportPhone.length>50)throw Object.assign(new Error('Use a support phone up to 50 characters'),{status:400})
  if(!next.translations||Array.isArray(next.translations)||typeof next.translations!=='object')throw Object.assign(new Error('Use a translation dictionary'),{status:400})
  for(const [lang,entries] of Object.entries(next.translations)){if(!['en','ar','ku','tr','fr'].includes(lang)||!entries||Array.isArray(entries)||typeof entries!=='object'||Object.keys(entries).length>10000)throw Object.assign(new Error('Invalid translation language or dictionary'),{status:400});for(const [key,value]of Object.entries(entries))if(!/^[a-zA-Z][a-zA-Z0-9_.-]{0,100}$/.test(key)||typeof value!=='string'||value.length>2000)throw Object.assign(new Error('Use valid translation keys and text up to 2000 characters'),{status:400})}
  next.marketing=normalizeMarketing(next.marketing)
  if(!Number.isInteger(next.registrationWalletCents)||next.registrationWalletCents<0||next.registrationWalletCents>1000000)throw Object.assign(new Error('Choose registration wallet credit between 0 and 10,000 USD'),{status:400})
  const m=next.marketing
  if(!['auto','manual'].includes(m.featuredMode)||!Array.isArray(m.featuredTeacherIds)||m.featuredTeacherIds.length>30||!Array.isArray(m.gameIds)||m.gameIds.length>30||!Array.isArray(m.slides)||m.slides.length>12)throw Object.assign(new Error('Choose valid homepage selections'),{status:400})
  for(const stat of Object.values(m.statistics))if(!stat||typeof stat.enabled!=='boolean'||!['auto','manual'].includes(stat.mode)||!Number.isInteger(stat.value)||stat.value<0||stat.value>1000000000||typeof stat.label!=='string'||stat.label.length>70)throw Object.assign(new Error('Use valid statistic labels and non-negative whole numbers'),{status:400})
  for(const slide of m.slides)if(slide.imageId&&!/^[a-zA-Z0-9_-]{1,100}$/.test(slide.imageId)||!slide.id||typeof slide.active!=='boolean'||typeof slide.title!=='string'||slide.title.length>180||typeof slide.subtitle!=='string'||slide.subtitle.length>1000||typeof slide.buttonText!=='string'||slide.buttonText.length>80||!['search','tutor','classes','packages','games'].includes(slide.destination))throw Object.assign(new Error('Complete each slider title, text and destination'),{status:400})
  const bad=(message:string)=>{throw Object.assign(new Error(message),{status:400})}
  if(!Array.isArray(next.enabledLanguages) || !next.enabledLanguages.length || next.enabledLanguages.some(code=>!['en','ar','ku','tr','fr'].includes(code)))bad('Enable at least one supported interface language')
  if(!Array.isArray(next.enabledCurrencies) || !next.enabledCurrencies.length || next.enabledCurrencies.some(code=>!['USD','EUR','GBP','GHS','IQD','TRY'].includes(code)))bad('Enable at least one supported currency')
  if(!next.enabledLanguages.includes(next.defaultLanguage))bad('The default language must remain enabled')
  if(!next.enabledCurrencies.includes(next.defaultCurrency))bad('The default currency must remain enabled')
  if(!next.typography || typeof next.typography !== 'object' || Array.isArray(next.typography))bad('Choose valid typography settings')
  for(const [language,rule] of Object.entries(next.typography))if(!['en','ar','ku','tr','fr'].includes(language) || !['system','Arial','Tahoma','Georgia','Trebuchet MS','Verdana'].includes(rule.font) || !Number.isFinite(rule.size) || rule.size<14 || rule.size>24)bad('Choose a supported font and a size between 14 and 24')
  await db.setting.upsert({
    where: { key: 'platform' },
    update: { value: JSON.stringify(next) },
    create: { key: 'platform', value: JSON.stringify(next) },
  })
  return next
}

export async function notify(userId: string, type: string, title: string, bodyText = '', link?: string) {
  try {
    const prefs = await db.notificationPrefs.findUnique({ where: { userId } })
    if (prefs && !prefs.inApp) return
    await db.notification.create({ data: { userId, type, title, body: bodyText, link } })
  } catch (e) {
    console.error('[notify]', e)
  }
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: object) {
  try {
    await db.auditLog.create({
      data: { actorId, action, entity, entityId, meta: JSON.stringify(meta ?? {}) },
    })
  } catch (e) {
    console.error('[audit]', e)
  }
}

/** Apply a signed amount to a user's wallet inside a transaction, writing a ledger entry. */
export async function walletAdjust(
  tx: PrismaTx,
  userId: string,
  type: 'TOPUP' | 'SPEND' | 'REFUND' | 'EARNING' | 'PAYOUT' | 'ADJUSTMENT' | 'BONUS' | 'PACKAGE',
  amountCents: number,
  description: string,
  refType?: string,
  refId?: string,
) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { walletCents: true } })
  if (!user) throw new Error('User not found')
  const balanceAfter = user.walletCents + amountCents
  if (balanceAfter < 0) throw new Error('Insufficient balance')
  await tx.user.update({ where: { id: userId }, data: { walletCents: balanceAfter } })
  await tx.ledgerEntry.create({
    data: { userId, type, amountCents, balanceAfterCents: balanceAfter, description, refType, refId },
  })
  return balanceAfter
}

type PrismaTx = Parameters<Parameters<typeof db.$transaction>[0]>[0]
export type { PrismaTx }
