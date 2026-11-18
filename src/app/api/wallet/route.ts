import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, ok, fail } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import {effectivePreference,preferenceKey} from '@/lib/locale-preferences'

/** GET /api/wallet — balance, ledger history, lesson credits, payment providers status. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const settings = await getSettings()
    const [entries, payments, credits, bookings] = await Promise.all([
      db.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 }),
      db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 40 }),
      db.lessonCredit.findMany({
        where: { studentId: user.id },
        include: { package: { select: { name: true } },purchase:{select:{weeklyLessons:true,name:true,totalLessons:true,allowedTeacherIds:true,allowedGroupIds:true}} },
        orderBy: { createdAt: 'desc' },
      }),
      user.role === 'TUTOR'
        ? db.booking.findMany({ where: { tutorId: user.id, status: 'COMPLETED' }, select: { tutorNetCents: true, commissionCents: true, priceCents: true, completedAt: true } })
        : Promise.resolve([]),
    ])
    const providerStatus = Object.entries(settings.paymentProviders).map(([name, configured]) => ({
      name, configured,
      setup: configured ? null : `Requires ${name.charAt(0).toUpperCase() + name.slice(1)} API credentials in Admin → Settings.`,
    }))
    const gross = bookings.reduce((s, b) => s + b.priceCents, 0)
    const net = bookings.reduce((s, b) => s + b.tutorNetCents, 0)
    return ok({
      balanceCents: user.walletCents,
      currency: effectivePreference((await db.setting.findUnique({where:{key:preferenceKey(user.id,'currency')}}))?.value,settings.enabledCurrencies,settings.defaultCurrency),
      fxRates: settings.fxRates,
      entries:user.role==='STUDENT'?[]:entries,
      payments:user.role==='STUDENT'?[]:payments,
      credits: credits.map((c) => ({ ...c, expired: c.expiresAt ? c.expiresAt < new Date() : false })),
      providerStatus,
      tutorTotals: user.role === 'TUTOR' ? { grossCents: gross, netCents: net, commissionCents: gross - net } : null,
    })
  })
}

/** POST /api/wallet — top-up via configured external provider (requires admin credentials). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ amountCents?: number; method?: string }>(req)
    const settings = await getSettings()
    const method = (data.method ?? 'STRIPE').toUpperCase()
    if (method === 'WALLET' || method === 'ADMIN') return fail(400, 'Invalid top-up method')
    const configured = (settings.paymentProviders as Record<string, boolean>)[method.toLowerCase()]
    if (!configured) {
      return fail(501, `${method} is not configured on this platform yet. The administrator must add provider API credentials in Admin → Settings → Payment providers. Please contact support or use lesson packages purchased via wallet credits.`)
    }
    // With credentials present, this is where the provider SDK would create a
    // checkout session and a webhook would confirm it. Out of scope without keys.
    return fail(501, `${method} checkout requires server-side SDK credentials (secret key + webhook secret).`)
  })
}
