import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, fail, ok } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params
    const page = await db.cmsPage.findUnique({ where: { slug } })
    if (!page || !page.published) return fail(404, 'Page not found')
    return ok({ page })
  })
}
