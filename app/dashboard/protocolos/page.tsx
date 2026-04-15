'use client'

import { useState } from 'react'
import { Plus, Grid } from 'lucide-react'
import { CapturaProtocolo } from '@/components/protocolos/captura-protocolo'
import { ListadoProtocolos } from '@/components/protocolos/listado-protocolos'

type Vista = 'listado' | 'nuevo'

export default function ProtocolosPage() {
  const [vista, setVista]           = useState<Vista>('listado')
  const [refetchKey, setRefetchKey] = useState(0)

  const handleGuardado = () => {
    setVista('listado')
    setRefetchKey((k) => k + 1)
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight">
            Protocolos Anestésicos
          </h1>
          <p className="text-text-secondary text-sm mt-0.5 hidden sm:block">
            Fotografías de protocolos en papel
          </p>
        </div>

        {/* Toggle de vista */}
        <div className="flex rounded-xl overflow-hidden border border-border flex-shrink-0">
          <button
            onClick={() => setVista('listado')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-colors ${
              vista === 'listado'
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Grid size={15} />
            <span className="hidden sm:inline">Galería</span>
          </button>
          <button
            onClick={() => setVista('nuevo')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-colors ${
              vista === 'nuevo'
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Contenido */}
      {vista === 'listado' ? (
        <ListadoProtocolos refetchKey={refetchKey} onNuevo={() => setVista('nuevo')} />
      ) : (
        <CapturaProtocolo onGuardado={handleGuardado} />
      )}
    </div>
  )
}
