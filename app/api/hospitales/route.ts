import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hospitals } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const hospitalSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(255),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  contact: z.string().max(255).optional(),
  notes: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
    .optional(),
})

// GET /api/hospitales
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const lista = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.userId, session.user!.id!))
    .orderBy(desc(hospitals.createdAt))

  return NextResponse.json({ hospitales: lista })
}

// POST /api/hospitales
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = hospitalSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.issues },
      { status: 400 },
    )
  }

  const [hospital] = await db
    .insert(hospitals)
    .values({ userId: session.user!.id!, ...parsed.data })
    .returning()

  return NextResponse.json({ hospital }, { status: 201 })
}
