import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases de Tailwind de forma segura, resolviendo conflictos.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea una fecha en español argentino.
 */
export function formatearFecha(
  fecha: Date | string,
  opciones?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opciones,
  })
}

/**
 * Formatea una hora en formato HH:mm.
 */
export function formatearHora(hora: string | null | undefined): string {
  if (!hora) return '--:--'
  return hora.slice(0, 5)
}

/**
 * Calcula la diferencia en horas entre dos strings de tiempo HH:mm.
 */
export function calcularHoras(timeIn: string, timeOut: string): number {
  const [inH, inM] = timeIn.split(':').map(Number)
  const [outH, outM] = timeOut.split(':').map(Number)
  const totalMinutos = outH * 60 + outM - (inH * 60 + inM)
  return Math.max(0, totalMinutos / 60)
}

/**
 * Trunca un texto a una longitud máxima con elipsis.
 */
export function truncar(texto: string, maxLength = 100): string {
  if (texto.length <= maxLength) return texto
  return texto.slice(0, maxLength) + '...'
}
