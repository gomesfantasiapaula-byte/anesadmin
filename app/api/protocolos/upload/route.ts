import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'

// POST /api/protocolos/upload — Sube JPG a Vercel Blob
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user!.id!
  const formData = await request.formData()
  const archivo = formData.get('file') as File | null

  if (!archivo) {
    return NextResponse.json({ error: 'No se encontró archivo' }, { status: 400 })
  }

  // Solo JPG — la conversión se hace en el cliente antes de subir
  if (archivo.type !== 'image/jpeg') {
    return NextResponse.json(
      { error: 'Solo se aceptan archivos JPEG. Convertir antes de subir.' },
      { status: 400 },
    )
  }

  // Límite 8MB
  if (archivo.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Archivo demasiado grande. Máximo 8MB.' },
      { status: 400 },
    )
  }

  const nombreArchivo = `protocolos/${userId}/${Date.now()}.jpg`

  const blob = await put(nombreArchivo, archivo, {
    access: 'public',
    contentType: 'image/jpeg',
  })

  return NextResponse.json({ url: blob.url }, { status: 201 })
}
