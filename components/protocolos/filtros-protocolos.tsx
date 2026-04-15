'use client'

import { X } from 'lucide-react'
import type { Hospital } from '@/lib/db/schema'

interface FiltrosProtocolosProps {
  hospitales: Hospital[]
  hospitalId: string
  mes: string          // formato YYYY-MM (input type="month")
  onHospitalChange: (id: string) => void
  onMesChange: (mes: string) => void
  onLimpiar: () => void
}

export function FiltrosProtocolos({
  hospitales,
  hospitalId,
  mes,
  onHospitalChange,
  onMesChange,
  onLimpiar,
}: FiltrosProtocolosProps) {
  const hayFiltros = hospitalId !== '' || mes !== ''

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Filtro por hospital */}
      {hospitales.length > 0 && (
        <select
          value={hospitalId}
          onChange={(e) => onHospitalChange(e.target.value)}
          className="bg-surface-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors min-w-[160px]"
        >
          <option value="">Todas las instituciones</option>
          {hospitales.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      )}

      {/* Filtro por mes */}
      <input
        type="month"
        value={mes}
        onChange={(e) => onMesChange(e.target.value)}
        className="bg-surface-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors"
      />

      {/* Limpiar */}
      {hayFiltros && (
        <button
          onClick={onLimpiar}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-elevated border border-transparent hover:border-border"
        >
          <X size={13} />
          Limpiar
        </button>
      )}
    </div>
  )
}
