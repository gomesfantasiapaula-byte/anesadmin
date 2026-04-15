'use client'

import { useState } from 'react'
import { CapturaOCR } from '@/components/ocr/captura-ocr'
import { ListadoDocumentos } from '@/components/ocr/listado-documentos'
import { Plus, List } from 'lucide-react'

type Vista = 'nuevo' | 'listado'

export default function DocumentosPage() {
  const [vista, setVista] = useState<Vista>('listado')

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight">
            Documentos OCR
          </h1>
          <p className="text-text-secondary text-sm mt-0.5 hidden sm:block">
            Partes quirúrgicos y anestesiológicos digitalizados
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
            <List size={15} />
            <span className="hidden sm:inline">Listado</span>
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

      {vista === 'listado' ? <ListadoDocumentos /> : <CapturaOCR />}
    </div>
  )
}
