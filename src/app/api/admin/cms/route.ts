import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { audit } from '@/lib/settings'

/** GET /api/admin/cms — pages, FAQs, testimonials, blog. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const [pages, faqs, testimonials, posts] = await Promise.all([
      db.cmsPage.findMany({ orderBy: { slug: 'asc' } }),
      db.faq.findMany({ orderBy: { order: 'asc' } }),
      db.testimonial.findMany({ orderBy: { id: 'asc' } }),
      db.blogPost.findMany({ orderBy: { createdAt: 'desc' } }),
    ])
    return ok({ pages, faqs, testimonials, posts })
  })
}

/** POST /api/admin/cms — create/update/delete CMS content by type. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const data = await body<{
      type: 'page' | 'faq' | 'testimonial' | 'post'
      op: 'create' | 'update' | 'delete'
      id?: string
      // page fields
      slug?: string; title?: string; content?: string; published?: boolean; showInFooter?: boolean
      // faq fields
      question?: string; answer?: string; order?: number
      // testimonial fields
      name?: string; role?: string; country?: string; rating?: number
      // post fields
      excerpt?: string
    }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['type', 'op'])

    if (data.type === 'page') {
      if(data.content!==undefined&&(typeof data.content!=='string'||data.content.length>300000))return fail(400,'Page content must be less than 300,000 characters')
      if (data.op === 'create') {
        requireFields(data as unknown as Record<string, unknown>, ['slug', 'title'])
        const page = await db.cmsPage.create({
          data: { slug: data.slug!.toLowerCase().replace(/[^a-z0-9-]+/g, '-'), title: data.title!, content: data.content ?? '', published: data.published ?? true, showInFooter: data.showInFooter ?? true },
        })
        return ok({ page })
      }
      requireFields(data as unknown as Record<string, unknown>, ['id'])
      if (data.op === 'update') {
        const page = await db.cmsPage.update({ where: { id: data.id }, data: { ...(data.title !== undefined ? { title: data.title } : {}), ...(data.content !== undefined ? { content: data.content } : {}), ...(data.published !== undefined ? { published: data.published } : {}), ...(data.showInFooter !== undefined ? { showInFooter: data.showInFooter } : {}) } })
        return ok({ page })
      }
      await db.cmsPage.delete({ where: { id: data.id } })
      return ok({ ok: true })
    }

    if (data.type === 'faq') {
      if (data.op === 'create') {
        requireFields(data as unknown as Record<string, unknown>, ['question', 'answer'])
        const faq = await db.faq.create({ data: { question: data.question!, answer: data.answer!, order: data.order ?? 99, published: true } })
        return ok({ faq })
      }
      requireFields(data as unknown as Record<string, unknown>, ['id'])
      if (data.op === 'update') {
        const faq = await db.faq.update({ where: { id: data.id }, data: { ...(data.question !== undefined ? { question: data.question } : {}), ...(data.answer !== undefined ? { answer: data.answer } : {}), ...(data.published !== undefined ? { published: data.published } : {}), ...(data.order !== undefined ? { order: data.order } : {}) } })
        return ok({ faq })
      }
      await db.faq.delete({ where: { id: data.id } })
      return ok({ ok: true })
    }

    if (data.type === 'testimonial') {
      if (data.op === 'create') {
        requireFields(data as unknown as Record<string, unknown>, ['name', 'content'])
        const t = await db.testimonial.create({ data: { name: data.name!, role: data.role ?? 'Student', country: data.country ?? null, content: data.content!, rating: data.rating ?? 5, published: true } })
        return ok({ testimonial: t })
      }
      requireFields(data as unknown as Record<string, unknown>, ['id'])
      if (data.op === 'update') {
        const t = await db.testimonial.update({ where: { id: data.id }, data: { ...(data.published !== undefined ? { published: data.published } : {}),...(data.name!==undefined?{name:data.name}:{}),...(data.content!==undefined?{content:data.content}:{}),...(data.role!==undefined?{role:data.role}:{}),...(data.country!==undefined?{country:data.country}:{}),...(data.rating!==undefined?{rating:Math.max(1,Math.min(5,Math.round(data.rating)))}:{}) } })
        return ok({ testimonial: t })
      }
      await db.testimonial.delete({ where: { id: data.id } })
      return ok({ ok: true })
    }

    // blog post
    if (data.op === 'create') {
      requireFields(data as unknown as Record<string, unknown>, ['title'])
      const post = await db.blogPost.create({
        data: {
          slug: (data.slug ?? data.title!).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          title: data.title!, excerpt: data.excerpt ?? '', content: data.content ?? '', published: data.published ?? false,
        },
      })
      return ok({ post })
    }
    requireFields(data as unknown as Record<string, unknown>, ['id'])
    if (data.op === 'update') {
      const post = await db.blogPost.update({ where: { id: data.id }, data: { ...(data.title !== undefined ? { title: data.title } : {}), ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}), ...(data.content !== undefined ? { content: data.content } : {}), ...(data.published !== undefined ? { published: data.published } : {}) } })
      return ok({ post })
    }
    await db.blogPost.delete({ where: { id: data.id } })
    await audit(admin.id, 'CMS_DELETE', 'blogPost', data.id)
    return ok({ ok: true })
  })
}
