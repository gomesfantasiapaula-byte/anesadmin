/**
 * Cliente para la API pública de SISA (Sistema Integrado de Información Sanitaria Argentina)
 * del Ministerio de Salud de la Nación.
 *
 * Endpoint: https://sisa.msal.gov.ar/sisa/services/rest/cobertura/obtener
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
  const url = new URL(
    'https://sisa.msal.gov.ar/sisa/services/rest/cobertura/obtener',
  )
  url.searchParams.set('dni', dni.replace(/\./g, ''))
  url.searchParams.set('sexo', sexo)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AnesAdmin/1.0',
    },
    // Timeout de 10 segundos
    signal: AbortSignal.timeout(10_000),
    // No cachear en el fetch de Next.js — el cache lo manejamos en KV
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Error SISA API: ${response.status} ${response.statusText}`,
    )
  }

  const data: SisaCobertura = await response.json()
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
