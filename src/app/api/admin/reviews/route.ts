import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { audit } from '@/lib/settings'

/** GET /api/admin/reviews — all reviews for moderation. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin(req)
    const reviews = await db.review.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { name: true, email: true } },
        tutor: { include: { user: { select: { name: true } } } },
        booking: { select: { startUtc: true } },
      },
    })
    return ok({ reviews })
  })
}

/** POST /api/admin/reviews — hide/show or delete a review; tutor response is via tutor APIs. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin(req)
    const data = await body<{ reviewId: string; action: 'hide' | 'publish' | 'delete' | 'edit';rating?:number;comment?:string;status?:string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['reviewId', 'action'])
    const review = await db.review.findUnique({ where: { id: data.reviewId } })
    if (!review) return fail(404, 'Review not found')

    if(data.action==='edit'){
      if(!Number.isInteger(data.rating)||data.rating!<1||data.rating!>5||typeof data.comment!=='string'||data.comment.length>5000||!['HIDDEN','PUBLISHED'].includes(data.status||''))return fail(400,'Choose a rating from 1 to 5, text up to 5000 characters and visibility')
      await db.$transaction(async tx=>{const original=await tx.review.findUniqueOrThrow({where:{id:review.id}});await tx.review.update({where:{id:review.id},data:{rating:data.rating,comment:data.comment,status:data.status,editedAt:new Date(),editedBy:admin.id,originalRating:original.originalRating??original.rating,originalComment:original.originalComment??original.comment}});await tx.tutorProfile.update({where:{id:review.tutorId},data:{ratingSum:{increment:data.rating!-original.rating}}})})
    } else if (data.action === 'delete') {
      await db.$transaction([
        db.review.delete({ where: { id: review.id } }),
        db.tutorProfile.update({ where: { id: review.tutorId }, data: { ratingSum: { decrement: review.rating }, reviewCount: { decrement: 1 } } }),
      ])
    } else {
      await db.review.update({ where: { id: review.id }, data: { status: data.action === 'hide' ? 'HIDDEN' : 'PUBLISHED' } })
    }
    await audit(admin.id, `REVIEW_${data.action.toUpperCase()}`, 'review', review.id)
    return ok({ ok: true })
  })
}
