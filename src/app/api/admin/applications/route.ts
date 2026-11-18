import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { notify, audit } from '@/lib/settings'

/** GET /api/admin/applications — tutor applications by status. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const status = req.nextUrl.searchParams.get('status') ?? 'PENDING'
    const applications = await db.tutorProfile.findMany({
      where: { status: status as 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, country: true, createdAt: true } },
        subjects: { include: { subject: { select: { name: true } } } },
        verifications: true,
        rules: true,
      },
    })
    return ok({ applications })
  })
}

/** POST /api/admin/applications — approve / reject / request changes. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const data = await body<{ tutorProfileId: string; action: 'approve' | 'reject' | 'request_changes'; reason?: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['tutorProfileId', 'action'])
    const profile = await db.tutorProfile.findUnique({ where: { id: data.tutorProfileId }, include: { user: true } })
    if (!profile) return fail(404, 'Application not found')

    if (data.action === 'approve') {
      await db.tutorProfile.update({ where: { id: profile.id }, data: { status: 'APPROVED' } })
      await notify(profile.userId, 'tutor', 'Application approved! 🎉', 'Your tutor profile is now live. Students can find and book you.', 'profile')
      await audit(admin.id, 'TUTOR_APPROVE', 'tutorProfile', profile.id)
    } else if (data.action === 'reject') {
      await db.tutorProfile.update({ where: { id: profile.id }, data: { status: 'REJECTED', rejectionReason: data.reason ?? 'Does not meet platform requirements.' } })
      await notify(profile.userId, 'tutor', 'Application rejected', data.reason || 'Your application was rejected. You can update your profile and reapply.', 'profile')
      await audit(admin.id, 'TUTOR_REJECT', 'tutorProfile', profile.id, { reason: data.reason })
    } else {
      await db.tutorProfile.update({ where: { id: profile.id }, data: { status: 'DRAFT', rejectionReason: data.reason ?? 'Changes requested.' } })
      await notify(profile.userId, 'tutor', 'Changes requested', data.reason || 'Please update your profile and resubmit your application.', 'profile')
      await audit(admin.id, 'TUTOR_REQUEST_CHANGES', 'tutorProfile', profile.id, { reason: data.reason })
    }
    return ok({ ok: true })
  })
}
