'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Search, Loader2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { truncar, formatearFecha } from '@/lib/utils'
import type { Document } from '@/lib/db/schema'

const tipoLabels: Record<string, string> = {
  quirurgico: 'Quirúrgico',
  anestesiologico: 'Anestesiológico',
  otro: 'Otro',
}

export function ListadoDocumentos() {
  const [documentos, setDocumentos] = useState<Document[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const fetchDocs = useCallback(async (q?: string) => {
    setCargando(true)
    try {
      const url = q ? `/api/documentos?q=${encodeURIComponent(q)}` : '/api/documentos'
      const res = await fetch(url)
      const data = await res.json()
      setDocumentos(data.documentos ?? [])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => fetchDocs(busqueda), 400)
    return () => clearTimeout(timer)
  }, [busqueda, fetchDocs])

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <Input
        placeholder="Buscar en documentos..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        icon={<Search size={16} />}
      />

      {/* Lista */}
      {cargando ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : documentos.length === 0 ? (
        <div className="card flex flex-col items-center py-16">
          <FileText size={40} className="text-text-secondary/30 mb-3" />
          <p className="text-text-secondary text-sm">
            {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay documentos todavía'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="card hover:border-accent-primary/20 transition-colors duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant={
                        doc.docType === 'quirurgico'
                          ? 'accent'
                          : doc.docType === 'anestesiologico'
                          ? 'success'
                          : 'default'
                      }
                    >
                      {tipoLabels[doc.docType] ?? doc.docType}
                    </Badge>
                    {doc.patientDni && (
                      <span className="text-xs text-text-secondary">
                        DNI {doc.patientDni}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-text-primary/80 font-mono leading-relaxed">
                    {truncar(doc.ocrText, 200)}
                  </p>

                  <p className="text-xs text-text-secondary mt-2">
                    {formatearFecha(doc.createdAt)}
                  </p>
                </div>

                {doc.imageUrl && (
                  <a
                    href={doc.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-secondary hover:text-accent-primary transition-colors flex-shrink-0"
                    title="Ver imagen original"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
