import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// ── GET /api/pacientes/perfil?dni=XXX ────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dni = request.nextUrl.searchParams.get('dni')?.replace(/[.\s-]/g, '').trim()
  if (!dni || !/^\d{7,8}$/.test(dni)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }

  const [patient] = await db.select().from(patients).where(eq(patients.dni, dni)).limit(1)
  return NextResponse.json({ patient: patient ?? null })
}

// ── POST /api/pacientes/perfil ────────────────────────────────────────────────
// Crea o actualiza el perfil completo de un paciente.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const dni = body.dni?.replace(/[.\s-]/g, '').trim()

  if (!dni || !/^\d{7,8}$/.test(dni)) {
    return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
  }
  if (!body.sexo || !['M', 'F'].includes(body.sexo)) {
    return NextResponse.json({ error: 'Sexo inválido' }, { status: 400 })
  }

  const values = {
    dni,
    sexo: body.sexo as 'M' | 'F',
    nombre: body.nombre?.trim() || null,
    apellido: body.apellido?.trim() || null,
    fechaNacimiento: body.fechaNacimiento?.trim() || null,
    // Cobertura automática (cuando el anestesiólogo guarda un resultado de PAMI/SSS)
    coberturaAutoNombre: body.coberturaAutoNombre?.trim() || null,
    coberturaAutoFuente: body.coberturaAutoFuente?.trim() || null,
    coberturaAutoFecha: body.coberturaAutoNombre ? new Date() : null,
    // Cobertura manual
    coberturaTipo: body.coberturaTipo?.trim() || null,
    coberturaNombre: body.coberturaNombre?.trim() || null,
    coberturaCredencial: body.coberturaCredencial?.trim() || null,
    coberturaPlan: body.coberturaPlan?.trim() || null,
    coberturaNotas: body.coberturaNotas?.trim() || null,
    updatedAt: new Date(),
  }

  await db
    .insert(patients)
    .values(values)
    .onConflictDoUpdate({
      target: patients.dni,
      set: values,
    })

  const [updated] = await db.select().from(patients).where(eq(patients.dni, dni)).limit(1)
  return NextResponse.json({ patient: updated })
}
