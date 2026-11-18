import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { audit } from '@/lib/settings'

/** GET /api/admin/subjects */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const subjects = await db.subject.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tutors: true } } },
    })
    const archived=await db.setting.findMany({where:{key:{startsWith:'archived:subject:'}}});return ok({subjects:subjects.filter(s=>!archived.some(a=>a.key==='archived:subject:'+s.id))})
  })
}

/** POST — create subject. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const data = await body<{ name: string; category?: string; description?: string; icon?: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['name'])
    if(!data.name?.trim()||data.name.length>100)return fail(400,'Enter a subject name up to 100 characters')
    const slug = data.name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '')
    const subject = await db.subject.create({
      data: { name: data.name, slug, category: data.category ?? 'General', description: data.description ?? '', icon: data.icon ?? 'book-open' },
    })
    await audit(admin.id, 'SUBJECT_CREATE', 'subject', subject.id)
    return ok({ subject })
  })
}

/** PUT — update subject. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const data = await body<{ id: string; name?: string; category?: string; description?: string; icon?: string; active?: boolean }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['id'])
    const {id}=data
    if(data.name!==undefined&&(!data.name.trim()||data.name.length>100))return fail(400,'Enter a subject name up to 100 characters')
    const rest={...(data.name!==undefined?{name:data.name.trim()}:{}),...(data.category!==undefined?{category:data.category.slice(0,100)}:{}),...(data.description!==undefined?{description:data.description.slice(0,2000)}:{}),...(data.icon!==undefined?{icon:data.icon.slice(0,60)}:{}),...(typeof data.active==='boolean'?{active:data.active}:{})}
    const subject = await db.subject.update({ where: { id }, data: rest })
    await audit(admin.id, 'SUBJECT_UPDATE', 'subject', id)
    return ok({ subject })
  })
}

/** DELETE — soft-disable subject. */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return fail(400, 'id is required')
    const inUse = await db.tutorSubject.count({ where: { subjectId: id } })+await db.booking.count({where:{subjectId:id}})
    if (inUse > 0) {
      await db.subject.update({ where: { id }, data: { active: false } })
      await db.setting.upsert({where:{key:'archived:subject:'+id},create:{key:'archived:subject:'+id,value:'true'},update:{value:'true'}})
      await audit(admin.id,'SUBJECT_DELETE','subject',id)
      return ok({ ok: true, deactivated: true, message: 'Subject is in use by tutors — deactivated instead of deleted.' })
    }
    await db.subject.delete({ where: { id } })
    await audit(admin.id, 'SUBJECT_DELETE', 'subject', id)
    return ok({ ok: true })
  })
}
