import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc, like, and } from 'drizzle-orm'
import { z } from 'zod'

// Schema de validación para crear documento
const crearDocumentoSchema = z.object({
  patientDni: z.string().optional(),
  hospitalId: z.string().uuid().optional(),
  docType: z.enum(['quirurgico', 'anestesiologico', 'otro']),
  ocrText: z.string().min(1, 'El texto OCR no puede estar vacío'),
  imageUrl: z.string().url().optional(),
  docDate: z.string().optional(), // formato yyyy-MM-dd
})

// GET /api/documentos — Listar documentos del usuario
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!
  const { searchParams } = new URL(request.url)
  const busqueda = searchParams.get('q')

  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        busqueda
          ? like(documents.ocrText, `%${busqueda}%`)
          : undefined,
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(50)

  return NextResponse.json({ documentos: docs })
}

// POST /api/documentos — Crear nuevo documento
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = crearDocumentoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.issues },
      { status: 400 },
    )
  }

  const [doc] = await db
    .insert(documents)
    .values({
      userId,
      ...parsed.data,
    })
    .returning()

  return NextResponse.json({ documento: doc }, { status: 201 })
}
