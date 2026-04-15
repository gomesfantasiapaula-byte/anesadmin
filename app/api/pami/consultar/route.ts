import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SisaCobertura, SisaSexo } from '@/lib/sisa-api'

const PAMI_FORM = 'https://prestadores.pami.org.ar/result.php?c=6-2'
const PAMI_SUBMIT = 'https://prestadores.pami.org.ar/result.php?c=6-2-2'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

/**
 * GET /api/pami/consultar?dni=XXX&sexo=M|F
 *
 * Consulta el padrón de afiliados PAMI (INSSJP) por DNI.
 * El "CAPTCHA" es una suma matemática cuyo resultado está en el propio HTML
 * como campo oculto — se resuelve automáticamente sin intervención del usuario.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dni = searchParams.get('dni')?.replace(/[.\s-]/g, '').trim()
  const sexo = searchParams.get('sexo') as SisaSexo | null

  if (!dni || !/^\d{7,8}$/.test(dni)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  try {
    // ── 1. Cargar formulario y leer la respuesta del math-captcha ─────────────
    const formRes = await fetch(PAMI_FORM, {
      headers: HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    const formHtml = await formRes.text()

    // El campo oculto totalSuma2 contiene directamente el resultado esperado
    const sumaMatch =
      formHtml.match(/id=["']totalSuma2["'][^>]*value=["'](\d+)["']/i) ??
      formHtml.match(/name=["']totalSuma2["'][^>]*value=["'](\d+)["']/i) ??
      formHtml.match(/totalSuma2[^>]*value=["'](\d+)["']/i)

    if (!sumaMatch) {
      throw new Error('No se encontró totalSuma2 en el formulario PAMI')
    }
    const respuestaMath = sumaMatch[1]

    // ── 2. Enviar formulario ──────────────────────────────────────────────────
    const body = new URLSearchParams({
      tipoDocumento: 'DNI',
      nroDocumento: dni,
      math2: respuestaMath,
    })

    const submitRes = await fetch(PAMI_SUBMIT, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: PAMI_FORM,
        Origin: 'https://prestadores.pami.org.ar',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })

    const html = await submitRes.text()

    // ── 3. Parsear respuesta ──────────────────────────────────────────────────
    const resultado = parsearPami(html, dni, sexo ?? 'F')

    return NextResponse.json({ ...resultado, fuente: 'pami' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[PAMI]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface PamiResultado {
  encontrado: boolean
  mensaje?: string
  datos?: SisaCobertura
}

function parsearPami(html: string, dni: string, sexo: SisaSexo): PamiResultado {
  const lower = html.toLowerCase()

  if (lower.includes('0 registro') || lower.includes('no se encontr') || lower.includes('sin resultado')) {
    return { encontrado: false, mensaje: 'No figura como afiliado PAMI' }
  }

  // Buscar tabla de resultados — columnas: Afiliado, Beneficio, Grado Parent, Fecha Alta, Fecha Baja
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi)
  if (!tableMatch) return { encontrado: false, mensaje: 'Respuesta PAMI no interpretable' }

  for (const table of tableMatch) {
    const tLow = table.toLowerCase()
    if (!tLow.includes('afiliado') && !tLow.includes('beneficio')) continue

    // Extraer headers
    const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((m) => strip(m[1]).toLowerCase())

    // Extraer primera fila de datos
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((r) => r[1])
      .filter((r) => !r.toLowerCase().includes('<th'))
      .filter((r) => /<td/i.test(r))

    if (rows.length === 0) continue

    const cells = [...rows[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => strip(m[1]))

    const get = (keyword: string) => {
      const idx = headers.findIndex((h) => h.includes(keyword))
      return idx >= 0 ? cells[idx] : undefined
    }

    // "Afiliado" puede ser "Apellido Nombre" o "Nombre Apellido"
    const afiliadoRaw = get('afiliado') ?? cells[0]
    const partes = afiliadoRaw?.split(/,\s*/) ?? []
    const apellido = partes[0]?.trim()
    const nombre = partes[1]?.trim()

    const beneficio = get('beneficio') ?? cells[1]
    const fechaAlta = get('alta') ?? get('fecha alta')
    const fechaBaja = get('baja') ?? get('fecha baja')

    // Sin fecha de baja o fecha de baja vacía → vigente
    const vigente = !fechaBaja || fechaBaja === '' || fechaBaja === '—'

    return {
      encontrado: true,
      datos: {
        dni,
        sexo,
        apellido,
        nombre,
        obraSocial: 'PAMI / INSSJP',
        nroAfiliado: beneficio,
        vigencia: vigente ? 'VIGENTE' : 'BAJA',
        estado: vigente ? 'Vigente' : `Baja: ${fechaBaja}`,
        fechaNacimiento: undefined,
      },
    }
  }

  return { encontrado: false, mensaje: 'No figura como afiliado PAMI' }
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
