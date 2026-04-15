import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SisaCobertura, SisaSexo } from '@/lib/sisa-api'

const SSS_BASE = 'https://www.sssalud.gob.ar'
const SSS_SUBMIT = `${SSS_BASE}/index.php?page=bus650&user=GRAL&cat=consultas`
const SSS_PAGE = `${SSS_BASE}/index.php?user=GRAL&page=bus650`

export interface SssConsultaBody {
  dni: string
  sexo: SisaSexo
  captchaCode: string
  phpSessId: string
  captchaSid: string
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: SssConsultaBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { dni, sexo, captchaCode, phpSessId, captchaSid } = body
  if (!dni || !captchaCode || !phpSessId || !captchaSid) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const dniLimpio = dni.replace(/[.\s-]/g, '').trim()
  if (!/^\d{7,8}$/.test(dniLimpio)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  try {
    const formData = new URLSearchParams()
    formData.set('pagina_consulta', '')
    formData.set('cuil_b', '')
    formData.set('nro_doc', dniLimpio)
    formData.set('code', captchaCode.trim().toLowerCase())
    formData.set('B1', 'Consultar')

    const sssRes = await fetch(SSS_SUBMIT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `PHPSESSID=${phpSessId}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: SSS_PAGE,
        Origin: SSS_BASE,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      body: formData.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    })

    const html = await sssRes.text()

    // Loguear HTML para debugging en Vercel (primeros 4000 chars)
    console.log('[SSS HTML]', html.slice(0, 4000))

    const resultado = parsearRespuestaSSS(html, dniLimpio, sexo)
    return NextResponse.json({ ...resultado, fuente: 'sss-web' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[SSS Consultar]', msg)
    return NextResponse.json({ error: `Error al consultar SSS: ${msg}` }, { status: 502 })
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface SssResultado {
  encontrado: boolean
  captchaIncorrecto?: boolean
  mensaje?: string
  datos?: SisaCobertura
}

// RNOS: código numérico de 6 dígitos o formateado como "X-XXXX-X"
const RNOS_RE = /^\d{6}$|^\d-\d{3,4}-\d{1,2}$/

// Palabras que aparecen en nombres de obras sociales (no en nombres de personas)
const OS_KEYWORDS = [
  'obra social', 'prepaga', 'medicina', 'salud', 'mutual', 'osde', 'swiss',
  'galeno', 'medicus', 'omint', 'accord', 'ioma', 'dosep', 'osplad', 'ospacp',
  'osecac', 'pami', 'inssjp', 'jubilados', 'pensionados', 'docentes', 'bancarios',
  'comercio', 'metalurgicos', 'camioneros', 'smata', 'sancor', 'luis pasteur',
  'federada', 'caja', 'provincial', 'municipal', 'empleados', 'trabajadores',
]

function esNombreOS(val: string): boolean {
  const v = val.toLowerCase()
  return OS_KEYWORDS.some((k) => v.includes(k)) || val.length > 15
}

function esRnos(val: string): boolean {
  return RNOS_RE.test(val.trim())
}

function parsearRespuestaSSS(html: string, dni: string, sexo: SisaSexo): SssResultado {
  const lower = html.toLowerCase()

  // ── CAPTCHA incorrecto ────────────────────────────────────────────────────
  if (
    lower.includes('código de seguridad incorrecto') ||
    lower.includes('codigo de seguridad incorrecto') ||
    lower.includes('incorrect security code') ||
    lower.includes('the security code entered was incorrect')
  ) {
    return { encontrado: false, captchaIncorrecto: true, mensaje: 'Código CAPTCHA incorrecto. Intentá de nuevo.' }
  }

  // ── Sin resultados ────────────────────────────────────────────────────────
  if (
    lower.includes('no se encontraron') ||
    lower.includes('sin resultados') ||
    lower.includes('no existen beneficiarios') ||
    lower.includes('0 resultado')
  ) {
    return { encontrado: false, mensaje: 'No figura en el padrón de SSS.' }
  }

  // ── Parsear todas las tablas ──────────────────────────────────────────────
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[0])

  for (const table of tables) {
    const tLow = table.toLowerCase()
    if (
      !tLow.includes('agente') &&
      !tLow.includes('apellido') &&
      !tLow.includes('beneficiario') &&
      !tLow.includes('obra social')
    ) continue

    const datos = extraerDatosSSS(table, dni, sexo)
    if (datos) return { encontrado: true, datos }
  }

  return { encontrado: false, mensaje: 'Respuesta de SSS no interpretable. Intentá de nuevo.' }
}

function extraerDatosSSS(table: string, dni: string, sexo: SisaSexo): SisaCobertura | null {
  // Extraer headers
  const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => clean(m[1]).toLowerCase())

  // Extraer filas de datos (sin la de headers)
  const dataRows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((r) => r[1])
    .filter((r) => /<td/i.test(r) && !/<th/i.test(r))

  for (const row of dataRows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => clean(m[1]))
      .filter(Boolean)

    if (cells.length < 2) continue

    let apellido: string | undefined
    let nombre:   string | undefined
    let obraSocial: string | undefined
    let rnos:     string | undefined
    let nroAfiliado: string | undefined
    let estado:   string | undefined

    if (headers.length >= cells.length) {
      // ── Mapeo por header ────────────────────────────────────────────────
      headers.forEach((h, i) => {
        const v = cells[i]
        if (!v) return

        if ((h.includes('apellido') && h.includes('nombre')) || h === 'beneficiario') {
          const p = v.split(',').map((s) => s.trim())
          apellido = p[0]; nombre = p[1]
        } else if (h.includes('apellido')) {
          apellido = v
        } else if (h === 'nombre') {
          nombre = v
        } else if (h.includes('agente') || h.includes('obra social') || h.includes('cobertura')) {
          obraSocial = v
        } else if (h.includes('rnos') || h.includes('código agente') || h.includes('cod.')) {
          rnos = v
        } else if (h.includes('n°') || h.includes('nro') || h.includes('número') || h.includes('afiliado')) {
          nroAfiliado = v
        } else if (h.includes('estado') || h.includes('vigencia')) {
          estado = v
        }
      })
    }

    // ── Si el mapeo por header falló, usar detección por contenido ──────────
    if (!obraSocial && !apellido) {
      for (const cell of cells) {
        if (!cell) continue
        if (esRnos(cell)) {
          rnos = rnos ?? cell
        } else if (esNombreOS(cell)) {
          obraSocial = obraSocial ?? cell
        } else if (/^\d{6,12}$/.test(cell) && cell !== dni) {
          nroAfiliado = nroAfiliado ?? cell
        } else if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+$/.test(cell) && cell.length > 3) {
          if (!apellido) apellido = cell
          else if (!nombre) nombre = cell
        }
      }
    }

    // ── Resolver obraSocial/rnos mezclados ───────────────────────────────────
    // Si obraSocial parece un RNOS y rnos parece un nombre de OS, intercambiar
    if (obraSocial && esRnos(obraSocial) && !rnos) {
      rnos = obraSocial
      obraSocial = undefined
    }
    if (rnos && esNombreOS(rnos) && !obraSocial) {
      obraSocial = rnos
      rnos = undefined
    }

    if (!apellido && !obraSocial) continue

    const fechaNac = extraerFechaNac(table)
    const edad = calcularEdad(fechaNac)

    return {
      dni,
      sexo,
      apellido,
      nombre,
      fechaNacimiento: fechaNac,
      obraSocial,
      rnos,
      nroAfiliado,
      estado,
      vigencia: estado?.toLowerCase().includes('vigente') ? 'VIGENTE' : undefined,
      ...(edad !== null ? { _edad: edad } as any : {}),
    }
  }

  return null
}

/** Busca fecha de nacimiento en formato DD/MM/YYYY en el HTML */
function extraerFechaNac(html: string): string | undefined {
  const m = html.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
  return m ? m[1] : undefined
}

function calcularEdad(fechaDDMMYYYY?: string): number | null {
  if (!fechaDDMMYYYY) return null
  const p = fechaDDMMYYYY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!p) return null
  const nac = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]))
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const cumplioEsteAnio =
    hoy.getMonth() > nac.getMonth() ||
    (hoy.getMonth() === nac.getMonth() && hoy.getDate() >= nac.getDate())
  if (!cumplioEsteAnio) edad--
  return edad >= 0 && edad < 150 ? edad : null
}

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/\s+/g, ' ')
    .trim()
}
