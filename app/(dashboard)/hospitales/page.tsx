import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hospitals, workSessions } from '@/lib/db/schema'
import { eq, gte, sql } from 'drizzle-orm'
import { HospitalesClient } from '@/components/hospitales/hospitales-client'
import { startOfMonth, format } from 'date-fns'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hospitales',
}

export default async function HospitalesPage() {
  const session = await getServerSession(authOptions)
  const userId = session!.user!.id!

  const [listaHospitales] = await Promise.all([
    db.select().from(hospitals).where(eq(hospitals.userId, userId)),
  ])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Hospitales y Clínicas</h1>
        <p className="text-text-secondary text-sm mt-1">
          Gestioná tus instituciones y registrá tus jornadas
        </p>
      </div>

      <HospitalesClient hospitalesIniciales={listaHospitales} />
    </div>
  )
}
