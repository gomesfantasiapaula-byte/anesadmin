import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'

// POST /api/documentos/upload — Subir imagen a Vercel Blob
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!
  const formData = await request.formData()
  const archivo = formData.get('file') as File | null

  if (!archivo) {
    return NextResponse.json({ error: 'No se encontró archivo' }, { status: 400 })
  }

  // Validar tipo de archivo
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!tiposPermitidos.includes(archivo.type)) {
    return NextResponse.json(
      { error: 'Tipo de archivo no permitido. Usar JPEG, PNG o WebP.' },
      { status: 400 },
    )
  }

  // Límite de 10MB
  if (archivo.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Archivo demasiado grande. Máximo 10MB.' },
      { status: 400 },
    )
  }

  const nombreArchivo = `docs/${userId}/${Date.now()}-${archivo.name.replace(/[^a-z0-9.-]/gi, '_')}`

  const blob = await put(nombreArchivo, archivo, {
    access: 'public',
    contentType: archivo.type,
  })

  return NextResponse.json({ url: blob.url }, { status: 201 })
}
