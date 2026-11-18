import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, ok } from '@/lib/api'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const withCounts = req.nextUrl.searchParams.get('withCounts') === '1'
    const hiddenCategories=await db.subjectCategory.findMany({where:{active:false}})
    const subjects = await db.subject.findMany({
      where: { active: true,category:{notIn:hiddenCategories.map(c=>c.name)} },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: withCounts ? { _count: { select: { tutors: { where: { tutor: { status: 'APPROVED' } } } } } } : undefined,
    })
    return ok({ subjects })
  })
}
