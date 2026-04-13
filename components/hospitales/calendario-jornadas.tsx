'use client'

import { useState, useEffect } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { WorkSession, Hospital } from '@/lib/db/schema'

interface CalendarioJornadasProps {
  hospitales: Hospital[]
}

export function CalendarioJornadas({ hospitales }: CalendarioJornadasProps) {
  const [mesActual, setMesActual] = useState(new Date())
  const [jornadas, setJornadas] = useState<WorkSession[]>([])

  // Mapa de hospitalId → color para renderizar
  const colorMap = Object.fromEntries(
    hospitales.map((h) => [h.id, h.color ?? '#00d4aa']),
  )

  // Cargar jornadas del mes
  useEffect(() => {
    const desde = format(startOfMonth(mesActual), 'yyyy-MM-dd')
    const hasta = format(endOfMonth(mesActual), 'yyyy-MM-dd')

    fetch(`/api/jornadas?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((data) => setJornadas(data.jornadas ?? []))
  }, [mesActual])

  const diasDelMes = eachDayOfInterval({
    start: startOfMonth(mesActual),
    end: endOfMonth(mesActual),
  })

  // Primer día de la semana del mes (para offset de cuadrícula)
  const primerDia = startOfMonth(mesActual)
  // En Argentina la semana empieza en lunes (0=Dom, 1=Lun...)
  const offsetInicio = (primerDia.getDay() + 6) % 7

  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="card">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-text-primary capitalize">
          {format(mesActual, 'MMMM yyyy', { locale: es })}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() =>
              setMesActual(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1),
              )
            }
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMesActual(new Date())}
            className="px-3 py-1 text-xs font-medium text-text-secondary hover:text-accent-primary transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() =>
              setMesActual(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1),
              )
            }
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 mb-2">
        {diasSemana.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-text-secondary py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-1">
        {/* Celdas vacías de offset */}
        {Array.from({ length: offsetInicio }).map((_, i) => (
          <div key={`offset-${i}`} />
        ))}

        {diasDelMes.map((dia) => {
          const fechaStr = format(dia, 'yyyy-MM-dd')
          const jornadasDia = jornadas.filter((j) => j.date === fechaStr)
          const esHoy = isToday(dia)
          const esMes = isSameMonth(dia, mesActual)

          return (
            <div
              key={fechaStr}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-start pt-1 text-xs transition-colors ${
                esHoy
                  ? 'bg-accent-primary/10 border border-accent-primary/30'
                  : 'hover:bg-surface-elevated'
              } ${!esMes ? 'opacity-30' : ''}`}
            >
              <span
                className={`font-medium ${
                  esHoy ? 'text-accent-primary' : 'text-text-primary'
                }`}
              >
                {format(dia, 'd')}
              </span>

              {/* Puntos de color por hospital */}
              {jornadasDia.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {jornadasDia.slice(0, 3).map((j) => (
                    <span
                      key={j.id}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: colorMap[j.hospitalId] ?? '#00d4aa',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Leyenda de hospitales */}
      {hospitales.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3">
          {hospitales.map((h) => (
            <div key={h.id} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: h.color ?? '#00d4aa' }}
              />
              <span className="text-xs text-text-secondary">{h.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
