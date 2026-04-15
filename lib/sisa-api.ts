/**
 * Cliente para la API de SISA (Sistema Integrado de Información Sanitaria Argentina)
 * del Ministerio de Salud de la Nación.
 *
 * Endpoint: https://sisa.msal.gov.ar/sisa/services/rest/cobertura/obtener
 * Requiere usuario/clave otorgados por MSAL. Si no están configurados,
 * devuelve un resultado "sin datos" en lugar de lanzar error.
 */

// Tipos de respuesta de la API SISA
export interface SisaCobertura {
  dni: string
  sexo: string
  nombre?: string
  apellido?: string
  fechaNacimiento?: string
  obraSocial?: string
  rnos?: string
  nroAfiliado?: string
  vigencia?: string
  estado?: string
  errorCodigo?: string
  errorDescripcion?: string
  // Campo propio cuando SISA no está configurada
  sinDatos?: boolean
}

export type SisaSexo = 'M' | 'F'

/**
 * Consulta la cobertura de salud de un paciente por DNI y sexo.
 * La función es llamada desde el API route del servidor (nunca desde el cliente).
 *
 * @param dni - DNI sin puntos (ej: "12345678")
 * @param sexo - "M" masculino o "F" femenino
 */
export async function consultarCoberturaSisa(
  dni: string,
  sexo: SisaSexo,
): Promise<SisaCobertura> {
  const usuario = process.env.SISA_USUARIO
  const clave = process.env.SISA_CLAVE

  // Si no hay credenciales configuradas, devolver respuesta vacía sin tirar error
  if (!usuario || !clave) {
    console.warn('[SISA] SISA_USUARIO/SISA_CLAVE no configurados. Devolviendo sin datos.')
    return { dni, sexo, sinDatos: true, errorDescripcion: 'Credenciales SISA no configuradas' }
  }

  const url = new URL(
    'https://sisa.msal.gov.ar/sisa/services/rest/cobertura/obtener',
  )
  url.searchParams.set('usuario', usuario)
  url.searchParams.set('clave', clave)
  url.searchParams.set('dni', dni.replace(/\./g, ''))
  url.searchParams.set('sexo', sexo)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AnesAdmin/1.0',
    },
    // Timeout de 15 segundos (SISA puede ser lento)
    signal: AbortSignal.timeout(15_000),
    // No cachear en el fetch de Next.js — el cache lo manejamos en KV/Postgres
    cache: 'no-store',
  })

  // SISA a veces devuelve 200 con HTML de error, capturamos el texto primero
  const text = await response.text()

  if (!response.ok) {
    throw new Error(
      `Error SISA API HTTP ${response.status}: ${text.slice(0, 200)}`,
    )
  }

  let data: SisaCobertura
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`SISA no devolvió JSON válido. Respuesta: ${text.slice(0, 300)}`)
  }

  return data
}

/**
 * Normaliza el DNI eliminando puntos y espacios.
 */
export function normalizarDni(dni: string): string {
  return dni.replace(/[\.\s-]/g, '').trim()
}

/**
 * Valida que el DNI tenga un formato válido (7-8 dígitos).
 */
export function validarDni(dni: string): boolean {
  const normalizado = normalizarDni(dni)
  return /^\d{7,8}$/.test(normalizado)
}
