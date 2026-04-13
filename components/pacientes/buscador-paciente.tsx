'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Search, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SisaCobertura } from '@/lib/sisa-api'

interface ResultadoPaciente {
  data: SisaCobertura
  fuente: 'cache' | 'cache-db' | 'api-sisa'
}

export function BuscadorPaciente() {
  const [dni, setDni] = useState('')
  const [sexo, setSexo] = useState<'M' | 'F'>('F')
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoPaciente | null>(null)

  const buscar = async () => {
    if (!dni.trim()) {
      toast.error('Ingresá un DNI para buscar')
      return
    }

    setCargando(true)
    setResultado(null)

    try {
      const res = await fetch(
        `/api/pacientes/dni?dni=${encodeURIComponent(dni)}&sexo=${sexo}`,
      )
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Error al consultar')
        return
      }

      setResultado(json)
    } catch {
      toast.error('Error de red. Verificá tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar()
  }

  return (
    <div className="space-y-6">
      {/* Formulario de búsqueda */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-4">
          Consultar cobertura por DNI
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Selector de sexo */}
          <div className="flex rounded-xl overflow-hidden border border-border flex-shrink-0">
            {(['F', 'M'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSexo(s)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  sexo === s
                    ? 'bg-accent-primary text-background'
                    : 'bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                {s === 'F' ? 'Femenino' : 'Masculino'}
              </button>
            ))}
          </div>

          {/* Input DNI */}
          <div className="flex-1">
            <Input
              placeholder="Ej: 12345678"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              onKeyDown={handleKeyDown}
              icon={<Search size={16} />}
              type="number"
              inputMode="numeric"
            />
          </div>

          <Button
            onClick={buscar}
            loading={cargando}
            icon={<Search size={16} />}
            size="lg"
            className="flex-shrink-0"
          >
            Buscar
          </Button>
        </div>
      </div>

      {/* Resultado */}
      {cargando && (
        <div className="card flex items-center justify-center py-12">
          <Loader2 size={32} className="text-accent-primary animate-spin" />
          <span className="ml-3 text-text-secondary">
            Consultando SISA MSAL...
          </span>
        </div>
      )}

      {resultado && !cargando && (
        <ResultadoCard resultado={resultado} />
      )}
    </div>
  )
}

function ResultadoCard({ resultado }: { resultado: ResultadoPaciente }) {
  const { data, fuente } = resultado
  const tieneError = !!data.errorCodigo

  if (tieneError) {
    return (
      <div className="card border-danger/20 bg-danger/5">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger">
              Paciente no encontrado
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {data.errorDescripcion ?? 'Sin cobertura registrada en SISA'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const nombreCompleto = [data.apellido, data.nombre]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="card border-accent-primary/20 animate-fade-in">
      {/* Header del paciente */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar placeholder */}
        <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
          <User size={24} className="text-accent-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                {nombreCompleto || 'Sin nombre registrado'}
              </h3>
              <p className="text-text-secondary text-sm">
                DNI {data.dni}
                {data.fechaNacimiento && ` · ${data.fechaNacimiento}`}
              </p>
            </div>
            <Badge
              variant={data.vigencia === 'VIGENTE' ? 'success' : 'warning'}
            >
              <ShieldCheck size={12} />
              {data.vigencia ?? 'Sin estado'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Datos de cobertura */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
        <DataField label="Obra social / Prepaga" value={data.obraSocial} />
        <DataField label="Código RNOS" value={data.rnos} />
        <DataField label="N° de afiliado" value={data.nroAfiliado} />
        <DataField label="Estado de cobertura" value={data.estado} />
      </div>

      {/* Metadatos del cache */}
      <p className="mt-4 text-right text-xs text-text-secondary/50">
        {fuente === 'api-sisa' ? 'Dato en tiempo real · SISA MSAL' : 'Dato en caché (24hs)'}
      </p>
    </div>
  )
}

function DataField({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div>
      <p className="metric-label mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">
        {value ?? '—'}
      </p>
    </div>
  )
}
