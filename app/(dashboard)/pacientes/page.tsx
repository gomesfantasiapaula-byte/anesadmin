import { BuscadorPaciente } from '@/components/pacientes/buscador-paciente'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pacientes',
}

export default function PacientesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Pacientes</h1>
        <p className="text-text-secondary text-sm mt-1">
          Consulta de cobertura de salud vía API SISA del Ministerio de Salud
        </p>
      </div>

      <BuscadorPaciente />
    </div>
  )
}
