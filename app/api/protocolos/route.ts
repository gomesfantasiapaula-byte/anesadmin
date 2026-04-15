import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { anestheticProtocols, hospitals } from '@/lib/db/schema'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { z } from 'zod'

const crearProtocoloSchema = z.object({
  hospitalId: z.string().uuid().optional().nullable(),
  patientFirstName: z.string().min(1).max(255),
  patientLastName: z.string().min(1).max(255),
  protocolDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  imageUrl: z.string().url(),
  notes: z.string().optional().nullable(),
})

// GET /api/protocolos
// Query params: hospitalId?, fechaDesde? (YYYY-MM-DD), fechaHasta? (YYYY-MM-DD), limit? (default 100)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!
  const params = request.nextUrl.searchParams
  const hospitalId  = params.get('hospitalId')
  const fechaDesde  = params.get('fechaDesde')
  const fechaHasta  = params.get('fechaHasta')
  const limit       = Math.min(parseInt(params.get('limit') ?? '100', 10), 200)

  // Construir condiciones
  const condiciones = [eq(anestheticProtocols.userId, userId)]
  if (hospitalId) condiciones.push(eq(anestheticProtocols.hospitalId, hospitalId))
  if (fechaDesde) condiciones.push(gte(anestheticProtocols.protocolDate, fechaDesde))
  if (fechaHasta) condiciones.push(lte(anestheticProtocols.protocolDate, fechaHasta))

  const rows = await db
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
    .where(and(...condiciones))
    .orderBy(desc(anestheticProtocols.protocolDate), desc(anestheticProtocols.createdAt))
    .limit(limit)

  return NextResponse.json({ protocolos: rows })
}

// POST /api/protocolos
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!
  const body = await request.json().catch(() => null)
  const parsed = crearProtocoloSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.issues },
      { status: 400 },
    )
  }

  const { hospitalId, patientFirstName, patientLastName, protocolDate, imageUrl, notes } = parsed.data

  const [protocolo] = await db
    .insert(anestheticProtocols)
    .values({
      userId,
      hospitalId: hospitalId ?? null,
      patientFirstName,
      patientLastName,
      protocolDate,
      imageUrl,
      notes: notes ?? null,
    })
    .returning()

  return NextResponse.json({ protocolo }, { status: 201 })
}
