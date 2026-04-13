import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { workSessions } from '@/lib/db/schema'
import { eq, gte, lte, and, desc } from 'drizzle-orm'
import { z } from 'zod'

const jornadaSchema = z.object({
  hospitalId: z.string().uuid('ID de hospital inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: yyyy-MM-dd'),
  timeIn: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora: HH:mm')
    .optional(),
  timeOut: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora: HH:mm')
    .optional(),
  notes: z.string().optional(),
})

// GET /api/jornadas?desde=yyyy-MM-dd&hasta=yyyy-MM-dd
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const jornadas = await db
    .select()
    .from(workSessions)
    .where(
      and(
        eq(workSessions.userId, session.user!.id!),
        desde ? gte(workSessions.date, desde) : undefined,
        hasta ? lte(workSessions.date, hasta) : undefined,
      ),
    )
    .orderBy(desc(workSessions.date))

  return NextResponse.json({ jornadas })
}

// POST /api/jornadas
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = jornadaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.issues },
      { status: 400 },
    )
  }

  const [jornada] = await db
    .insert(workSessions)
    .values({ userId: session.user!.id!, ...parsed.data })
    .returning()

  return NextResponse.json({ jornada }, { status: 201 })
}
