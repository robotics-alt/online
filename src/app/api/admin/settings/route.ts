import { NextRequest } from 'next/server'
import { handle, body, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { getSettings, saveSettings, audit } from '@/lib/settings'
import type { PlatformSettings } from '@/lib/settings'
import type { AdminSettingsResponse } from '@/lib/admin-settings-contract'

/** GET /api/admin/settings — full platform settings incl. integration status. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const settings = await getSettings()
    const response: AdminSettingsResponse = {
      settings,
      integrations: {
        video: {
          provider: settings.videoProvider,
          status: 'active',
          note: 'Built-in WebRTC peer-to-peer classroom via the socket.io signaling service — no external credentials required. To switch to LiveKit/Daily/Agora, deploy their server/keys and update this provider field.',
        },
        payments: Object.entries(settings.paymentProviders).map(([name, enabled]) => ({
          name, enabled,
          requiredCredentials: name === 'stripe' ? ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
            : name === 'paypal' ? ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET']
            : name === 'paystack' ? ['PAYSTACK_SECRET_KEY']
            : name === 'flutterwave' ? ['FLUTTERWAVE_SECRET_KEY'] : [],
        })),
        email: {
          smtpConfigured: Boolean(process.env.SMTP_HOST),
          note: 'Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to enable email delivery. Until then, password-reset tokens are returned by the API and notifications are in-app only.',
        },
        oauth: {
          google: Boolean(process.env.GOOGLE_CLIENT_ID),
          note: 'Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET to enable Google sign-in.',
        },
      },
    }
    return ok(response)
  })
}

/** PUT /api/admin/settings — update platform settings. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const patch = await body<Partial<PlatformSettings>>(req)
    const next = await saveSettings(patch)
    await audit(admin.id, 'SETTINGS_UPDATE', 'settings', undefined, patch as object)
    return ok({ settings: next })
  })
}
