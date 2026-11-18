import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 12

/** GET /api/tutors — marketplace search. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const q = sp.get('q')?.trim() ?? ''
    const subject = sp.get('subject') ?? ''
    const country = sp.get('country') ?? ''
    const language = sp.get('language') ?? ''
    const priceMin = Number(sp.get('priceMin') ?? 0)
    const priceMax = Number(sp.get('priceMax') ?? 100000)
    const minRating = Number(sp.get('minRating') ?? 0)
    const minExperience = Number(sp.get('minExperience') ?? 0)
    const trialOnly = sp.get('trial') === '1'
    const sort = sp.get('sort') ?? 'relevance'

    const where: Prisma.TutorProfileWhereInput = {
      status: 'APPROVED',
      hourlyRateCents: { gte: priceMin, lte: priceMax },
      ...(minExperience > 0 ? { yearsExperience: { gte: minExperience } } : {}),
      user:{status:'ACTIVE',...(country?{country}:{})},
      ...(language ? { languages: { contains: language } } : {}),
      ...(subject ? { subjects: { some: { subject: { slug: subject } } } } : {}),
      ...(q
        ? {
            OR: [
              { headline: { contains: q } },
              { about: { contains: q } },
              { user: { name: { contains: q } } },
            ],
          }
        : {}),
    }

    const orderBy: Prisma.TutorProfileOrderByWithRelationInput[] =
      sort === 'price_asc' ? [{ hourlyRateCents: 'asc' }]
      : sort === 'price_desc' ? [{ hourlyRateCents: 'desc' }]
      : sort === 'rating' ? [{ reviewCount: 'desc' }, { ratingSum: 'desc' }]
      : sort === 'lessons' ? [{ lessonsCompleted: 'desc' }]
      : [{ lessonsCompleted: 'desc' }, { ratingSum: 'desc' }]

    const [total, rows] = await Promise.all([
      db.tutorProfile.count({ where }),
      db.tutorProfile.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          user: { select: { name: true, country: true, avatarUrl: true, timezone: true } },
          subjects: { include: { subject: { select: { name: true, slug: true } } } },
        },
      }),
    ])

    const tutors = rows
      .map((t) => ({
        id: t.id,
        name: t.user.name,
        country: t.user.country,
        avatarUrl: t.user.avatarUrl,
        timezone: t.user.timezone,
        headline: t.headline,
        about: t.about,
        hourlyRateCents: t.hourlyRateCents,
        trialRateCents: 0,
        rating: t.reviewCount > 0 ? Math.round((t.ratingSum / t.reviewCount) * 10) / 10 : null,
        reviewCount: t.reviewCount,
        lessonsCompleted: t.lessonsCompleted,
        studentsCount: t.studentsCount,
        yearsExperience: t.yearsExperience,
        languages: t.languages,
        identityVerified: t.identityVerified,
        subjects: t.subjects.map((ts) => ({ name: ts.subject.name, slug: ts.subject.slug })),
      }))
      .filter((t) => (minRating > 0 ? (t.rating ?? 0) >= minRating : true))

    return ok({ tutors, total, page, pages: Math.ceil(total / PAGE_SIZE) })
  })
}
