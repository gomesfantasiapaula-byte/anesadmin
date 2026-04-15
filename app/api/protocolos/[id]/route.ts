import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { anestheticProtocols, hospitals } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// GET /api/protocolos/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!

  const [row] = await db
    .select({
      id:               anestheticProtocols.id,
      userId:           anestheticProtocols.userId,
      hospitalId:       anestheticProtocols.hospitalId,
      patientFirstName: anestheticProtocols.patientFirstName,
      patientLastName:  anestheticProtocols.patientLastName,
      protocolDate:     anestheticProtocols.protocolDate,
      imageUrl:         anestheticProtocols.imageUrl,
      notes:            anestheticProtocols.notes,
      createdAt:        anestheticProtocols.createdAt,
      updatedAt:        anestheticProtocols.updatedAt,
      hospitalName:     hospitals.name,
      hospitalColor:    hospitals.color,
    })
    .from(anestheticProtocols)
    .leftJoin(hospitals, eq(anestheticProtocols.hospitalId, hospitals.id))
    .where(
      and(
        eq(anestheticProtocols.id, params.id),
        eq(anestheticProtocols.userId, userId),
      ),
    )
    .limit(1)

  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({ protocolo: row })
}

// DELETE /api/protocolos/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!

  // Verificar ownership antes de eliminar
  const [existente] = await db
    .select({ id: anestheticProtocols.id })
    .from(anestheticProtocols)
    .where(
      and(
        eq(anestheticProtocols.id, params.id),
        eq(anestheticProtocols.userId, userId),
      ),
    )
    .limit(1)

  if (!existente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await db
    .delete(anestheticProtocols)
    .where(eq(anestheticProtocols.id, params.id))

  return new NextResponse(null, { status: 204 })
}
