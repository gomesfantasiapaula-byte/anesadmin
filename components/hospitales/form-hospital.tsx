'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Phone, MapPin, User, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Hospital } from '@/lib/db/schema'

interface FormHospitalProps {
  hospital?: Hospital
  onGuardado: (hospital: Hospital) => void
  onCancelar?: () => void
}

// Colores predefinidos para el calendario
const COLORES = [
  '#00d4aa', // cyan
  '#7c3aed', // purple
  '#22c55e', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#3b82f6', // blue
  '#ec4899', // pink
  '#f97316', // orange
]

export function FormHospital({ hospital, onGuardado, onCancelar }: FormHospitalProps) {
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    name: hospital?.name ?? '',
    address: hospital?.address ?? '',
    phone: hospital?.phone ?? '',
    contact: hospital?.contact ?? '',
    notes: hospital?.notes ?? '',
    color: hospital?.color ?? '#00d4aa',
  })

  const set = (campo: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('El nombre del hospital es obligatorio')
      return
    }

    setGuardando(true)
    try {
      const url = hospital ? `/api/hospitales/${hospital.id}` : '/api/hospitales'
      const method = hospital ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(hospital ? 'Hospital actualizado' : 'Hospital creado')
      onGuardado(data.hospital)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre del hospital / clínica *"
        placeholder="Ej: Hospital Italiano de Buenos Aires"
        value={form.name}
        onChange={set('name')}
        icon={<Building2 size={16} />}
      />

      <Input
        label="Dirección"
        placeholder="Av. Pdte. Perón 4190, CABA"
        value={form.address}
        onChange={set('address')}
        icon={<MapPin size={16} />}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Teléfono"
          placeholder="011-4959-0200"
          value={form.phone}
          onChange={set('phone')}
          icon={<Phone size={16} />}
        />

        <Input
          label="Contacto"
          placeholder="Dra. García"
          value={form.contact}
          onChange={set('contact')}
          icon={<User size={16} />}
        />
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          Notas
        </label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          placeholder="Horarios especiales, indicaciones de acceso..."
          className="input-base resize-none"
        />
      </div>

      {/* Color para el calendario */}
      <div>
        <p className="text-sm font-medium text-text-secondary mb-2">
          Color en el calendario
        </p>
        <div className="flex gap-2 flex-wrap">
          {COLORES.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, color }))}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                backgroundColor: color,
                borderColor: form.color === color ? '#ffffff' : 'transparent',
                boxShadow: form.color === color ? `0 0 0 2px ${color}40` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        {onCancelar && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancelar}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={guardando} className="flex-1">
          {hospital ? 'Actualizar' : 'Crear hospital'}
        </Button>
      </div>
    </form>
  )
}
