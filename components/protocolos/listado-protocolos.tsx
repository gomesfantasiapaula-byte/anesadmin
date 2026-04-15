'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList } from 'lucide-react'
import { CardProtocolo } from './card-protocolo'
import { FiltrosProtocolos } from './filtros-protocolos'
import type { AnestheticProtocol, Hospital } from '@/lib/db/schema'

type ProtocoloConHospital = AnestheticProtocol & {
  hospitalName?: string | null
  hospitalColor?: string | null
}

interface ListadoProtocolosProps {
  // Permite refrescar desde la page cuando se guarda un nuevo protocolo
  refetchKey?: number
  onNuevo?: () => void
}

export function ListadoProtocolos({ refetchKey, onNuevo }: ListadoProtocolosProps) {
  const [protocolos, setProtocolos] = useState<ProtocoloConHospital[]>([])
  const [hospitales, setHospitales] = useState<Hospital[]>([])
  const [cargando, setCargando]     = useState(true)

  // Filtros
  const [hospitalId, setHospitalId] = useState('')
  const [mes, setMes]               = useState('')     // YYYY-MM

  // Convertir mes YYYY-MM a rango de fechas
  const rangoFechas = (mesYM: string) => {
    if (!mesYM) return { desde: '', hasta: '' }
    const [y, m] = mesYM.split('-').map(Number)
    const ultimo  = new Date(y, m, 0).getDate()
    return {
      desde: `${y}-${String(m).padStart(2, '0')}-01`,
      hasta: `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`,
    }
  }

  const cargarProtocolos = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (hospitalId) params.set('hospitalId', hospitalId)
      const { desde, hasta } = rangoFechas(mes)
      if (desde) params.set('fechaDesde', desde)
      if (hasta) params.set('fechaHasta', hasta)

      const res = await fetch(`/api/protocolos?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProtocolos(data.protocolos ?? [])
      }
    } finally {
      setCargando(false)
    }
  }, [hospitalId, mes])

  // Cargar hospitales una sola vez al montar
  useEffect(() => {
    fetch('/api/hospitales')
      .then((r) => r.json())
      .then((d) => setHospitales(d.hospitales ?? []))
      .catch(() => {})
  }, [])

  // Recargar cuando cambian filtros o se agrega un nuevo protocolo
  useEffect(() => {
    cargarProtocolos()
  }, [cargarProtocolos, refetchKey])

  const handleEliminar = (id: string) => {
    setProtocolos((prev) => prev.filter((p) => p.id !== id))
  }

  const limpiarFiltros = () => {
    setHospitalId('')
    setMes('')
  }

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-80 bg-surface-elevated rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-elevated border border-border overflow-hidden">
              <div className="h-36 bg-border/30 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-border/30 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-border/20 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-border/20 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <FiltrosProtocolos
        hospitales={hospitales}
        hospitalId={hospitalId}
        mes={mes}
        onHospitalChange={setHospitalId}
        onMesChange={setMes}
        onLimpiar={limpiarFiltros}
      />

      {/* Estado vacío */}
      {protocolos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center">
            <ClipboardList size={28} className="text-text-secondary" />
          </div>
          <div className="text-center">
            <p className="text-text-primary font-medium">
              {hospitalId || mes ? 'Sin resultados con esos filtros' : 'Todavía no hay protocolos'}
            </p>
            <p className="text-text-secondary text-sm mt-1">
              {hospitalId || mes
                ? 'Probá con otros filtros o limpiá la búsqueda.'
                : 'Sacá una foto de un protocolo anestésico para empezar.'}
            </p>
          </div>
          {!(hospitalId || mes) && onNuevo && (
            <button onClick={onNuevo} className="btn-primary">
              Nuevo protocolo
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {protocolos.length} protocolo{protocolos.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {protocolos.map((p) => (
              <CardProtocolo key={p.id} protocolo={p} onEliminar={handleEliminar} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
