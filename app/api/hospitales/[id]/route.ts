import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hospitals } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  contact: z.string().max(255).optional(),
  notes: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// PUT /api/hospitales/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.issues },
      { status: 400 },
    )
  }

  const [updated] = await db
    .update(hospitals)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(hospitals.id, id), eq(hospitals.userId, session.user!.id!)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ hospital: updated })
}

// DELETE /api/hospitales/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const [deleted] = await db
    .delete(hospitals)
    .where(and(eq(hospitals.id, id), eq(hospitals.userId, session.user!.id!)))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
