/**
 * Cliente para PUCO — Padrón Único Consolidado Operativo
 * Ministerio de Salud de la Nación Argentina
 *
 * PUCO consolida datos de:
 *   - Obras Sociales Nacionales (SSS)
 *   - Obras Sociales Provinciales
 *   - PAMI / INSSJP
 *   - Incluir Salud (ex-PROFE)
 *
 * Endpoint REST: POST https://sisa.msal.gov.ar/sisa/services/rest/puco/{dni}
 * Body JSON: { "usuario": "...", "clave": "..." }
 *
 * Para obtener credenciales: soporte@sisa.msal.gov.ar
 * Los profesionales de salud individuales son elegibles como usuarios SISA.
 *
 * Sin credenciales configuradas devuelve { sinCredenciales: true }
 * en lugar de lanzar un error 500.
 */

// Respuesta normalizada del servicio PUCO
export interface SisaCobertura {
  dni: string
  sexo: string
  nombre?: string
  apellido?: string
  fechaNacimiento?: string
  // Obra social / prepaga encontrada
  obraSocial?: string
  rnos?: string            // Código RNOS (registro nacional obras sociales)
  nroAfiliado?: string
  vigencia?: string
  estado?: string
  // Campos de resultado PUCO
  resultado?: string       // "OK" | "NO_ENCONTRADO" | "ERROR_AUTENTICACION" | "MULTIPLE_RESULTADO"
  // Errores
  errorCodigo?: string
  errorDescripcion?: string
  // Flag propio: sin credenciales configuradas
  sinCredenciales?: boolean
  /** Edad calculada a partir de fechaNacimiento */
  _edad?: number
}

export type SisaSexo = 'M' | 'F'

/**
 * Consulta la cobertura de salud de un paciente por DNI via PUCO/SISA.
 * Solo se ejecuta en el servidor (API route).
 *
 * @param dni  DNI sin puntos ni espacios (ej: "26453653")
 * @param sexo "M" masculino | "F" femenino
 */
export async function consultarCoberturaSisa(
  dni: string,
  sexo: SisaSexo,
): Promise<SisaCobertura> {
  const usuario = process.env.SISA_USUARIO
  const clave = process.env.SISA_CLAVE

  // Sin credenciales → devolver respuesta informativa sin tirar error
  if (!usuario || !clave) {
    console.warn('[PUCO] SISA_USUARIO/SISA_CLAVE no configurados.')
    return {
      dni,
      sexo,
      sinCredenciales: true,
      errorDescripcion:
        'Credenciales PUCO/SISA no configuradas. ' +
        'Solicitarlas en soporte@sisa.msal.gov.ar',
    }
  }

  // POST https://sisa.msal.gov.ar/sisa/services/rest/puco/{dni}
  const url = `https://sisa.msal.gov.ar/sisa/services/rest/puco/${encodeURIComponent(dni)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'AnesAdmin/1.0',
    },
    body: JSON.stringify({ usuario, clave }),
    // PUCO puede tardar — 15 s de timeout
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })

  // PUCO a veces devuelve HTML en errores — leemos como texto primero
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`PUCO HTTP ${response.status}: ${text.slice(0, 300)}`)
  }

  let data: SisaCobertura
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`PUCO no devolvió JSON válido: ${text.slice(0, 300)}`)
  }

  // data puede traer sus propios dni/sexo; los del parámetro tienen prioridad
  return { ...data, dni, sexo }
}

/**
 * Genera la URL de consulta manual en la SSS (sssalud.gob.ar).
 * Se usa como fallback cuando no hay credenciales SISA configuradas.
 */
export function urlConsultaSSS(_dni: string): string {
  return `https://www.sssalud.gob.ar/index.php?user=GRAL&page=bus650`
}

/**
 * Normaliza el DNI eliminando puntos, guiones y espacios.
 */
export function normalizarDni(dni: string): string {
  return dni.replace(/[.\s-]/g, '').trim()
}

/**
 * Valida que el DNI tenga un formato válido (7-8 dígitos).
 */
export function validarDni(dni: string): boolean {
  return /^\d{7,8}$/.test(normalizarDni(dni))
}
