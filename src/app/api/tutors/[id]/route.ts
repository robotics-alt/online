import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'
import { getAuthUser } from '@/lib/auth'

/** GET /api/tutors/:id — public tutor profile (id = TutorProfile.id). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const tutor = await db.tutorProfile.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, country: true, avatarUrl: true, timezone: true, createdAt: true } },
        subjects: { include: { subject: { select: { id: true, name: true, slug: true, category: true } } } },
      },
    })
    if (!tutor || (tutor.status !== 'APPROVED' && tutor.status !== 'SUSPENDED')) {
      return fail(404, 'Tutor not found')
    }
    const reviews = await db.review.findMany({
      where: { tutorId: id, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { student: { select: { name: true, country: true } } },
    })
    const viewer = await getAuthUser(req)
    let favorited = false
    void favorited // favorites are stored client-side in this build
    await db.tutorProfile.update({ where: { id }, data: { profileViews: { increment: 1 } } }).catch(() => null)

    return ok({
      tutor: {
        id: tutor.id,
        userId: tutor.userId,
        name: tutor.user.name,
        country: tutor.user.country,
        avatarUrl: tutor.user.avatarUrl,
        timezone: tutor.user.timezone,
        memberSince: tutor.user.createdAt,
        headline: tutor.headline,
        about: tutor.about,
        experience: tutor.experience,
        languageItems:tutor.languageItems,
        experienceItems:JSON.stringify(JSON.parse(tutor.experienceItems).map(({certificateId,...entry}: {certificateId?:string;[key:string]:unknown})=>entry)),
        skillItems:JSON.stringify(JSON.parse(tutor.skillItems).map(({certificateId,...entry}: {certificateId?:string;[key:string]:unknown})=>entry)),
        education: tutor.education,
        certifications: tutor.certifications,
        methodology: tutor.methodology,
        languages: tutor.languages,
        nativeLanguage: tutor.nativeLanguage,
        yearsExperience: tutor.yearsExperience,
        hourlyRateCents: tutor.hourlyRateCents,
        trialRateCents: 0,
        onlineEnabled: tutor.onlineEnabled,
        faceToFaceEnabled: tutor.faceToFaceEnabled,
        rating: tutor.reviewCount > 0 ? Math.round((tutor.ratingSum / tutor.reviewCount) * 10) / 10 : null,
        reviewCount: tutor.reviewCount,
        lessonsCompleted: tutor.lessonsCompleted,
        studentsCount: tutor.studentsCount,
        identityVerified: tutor.identityVerified,
        videoUrl: tutor.videoUrl,
        subjects: tutor.subjects.map((ts) => ts.subject),
      },
      reviews: reviews.map((r) => ({
        editedAt:r.editedAt, id: r.id, rating: r.rating, comment: r.comment, response: r.response, createdAt: r.createdAt,
        student: { name: r.student.name, country: r.student.country },
      })),
      viewerIsStudent: viewer?.role === 'STUDENT',
    })
  })
}
