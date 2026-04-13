'use client'

import { useState } from 'react'
import { CapturaOCR } from '@/components/ocr/captura-ocr'
import { ListadoDocumentos } from '@/components/ocr/listado-documentos'
import { Plus, List } from 'lucide-react'

type Vista = 'nuevo' | 'listado'

export default function DocumentosPage() {
  const [vista, setVista] = useState<Vista>('listado')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Documentos OCR</h1>
          <p className="text-text-secondary text-sm mt-1">
            Partes quirúrgicos y anestesiológicos digitalizados
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
            <List size={16} />
            Listado
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

      {vista === 'listado' ? <ListadoDocumentos /> : <CapturaOCR />}
    </div>
  )
}
