'use client'

import { useState } from 'react'
import { Plus, Grid } from 'lucide-react'
import { CapturaProtocolo } from '@/components/protocolos/captura-protocolo'
import { ListadoProtocolos } from '@/components/protocolos/listado-protocolos'

type Vista = 'listado' | 'nuevo'

export default function ProtocolosPage() {
  const [vista, setVista]         = useState<Vista>('listado')
  const [refetchKey, setRefetchKey] = useState(0)

  const handleGuardado = () => {
    // Vuelve al listado y fuerza recarga
    setVista('listado')
    setRefetchKey((k) => k + 1)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Protocolos Anestésicos</h1>
          <p className="text-text-secondary text-sm mt-1">
            Fotografías de protocolos en papel
          </p>
        </div>

        {/* Toggle de vista */}
        <div className="flex rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => setVista('listado')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              vista === 'listado'
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Grid size={16} />
            Galería
          </button>
          <button
            onClick={() => setVista('nuevo')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              vista === 'nuevo'
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Plus size={16} />
            Nuevo
          </button>
        </div>
      </div>

      {/* Contenido */}
      {vista === 'listado' ? (
        <ListadoProtocolos
          refetchKey={refetchKey}
          onNuevo={() => setVista('nuevo')}
        />
      ) : (
        <CapturaProtocolo onGuardado={handleGuardado} />
      )}
    </div>
  )
}
