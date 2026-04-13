'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import type { Hospital } from '@/lib/db/schema'

interface RegistroJornadaProps {
  hospitales: Hospital[]
  onRegistrado: () => void
}

export function RegistroJornada({ hospitales, onRegistrado }: RegistroJornadaProps) {
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    hospitalId: '',
    date: hoy,
    timeIn: '',
    timeOut: '',
    notes: '',
  })

  const set = (campo: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.hospitalId) {
      toast.error('Seleccioná un hospital')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: form.hospitalId,
          date: form.date,
          timeIn: form.timeIn || undefined,
          timeOut: form.timeOut || undefined,
          notes: form.notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Jornada registrada')
      setForm({ hospitalId: '', date: hoy, timeIn: '', timeOut: '', notes: '' })
      onRegistrado()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
        <Clock size={16} className="text-accent-primary" />
        Registrar jornada
      </h3>

      {/* Hospital */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          Hospital / Clínica *
        </label>
        <div className="relative">
          <Building2
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <select
            value={form.hospitalId}
            onChange={set('hospitalId')}
            className="input-base pl-10 appearance-none"
          >
            <option value="">Seleccioná un hospital...</option>
            {hospitales.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha */}
      <Input
        label="Fecha"
        type="date"
        value={form.date}
        onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
      />

      {/* Horarios */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Hora entrada"
          type="time"
          value={form.timeIn}
          onChange={(e) => setForm((prev) => ({ ...prev, timeIn: e.target.value }))}
          icon={<Clock size={16} />}
        />
        <Input
          label="Hora salida"
          type="time"
          value={form.timeOut}
          onChange={(e) => setForm((prev) => ({ ...prev, timeOut: e.target.value }))}
          icon={<Clock size={16} />}
        />
      </div>

      <Button type="submit" loading={guardando} className="w-full">
        Registrar jornada
      </Button>
    </form>
  )
}
