'use client'

import { useState } from 'react'
import { Trash2, AlertCircle, ExternalLink } from 'lucide-react'
import type { AnestheticProtocol } from '@/lib/db/schema'

interface CardProtocoloProps {
  protocolo: AnestheticProtocol & {
    hospitalName?: string | null
    hospitalColor?: string | null
  }
  onEliminar: (id: string) => void
}

export function CardProtocolo({ protocolo, onEliminar }: CardProtocoloProps) {
  const [confirmando, setConfirmando] = useState(false)
  const [eliminando, setEliminando]   = useState(false)

  const handleEliminar = async () => {
    setEliminando(true)
    try {
      const res = await fetch(`/api/protocolos/${protocolo.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        onEliminar(protocolo.id)
      }
    } finally {
      setEliminando(false)
      setConfirmando(false)
    }
  }

  const fechaFormateada = formatearFecha(protocolo.protocolDate)

  return (
    <div className="group relative rounded-2xl border border-border bg-surface-elevated overflow-hidden hover:border-accent-primary/30 transition-all duration-200">
      {/* Thumbnail */}
      <a
        href={protocolo.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={protocolo.imageUrl}
          alt={`Protocolo ${protocolo.patientLastName}, ${protocolo.patientFirstName}`}
          className="w-full h-36 object-cover bg-black/20"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ExternalLink
            size={20}
            className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
          />
        </div>
      </a>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* Nombre del paciente */}
        <p className="text-sm font-semibold text-text-primary leading-tight truncate">
          {protocolo.patientLastName}, {protocolo.patientFirstName}
        </p>

        {/* Fecha */}
        <p className="text-xs text-text-secondary">{fechaFormateada}</p>

        {/* Hospital badge */}
        {protocolo.hospitalName && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: protocolo.hospitalColor ?? '#00d4aa' }}
            />
            <span className="text-xs text-text-secondary truncate">
              {protocolo.hospitalName}
            </span>
          </div>
        )}

        {/* Notas */}
        {protocolo.notes && (
          <p className="text-xs text-text-secondary italic line-clamp-2">
            {protocolo.notes}
          </p>
        )}
      </div>

      {/* Botón eliminar */}
      <div className="absolute top-2 right-2">
        {confirmando ? (
          <div className="flex items-center gap-1 bg-surface/95 backdrop-blur rounded-xl border border-danger/30 p-1.5 shadow-lg">
            <AlertCircle size={12} className="text-danger flex-shrink-0" />
            <span className="text-xs text-danger font-medium">¿Eliminar?</span>
            <button
              onClick={handleEliminar}
              disabled={eliminando}
              className="text-xs font-semibold text-danger hover:text-danger/80 px-1"
            >
              {eliminando ? '…' : 'Sí'}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-xs text-text-secondary hover:text-text-primary px-1"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-surface/90 backdrop-blur border border-border hover:border-danger/30 hover:text-danger flex items-center justify-center text-text-secondary"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function formatearFecha(isoDate: string): string {
  const [y, m, d] = (isoDate ?? '').split('-')
  if (!y || !m || !d) return isoDate ?? ''
  return `${d}/${m}/${y}`
}
