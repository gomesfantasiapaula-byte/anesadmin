import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SisaCobertura, SisaSexo } from '@/lib/sisa-api'

const OSPLAD_URL = 'https://www.osplad.org.ar/consultaafiliados/resultados.php'

/**
 * GET /api/osplad/consultar?dni=XXX&sexo=M|F
 *
 * Consulta el padrón de OSPLAD (Obra Social del Personal de la Docencia)
 * sin CAPTCHA — simple GET con el DNI como query param.
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
    const url = `${OSPLAD_URL}?accion=buscar&docbusc=${encodeURIComponent(dni)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        Referer: 'https://www.osplad.org.ar/consultaafiliados/buscador-afiliados.php',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    })

    const html = await res.text()
    const resultado = parsearOsplad(html, dni, sexo ?? 'F')

    return NextResponse.json({ ...resultado, fuente: 'osplad' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[OSPLAD]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface OspladResultado {
  encontrado: boolean
  mensaje?: string
  datos?: SisaCobertura
}

function parsearOsplad(html: string, dni: string, sexo: SisaSexo): OspladResultado {
  const lower = html.toLowerCase()

  if (
    lower.includes('no se encontraron') ||
    lower.includes('disculpe') ||
    lower.includes('sin resultados') ||
    lower.includes('no existen')
  ) {
    return { encontrado: false, mensaje: 'No figura como afiliado OSPLAD' }
  }

  // Buscar tabla con datos de afiliado
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[0])

  for (const table of tables) {
    const cells = [...table.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      strip(m[1]),
    )
    if (cells.length < 2) continue

    const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
      strip(m[1]).toLowerCase(),
    )

    const get = (keyword: string) => {
      const idx = headers.findIndex((h) => h.includes(keyword))
      return idx >= 0 ? cells[idx] : undefined
    }

    // Apellido y Nombres puede estar en 1 celda o separado
    const nombreCompleto = get('apellido') ?? get('nombre') ?? cells[0]
    const estado = get('estado') ?? get('afiliaci') ?? cells[1]

    if (!nombreCompleto || nombreCompleto.length < 3) continue

    // Separar apellido/nombre si vienen como "APELLIDO, Nombre"
    const partes = nombreCompleto.split(/,\s*/)
    const apellido = partes[0]?.trim()
    const nombre = partes[1]?.trim()

    const vigente =
      estado?.toLowerCase().includes('vigente') ||
      estado?.toLowerCase().includes('activo') ||
      estado?.toLowerCase().includes('alta')

    return {
      encontrado: true,
      datos: {
        dni,
        sexo,
        apellido,
        nombre,
        obraSocial: 'OSPLAD',
        vigencia: vigente ? 'VIGENTE' : (estado ?? undefined),
        estado: estado ?? undefined,
      },
    }
  }

  return { encontrado: false, mensaje: 'No figura como afiliado OSPLAD' }
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
