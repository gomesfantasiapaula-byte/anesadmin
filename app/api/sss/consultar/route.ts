import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { patientsCache } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { SisaCobertura, SisaSexo } from '@/lib/sisa-api'

const SSS_BASE = 'https://www.sssalud.gob.ar'
const SSS_SUBMIT = `${SSS_BASE}/index.php?page=bus650&user=GRAL&cat=consultas`
const SSS_PAGE = `${SSS_BASE}/index.php?user=GRAL&page=bus650`
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface SssConsultaBody {
  dni: string
  sexo: SisaSexo
  captchaCode: string
  phpSessId: string
  captchaSid: string
}

/**
 * POST /api/sss/consultar
 *
 * Envía el formulario bus650 de SSS con el código CAPTCHA resuelto por el usuario.
 * Parsea la respuesta HTML y devuelve datos de cobertura estructurados.
 * Guarda en cache de Postgres para futuras consultas.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: SssConsultaBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { dni, sexo, captchaCode, phpSessId, captchaSid } = body

  if (!dni || !captchaCode || !phpSessId || !captchaSid) {
    return NextResponse.json(
      { error: 'Faltan parámetros: dni, captchaCode, phpSessId, captchaSid' },
      { status: 400 },
    )
  }

  // DNI limpio
  const dniLimpio = dni.replace(/[.\s-]/g, '').trim()
  if (!/^\d{7,8}$/.test(dniLimpio)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  try {
    // ── Enviar formulario a SSS ───────────────────────────────────────────────
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
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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

    // ── Parsear respuesta HTML ────────────────────────────────────────────────
    const resultado = parsearRespuestaSSS(html, dniLimpio, sexo)

    // ── Guardar en cache Postgres si encontró datos ───────────────────────────
    if (resultado.encontrado && resultado.datos) {
      try {
        await db
          .insert(patientsCache)
          .values({ dni: dniLimpio, sexo, dataJson: resultado.datos })
          .onConflictDoUpdate({
            target: [patientsCache.dni, patientsCache.sexo],
            set: { dataJson: resultado.datos, fetchedAt: new Date() },
          })
      } catch (e) {
        // No bloquear la respuesta si falla el cache
        console.warn('[SSS] Error guardando en cache:', e)
      }
    }

    return NextResponse.json({ ...resultado, fuente: 'sss-web' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[SSS Consultar]', msg)
    return NextResponse.json(
      { error: `Error al consultar SSS: ${msg}` },
      { status: 502 },
    )
  }
}

// ── Parser HTML de SSS ────────────────────────────────────────────────────────

interface SssResultado {
  encontrado: boolean
  captchaIncorrecto?: boolean
  mensaje?: string
  datos?: SisaCobertura
  rawHtml?: string
}

function parsearRespuestaSSS(
  html: string,
  dni: string,
  sexo: SisaSexo,
): SssResultado {
  const lower = html.toLowerCase()

  // ── CAPTCHA incorrecto ──────────────────────────────────────────────────────
  if (
    lower.includes('código de seguridad incorrecto') ||
    lower.includes('codigo de seguridad incorrecto') ||
    lower.includes('captcha') && lower.includes('incorrecto') ||
    lower.includes('incorrect security code') ||
    lower.includes('the security code entered was incorrect')
  ) {
    return { encontrado: false, captchaIncorrecto: true, mensaje: 'Código CAPTCHA incorrecto. Intentá de nuevo.' }
  }

  // ── Sin resultados ──────────────────────────────────────────────────────────
  const sinResultados =
    lower.includes('no se encontraron') ||
    lower.includes('sin resultados') ||
    lower.includes('no existen beneficiarios') ||
    lower.includes('no encontrado') ||
    lower.includes('not found') ||
    lower.includes('0 resultado')

  if (sinResultados) {
    return {
      encontrado: false,
      mensaje: 'No se encontraron beneficiarios para ese DNI en SSS.',
    }
  }

  // ── Buscar tabla de resultados ──────────────────────────────────────────────
  // La SSS devuelve una tabla HTML con las columnas de beneficiarios.
  // Extraemos filas de <tr> dentro de la tabla de resultados.

  // Intentar con tabla que contiene datos de afiliados
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi)

  if (tableMatch) {
    for (const table of tableMatch) {
      const tLower = table.toLowerCase()
      // La tabla de resultados suele contener palabras clave como
      // "beneficiario", "agente", "obra social", "apellido"
      if (
        tLower.includes('beneficiario') ||
        tLower.includes('agente') ||
        tLower.includes('apellido') ||
        tLower.includes('obra social')
      ) {
        const datos = extraerDatosDeTabla(table, dni, sexo)
        if (datos) {
          return { encontrado: true, datos }
        }
      }
    }
  }

  // ── Intentar extracción de campos individuales desde el HTML ─────────────
  const datosDirectos = extraerDatosDirectos(html, dni, sexo)
  if (datosDirectos) {
    return { encontrado: true, datos: datosDirectos }
  }

  // ── Respuesta desconocida — devolver HTML para debugging en dev ────────────
  const esProduccion = process.env.NODE_ENV === 'production'
  return {
    encontrado: false,
    mensaje: 'Respuesta de SSS no interpretable. Intentá de nuevo.',
    ...(esProduccion ? {} : { rawHtml: html.slice(0, 2000) }),
  }
}

/** Extrae datos desde filas <tr> de la tabla de resultados */
function extraerDatosDeTabla(
  tableHtml: string,
  dni: string,
  sexo: SisaSexo,
): SisaCobertura | null {
  // Extraer todas las celdas <td>
  const cells = [...tableHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => limpiarHtml(m[1]))
    .filter(Boolean)

  if (cells.length < 2) return null

  // Buscar headers para saber el orden de columnas
  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => limpiarHtml(m[1]).toLowerCase())

  let apellido: string | undefined
  let nombre: string | undefined
  let obraSocial: string | undefined
  let rnos: string | undefined
  let nroAfiliado: string | undefined
  let estado: string | undefined

  if (headers.length > 0) {
    // Tenemos headers — mapear columnas
    // Los datos están en filas de datos (pueden ser múltiples)
    const dataRows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((r) => r[1])
      .filter((r) => !r.toLowerCase().includes('<th'))

    for (const row of dataRows) {
      const rowCells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((m) => limpiarHtml(m[1]))

      if (rowCells.length === 0) continue

      // Mapear según headers
      headers.forEach((header, i) => {
        const val = rowCells[i]
        if (!val) return
        if (header.includes('apellido') || header.includes('nombre')) {
          // Puede ser "apellido y nombre" en una celda o separados
          if (header.includes('apellido') && header.includes('nombre')) {
            const partes = val.split(',').map((s) => s.trim())
            apellido = partes[0]
            nombre = partes[1]
          } else if (header.includes('apellido')) {
            apellido = val
          } else if (header.includes('nombre')) {
            nombre = val
          }
        } else if (header.includes('agente') || header.includes('obra') || header.includes('cobertura')) {
          obraSocial = val
        } else if (header.includes('rnos') || header.includes('código')) {
          rnos = val
        } else if (header.includes('beneficiario') || header.includes('afiliado') || header.includes('n°')) {
          nroAfiliado = val
        } else if (header.includes('estado') || header.includes('vigencia')) {
          estado = val
        }
      })

      // Si al menos obtuvimos obra social, devolvemos
      if (obraSocial || apellido) break
    }
  } else {
    // Sin headers — intentar inferir por posición o por contenido
    // Buscar celdas que parezcan nombres o obras sociales
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const cellLow = cell.toLowerCase()
      if (cellLow.includes('osde') || cellLow.includes('swiss') || cellLow.includes('galeno') ||
          cellLow.includes('obra') || cellLow.includes('prepaga') || cellLow.includes('ioma') ||
          cellLow.includes('pami') || cellLow.includes('osecac') || cellLow.includes('medicus') ||
          cellLow.includes('omint') || cellLow.includes('accord')) {
        obraSocial = cell
      }
      // DNI suele estar como número 7-8 dígitos
      if (/^\d{7,8}$/.test(cell) && cell !== dni) {
        nroAfiliado = cell
      }
    }
    // Primer par de celdas alfabéticas = apellido, nombre
    const textos = cells.filter((c) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ ]+$/.test(c))
    if (textos.length >= 2) {
      apellido = textos[0]
      nombre = textos[1]
    } else if (textos.length === 1) {
      apellido = textos[0]
    }
  }

  if (!apellido && !obraSocial) return null

  return {
    dni,
    sexo,
    apellido,
    nombre,
    obraSocial,
    rnos,
    nroAfiliado,
    estado,
    vigencia: estado?.toLowerCase().includes('vigente') ? 'VIGENTE' : estado,
  }
}

/** Extrae datos buscando patrones clave directamente en el HTML */
function extraerDatosDirectos(
  html: string,
  dni: string,
  sexo: SisaSexo,
): SisaCobertura | null {
  // Buscar el DNI en el HTML para confirmar que hay datos
  if (!html.includes(dni) && !html.includes(dni.replace(/^0/, ''))) {
    return null
  }

  // Patrón: buscar texto después de etiquetas conocidas
  const extraer = (patron: RegExp) => {
    const m = html.match(patron)
    return m ? limpiarHtml(m[1]).trim() : undefined
  }

  const apellido = extraer(/Apellido[^:]*:\s*<[^>]*>([^<]+)/i)
  const nombre = extraer(/Nombre[^:]*:\s*<[^>]*>([^<]+)/i)
  const obraSocial =
    extraer(/Agente del Seguro[^:]*:\s*<[^>]*>([^<]+)/i) ??
    extraer(/Obra Social[^:]*:\s*<[^>]*>([^<]+)/i) ??
    extraer(/Cobertura[^:]*:\s*<[^>]*>([^<]+)/i)
  const rnos = extraer(/RNOS[^:]*:\s*<[^>]*>([^<]+)/i)
  const nroAfiliado = extraer(/(?:N[°º]?\s*)?(?:Beneficiario|Afiliado)[^:]*:\s*<[^>]*>([^<]+)/i)
  const estado = extraer(/Estado[^:]*:\s*<[^>]*>([^<]+)/i)

  if (!apellido && !obraSocial) return null

  return {
    dni,
    sexo,
    apellido,
    nombre,
    obraSocial,
    rnos,
    nroAfiliado,
    estado,
    vigencia: estado?.toLowerCase().includes('vigente') ? 'VIGENTE' : estado,
  }
}

/** Elimina tags HTML y decodifica entidades básicas */
function limpiarHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}
