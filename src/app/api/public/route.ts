import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'

/** GET — public landing content: settings, subjects, testimonials, faqs, stats, featured tutors. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const settings = await getSettings()
    const hiddenCategories=await db.subjectCategory.findMany({where:{active:false}})
    const [subjects, testimonials, faqs, cmsPages] = await Promise.all([
      db.subject.findMany({ where: { active: true,category:{notIn:hiddenCategories.map(c=>c.name)} }, orderBy: { name: 'asc' } }),
      db.testimonial.findMany({ where: { published: true }, orderBy: { id: 'asc' }, take: 8 }),
      db.faq.findMany({ where: { published: true }, orderBy: { order: 'asc' } }),
      db.cmsPage.findMany({ where: { published: true, showInFooter: true }, select: { slug: true, title: true } }),
    ])
    const [studentCount, tutorCount, lessonCount] = await Promise.all([
      db.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      db.tutorProfile.count({ where: { status: 'APPROVED',user:{status:'ACTIVE'} } }),
      db.booking.count({ where: { status: 'COMPLETED' } }),
    ])
    const featured = await db.tutorProfile.findMany({
      where: { status: 'APPROVED',user:{status:'ACTIVE'}, ...(settings.marketing.featuredMode==='manual'?{id:{in:settings.marketing.featuredTeacherIds}}:{}) },
      orderBy: [{ lessonsCompleted: 'desc' }],
      take: 8,
      include: {
        user: { select: { name: true, country: true, avatarUrl: true, timezone: true } },
        subjects: { include: { subject: { select: { name: true, slug: true } } } },
      },
    })
    const publicTutors = featured.map((t) => ({
      id: t.id,
      name: t.user.name,
      country: t.user.country,
      avatarUrl: t.user.avatarUrl,
      timezone: t.user.timezone,
      headline: t.headline,
      about: t.headline,
      hourlyRateCents: t.hourlyRateCents, trialRateCents: t.trialRateCents,
      rating: t.reviewCount > 0 ? Math.round((t.ratingSum / t.reviewCount) * 10) / 10 : null,
      reviewCount: t.reviewCount, lessonsCompleted: t.lessonsCompleted, studentsCount: t.studentsCount,
      languages: t.languages, identityVerified: t.identityVerified,
      subjects: t.subjects.map((ts) => ({ name: ts.subject.name, slug: ts.subject.slug })),
    }))
    return ok({
      settings: {
        logoUrl:settings.logoUrl,iconUrl:settings.iconUrl,supportPhone:settings.supportPhone,translations:settings.translations,
        minimumHourlyRateCents:(await db.tutorProfile.aggregate({where:{status:'APPROVED',user:{status:'ACTIVE'}},_min:{hourlyRateCents:true}}))._min.hourlyRateCents,
        platformName: settings.platformName, tagline: settings.tagline, heroTitle: settings.heroTitle,
        heroSubtitle: settings.heroSubtitle, contactEmail: settings.contactEmail,
        defaultCurrency: settings.defaultCurrency, fxRates: settings.fxRates,
        defaultLanguage: settings.defaultLanguage, enabledLanguages: settings.enabledLanguages, enabledCurrencies:settings.enabledCurrencies, typography: settings.typography,
        marketing: settings.marketing,
        branding:settings.branding,
        trialLessonEnabled: settings.trialLessonEnabled,
      },
      subjects, testimonials, faqs, cmsPages,
      stats: { students: studentCount, tutors: tutorCount, lessons: lessonCount,countries:(await db.user.groupBy({by:['country'],where:{status:'ACTIVE',country:{not:null}}})).filter(r=>r.country?.trim()).length },
      featuredTutors: settings.marketing.featuredMode==='manual'?publicTutors.sort((a,b)=>settings.marketing.featuredTeacherIds.indexOf(a.id)-settings.marketing.featuredTeacherIds.indexOf(b.id)):publicTutors,
    })
  })
}
