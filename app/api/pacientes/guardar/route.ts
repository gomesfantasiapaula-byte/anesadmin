import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { patientsCache } from '@/lib/db/schema'
import type { SisaCobertura, SisaSexo } from '@/lib/sisa-api'

interface GuardarBody {
  dni: string
  sexo: SisaSexo
  datos: SisaCobertura
}

/**
 * POST /api/pacientes/guardar
 * Persiste manualmente los datos de un paciente en la DB.
 * Solo se llama cuando el usuario presiona "Guardar en DB".
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: GuardarBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { dni, sexo, datos } = body

  if (!dni || !sexo || !datos) {
    return NextResponse.json({ error: 'Faltan campos: dni, sexo, datos' }, { status: 400 })
  }

  const dniLimpio = dni.replace(/[.\s-]/g, '').trim()
  if (!/^\d{7,8}$/.test(dniLimpio)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  try {
    await db
      .insert(patientsCache)
      .values({ dni: dniLimpio, sexo, dataJson: datos })
      .onConflictDoUpdate({
        target: [patientsCache.dni, patientsCache.sexo],
        set: { dataJson: datos, fetchedAt: new Date() },
      })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Guardar Paciente]', msg)
    return NextResponse.json({ error: `Error al guardar: ${msg}` }, { status: 500 })
  }
}
