import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 })
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (err) {
    const anyErr = err as Error & { status?: number }
    if (err instanceof ApiError) return fail(err.status, err.message)
    if (typeof anyErr?.status === 'number') return fail(anyErr.status, anyErr.message || 'Request failed')
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return fail(409, 'A record with these details already exists')
      if (err.code === 'P2025') return fail(404, 'Record not found')
    }
    console.error('[api]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return fail(500, process.env.NODE_ENV === 'production' ? 'Internal server error' : message)
  }
}

export async function body<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
}

export function requireFields(obj: Record<string, unknown>, fields: string[]) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      throw new ApiError(400, `Missing required field: ${f}`)
    }
  }
}

export function num(v: unknown, def: number | null = null): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : (def as number)
}

export function str(v: unknown, def = ''): string {
  return typeof v === 'string' ? v : def
}
