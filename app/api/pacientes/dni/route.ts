import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { kv } from '@vercel/kv'
import { db } from '@/lib/db'
import { patientsCache } from '@/lib/db/schema'
import { consultarCoberturaSisa, normalizarDni, validarDni, urlConsultaSSS, type SisaSexo } from '@/lib/sisa-api'
import { eq, and } from 'drizzle-orm'

// TTL del cache: 24 horas en segundos
const CACHE_TTL_SEGUNDOS = 24 * 60 * 60

export async function GET(request: NextRequest) {
  // Verificar sesión
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dniRaw = searchParams.get('dni')
  const sexo = searchParams.get('sexo') as SisaSexo | null

  // Validaciones
  if (!dniRaw || !sexo) {
    return NextResponse.json(
      { error: 'Se requieren los parámetros dni y sexo (M/F)' },
      { status: 400 },
    )
  }

  if (!['M', 'F'].includes(sexo)) {
    return NextResponse.json(
      { error: 'El parámetro sexo debe ser M o F' },
      { status: 400 },
    )
  }

  const dni = normalizarDni(dniRaw)

  if (!validarDni(dni)) {
    return NextResponse.json(
      { error: 'DNI inválido. Debe contener 7 u 8 dígitos.' },
      { status: 400 },
    )
  }

  const cacheKey = `sisa:${dni}:${sexo}`

  try {
    // 1. Intentar desde Vercel KV (Redis) primero — más rápido
    try {
      const cachedKv = await kv.get(cacheKey)
      if (cachedKv) {
        return NextResponse.json({ data: cachedKv, fuente: 'cache' })
      }
    } catch {
      // KV no disponible, continuar sin cache KV
    }

    // 2. Intentar desde Postgres cache (fallback)
    const [dbCache] = await db
      .select()
      .from(patientsCache)
      .where(and(eq(patientsCache.dni, dni), eq(patientsCache.sexo, sexo)))
      .limit(1)

    if (dbCache) {
      const edadCache =
        (Date.now() - new Date(dbCache.fetchedAt).getTime()) / 1000
      if (edadCache < CACHE_TTL_SEGUNDOS) {
        // Repoblar KV con el dato de Postgres
        try {
          await kv.set(cacheKey, dbCache.dataJson, { ex: CACHE_TTL_SEGUNDOS })
        } catch { /* ignorar error KV */ }
        return NextResponse.json({ data: dbCache.dataJson, fuente: 'cache-db' })
      }
    }

    // 3. Consultar la API SISA
    const sisaData = await consultarCoberturaSisa(dni, sexo)

    // 4. Guardar en caches
    try {
      await kv.set(cacheKey, sisaData, { ex: CACHE_TTL_SEGUNDOS })
    } catch { /* ignorar error KV */ }

    // Upsert en Postgres
    await db
      .insert(patientsCache)
      .values({ dni, sexo, dataJson: sisaData })
      .onConflictDoUpdate({
        target: [patientsCache.dni, patientsCache.sexo],
        set: {
          dataJson: sisaData,
          fetchedAt: new Date(),
        },
      })

    return NextResponse.json({
      data: sisaData,
      fuente: 'api-sisa',
      // Si no hay credenciales, incluir URL de consulta manual en SSS
      ...(sisaData.sinCredenciales && { urlSSS: urlConsultaSSS(dni) }),
    })
  } catch (error) {
    console.error('[API Pacientes] Error consultando SISA:', error)
    return NextResponse.json(
      { error: 'Error al consultar la cobertura. Intentá de nuevo.' },
      { status: 500 },
    )
  }
}
