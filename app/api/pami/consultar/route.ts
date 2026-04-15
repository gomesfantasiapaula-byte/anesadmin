import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SisaCobertura, SisaSexo } from '@/lib/sisa-api'

const BASE = 'https://prestadores.pami.org.ar'
const FORM_URL = `${BASE}/result.php?c=6-2`
const SUBMIT_URL = `${BASE}/result.php?c=6-2-2`

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * GET /api/pami/consultar?dni=XXX&sexo=M|F
 *
 * Consulta el padrón PAMI (INSSJP) en 2 pasos:
 * 1. GET formulario → lee totalSuma2 (math-captcha auto-resoluble)
 * 2. POST búsqueda → extrae nombre, beneficio, fechas, URL de detalle
 * 3. GET detalle   → extrae fechaNacimiento, tipo beneficiario, UGL, etc.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dni = searchParams.get('dni')?.replace(/[.\s-]/g, '').trim()
  const sexo = (searchParams.get('sexo') as SisaSexo | null) ?? 'F'

  if (!dni || !/^\d{7,8}$/.test(dni)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  try {
    // ── 1. Leer totalSuma2 del formulario ─────────────────────────────────────
    const formHtml = await fetchText(FORM_URL, { Referer: BASE })

    const sumaMatch =
      formHtml.match(/id=["']totalSuma2["'][^>]*value=["'](\d+)["']/i) ??
      formHtml.match(/value=["'](\d+)["'][^>]*id=["']totalSuma2["']/i)

    if (!sumaMatch) throw new Error('No se encontró totalSuma2 en el formulario PAMI')
    const respuestaMath = sumaMatch[1]

    // ── 2. Enviar búsqueda ────────────────────────────────────────────────────
    const body = new URLSearchParams({
      tipoDocumento: 'DNI',
      nroDocumento: dni,
      math2: respuestaMath,
    })

    const searchHtml = await fetchText(SUBMIT_URL, {
      Referer: FORM_URL,
      Origin: BASE,
      'Content-Type': 'application/x-www-form-urlencoded',
    }, body.toString())

    // ── 3. Parsear tabla de resultados ────────────────────────────────────────
    const searchResult = parsearBusqueda(searchHtml, dni, sexo)
    if (!searchResult.encontrado || !searchResult.detailUrl) {
      return NextResponse.json({ ...searchResult, fuente: 'pami' })
    }

    // ── 4. Traer página de detalle (tiene fechaNacimiento, tipoBeneficiario) ──
    const detailHtml = await fetchText(`${BASE}/${searchResult.detailUrl}`, {
      Referer: SUBMIT_URL,
    })

    const datos = parsearDetalle(detailHtml, dni, sexo, searchResult.datos!)
    return NextResponse.json({ encontrado: true, datos, fuente: 'pami' })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[PAMI]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// ── Helpers de fetch ──────────────────────────────────────────────────────────

async function fetchText(
  url: string,
  extraHeaders: Record<string, string> = {},
  body?: string,
): Promise<string> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
      ...extraHeaders,
    },
    ...(body ? { body } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  })
  return res.text()
}

// ── Parsear resultado de búsqueda ─────────────────────────────────────────────

interface BusquedaResult {
  encontrado: boolean
  mensaje?: string
  datos?: Partial<SisaCobertura>
  detailUrl?: string
}

function parsearBusqueda(html: string, dni: string, sexo: SisaSexo): BusquedaResult {
  if (html.toLowerCase().includes('0 registro')) {
    return { encontrado: false, mensaje: 'No figura como afiliado PAMI' }
  }

  // Las filas de datos tienen bgcolor=#e6e6e6 y celdas con class="whitetxt"
  // Estructura: [Afiliado, Beneficio, Grado Parent, Fecha Alta, Fecha Baja, (link Detalle)]
  const rowMatch = html.match(/<tr[^>]+bgcolor[^>]*#e6e6e6[^>]*>([\s\S]*?)<\/tr>/i)
  if (!rowMatch) return { encontrado: false, mensaje: 'No figura como afiliado PAMI' }

  const row = rowMatch[1]

  // Extraer celdas con class="whitetxt"
  const whitetxtCells = [...row.matchAll(/<p class=["']whitetxt["'][^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => strip(m[1]))

  // Posiciones fijas de la tabla PAMI
  const nombreCompleto = whitetxtCells[0] ?? ''
  const beneficio      = whitetxtCells[1] ?? ''
  const fechaAlta      = whitetxtCells[3] ?? ''
  const fechaBaja      = whitetxtCells[4] ?? ''

  // URL de detalle (href del link en la última celda)
  const detailMatch = row.match(/href=["'](result\.php[^"']+)["']/i)
  const detailUrl = detailMatch ? detailMatch[1] : undefined

  const vigente = !fechaBaja || fechaBaja.trim() === ''

  return {
    encontrado: true,
    detailUrl,
    datos: {
      dni,
      sexo,
      // Nombre viene como "APELLIDO NOMBRE" — mostramos todo como apellido
      apellido: nombreCompleto,
      obraSocial: 'PAMI / INSSJP',
      nroAfiliado: beneficio || undefined,
      vigencia: vigente ? 'VIGENTE' : 'BAJA',
      estado: vigente ? 'Vigente' : `Dado de baja: ${fechaBaja}`,
    },
  }
}

// ── Parsear página de detalle ─────────────────────────────────────────────────

function parsearDetalle(
  html: string,
  dni: string,
  sexo: SisaSexo,
  base: Partial<SisaCobertura>,
): SisaCobertura {
  // La página de detalle tiene pares <td class="gris"><p>LABEL:</p></td><td ...><p>VALUE</p></td>
  const campos = extraerCamposPares(html)

  const nombreCompleto = campos['APELLIDO Y NOMBRE'] ?? base.apellido ?? ''
  // Separar apellido/nombre si viene con coma: "GARCIA, JUAN CARLOS"
  // Sin coma: "GARCIA JUAN CARLOS" → todo como apellido
  const [apellido, nombre] = nombreCompleto.includes(',')
    ? nombreCompleto.split(',').map((s) => s.trim())
    : [nombreCompleto, undefined]

  const fechaNac = campos['FECHA DE NACIMIENTO']  // "DD/MM/YYYY"
  const edad = calcularEdad(fechaNac)

  const tipoBenef = campos['TIPO BENEFICIARIO']   // "JUBILACION", "PENSION", etc.
  const ugl       = campos['UGL']                 // zona/región PAMI
  const vencimiento = campos['VENCIMIENTO AFILIACION']
  const baja      = campos['BAJA']

  const vigente = !baja || baja.trim() === '' || baja.trim() === '-'

  return {
    dni,
    sexo,
    apellido,
    nombre,
    fechaNacimiento: fechaNac,
    obraSocial: 'PAMI / INSSJP',
    nroAfiliado: base.nroAfiliado,
    vigencia: vigente ? 'VIGENTE' : 'BAJA',
    estado: [
      tipoBenef,
      ugl ? `UGL: ${ugl}` : undefined,
      !vigente && baja ? `Baja: ${baja}` : undefined,
      edad !== null ? `${edad} años` : undefined,
    ].filter(Boolean).join(' · ') || base.estado,
    // Campo extra guardado en estado para mostrar edad
    ...(edad !== null ? { _edad: edad } as any : {}),
  }
}

/** Extrae pares LABEL → VALUE de tablas tipo <td class="gris"><p>LABEL</p></td><td><p>VALUE</p></td> */
function extraerCamposPares(html: string): Record<string, string> {
  const result: Record<string, string> = {}
  // Buscar todas las filas <tr>...<td...><p>LABEL</p></td><td...><p>VALUE</p></td>...</tr>
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]))
    if (cells.length >= 2) {
      const label = cells[0].replace(/:$/, '').trim()
      const value = cells[1].trim()
      if (label && value && value !== '-') result[label] = value
    }
  }
  return result
}

/** Calcula edad en años desde "DD/MM/YYYY". Devuelve null si no parsea. */
function calcularEdad(fechaDDMMYYYY?: string): number | null {
  if (!fechaDDMMYYYY) return null
  const parts = fechaDDMMYYYY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!parts) return null
  const nacimiento = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]))
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const cumplioEsteAnio =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate())
  if (!cumplioEsteAnio) edad--
  return edad >= 0 && edad < 150 ? edad : null
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
