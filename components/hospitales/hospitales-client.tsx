'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Building2, Phone, MapPin, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormHospital } from './form-hospital'
import { CalendarioJornadas } from './calendario-jornadas'
import { RegistroJornada } from './registro-jornada'
import type { Hospital } from '@/lib/db/schema'

interface HospitalesClientProps {
  hospitalesIniciales: Hospital[]
}

export function HospitalesClient({ hospitalesIniciales }: HospitalesClientProps) {
  const [hospitales, setHospitales] = useState<Hospital[]>(hospitalesIniciales)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<Hospital | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleGuardado = (hospital: Hospital) => {
    if (editando) {
      setHospitales((prev) => prev.map((h) => (h.id === hospital.id ? hospital : h)))
    } else {
      setHospitales((prev) => [hospital, ...prev])
    }
    setMostrarForm(false)
    setEditando(null)
  }

  const handleEliminar = async (id: string) => {
    setEliminando(id)
    try {
      const res = await fetch(`/api/hospitales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setHospitales((prev) => prev.filter((h) => h.id !== id))
      toast.success('Hospital eliminado')
    } catch {
      toast.error('Error al eliminar el hospital')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Lista de hospitales */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Mis hospitales ({hospitales.length})
          </h2>
          <Button
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditando(null)
              setMostrarForm(!mostrarForm)
            }}
          >
            Agregar
          </Button>
        </div>

        {/* Formulario nuevo/editar */}
        {(mostrarForm || editando) && (
          <div className="border border-border rounded-xl p-4 bg-surface-elevated animate-fade-in">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              {editando ? 'Editar hospital' : 'Nuevo hospital'}
            </h3>
            <FormHospital
              hospital={editando ?? undefined}
              onGuardado={handleGuardado}
              onCancelar={() => {
                setMostrarForm(false)
                setEditando(null)
              }}
            />
          </div>
        )}

        {/* Lista */}
        {hospitales.length === 0 ? (
          <div className="py-12 flex flex-col items-center">
            <Building2 size={40} className="text-text-secondary/30 mb-3" />
            <p className="text-text-secondary text-sm">
              No tenés hospitales cargados todavía
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {hospitales.map((hospital) => (
              <div
                key={hospital.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-border/80 transition-colors group"
              >
                {/* Indicador de color */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: hospital.color ?? '#00d4aa' }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {hospital.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {hospital.address && (
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <MapPin size={10} />
                        {hospital.address}
                      </span>
                    )}
                    {hospital.phone && (
                      <span className="text-xs text-text-secondary flex items-center gap-1">
                        <Phone size={10} />
                        {hospital.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditando(hospital)
                      setMostrarForm(false)
                    }}
                    className="p-1.5 text-text-secondary hover:text-accent-primary transition-colors rounded-lg hover:bg-accent-primary/10"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleEliminar(hospital.id)}
                    disabled={eliminando === hospital.id}
                    className="p-1.5 text-text-secondary hover:text-danger transition-colors rounded-lg hover:bg-danger/10 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registro de jornada y calendario */}
      {hospitales.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RegistroJornada
            hospitales={hospitales}
            onRegistrado={() => setRefreshKey((k) => k + 1)}
          />
          <CalendarioJornadas key={refreshKey} hospitales={hospitales} />
        </div>
      )}
    </div>
  )
}
