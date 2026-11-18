import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handle, body, requireFields, fail, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth'

/** GET /api/support — user's tickets (staff sees all). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const isStaff = user.role === 'ADMIN' || user.role === 'SUPPORT'
    const tickets = await db.supportTicket.findMany({
      where: isStaff ? {} : { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { name: true } } } },
      },
    })
    return ok({ tickets, isStaff })
  })
}

/** POST /api/support — create a ticket or reply to one. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req)
    const data = await body<{ subject?: string; category?: string; priority?: string; body?: string; ticketId?: string }>(req)
    const isStaff = user.role === 'ADMIN' || user.role === 'SUPPORT'

    if (data.ticketId) {
      // Reply
      requireFields(data as unknown as Record<string, unknown>, ['body'])
      const ticket = await db.supportTicket.findUnique({ where: { id: data.ticketId } })
      if (!ticket) return fail(404, 'Ticket not found')
      if (ticket.userId !== user.id && !isStaff) return fail(403, 'Not allowed')
      await db.ticketMessage.create({
        data: { ticketId: ticket.id, senderId: user.id, body: data.body!.slice(0, 4000), isStaff },
      })
      await db.supportTicket.update({
        where: { id: ticket.id },
        data: { status: isStaff ? 'PENDING' : 'OPEN', updatedAt: new Date() },
      })
      return ok({ ok: true })
    }

    // New ticket
    requireFields(data as unknown as Record<string, unknown>, ['subject', 'body'])
    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        subject: data.subject!.slice(0, 200),
        category: data.category ?? 'general',
        priority: data.priority ?? 'normal',
      },
    })
    await db.ticketMessage.create({
      data: { ticketId: ticket.id, senderId: user.id, body: data.body!.slice(0, 4000), isStaff: false },
    })
    return ok({ ticket })
  })
}

/** PATCH — staff updates ticket status. */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser(req, ['ADMIN', 'SUPPORT'])
    const data = await body<{ ticketId: string; status: string }>(req)
    requireFields(data as unknown as Record<string, unknown>, ['ticketId', 'status'])
    if (!['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].includes(data.status)) return fail(400, 'Invalid status')
    await db.supportTicket.update({ where: { id: data.ticketId }, data: { status: data.status, updatedAt: new Date() } })
    return ok({ ok: true })
  })
}
