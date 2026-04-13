import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { workSessions, hospitals, documents } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { Stethoscope, Building2, FileText, Clock } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { ActivityChart } from '@/components/dashboard/activity-chart'
import { formatearFecha } from '@/lib/utils'
import { startOfMonth, subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'

async function getDashboardData(userId: string) {
  const hoy = new Date()
  const inicioMes = startOfMonth(hoy)

  const [jornadasMes, hospitalesActivos, docsDelMes] = await Promise.all([
    db
      .select()
      .from(workSessions)
      .where(
        and(
          eq(workSessions.userId, userId),
          gte(workSessions.date, format(inicioMes, 'yyyy-MM-dd')),
        ),
      ),
    db.select().from(hospitals).where(eq(hospitals.userId, userId)),
    db
      .select()
      .from(documents)
      .where(
        and(eq(documents.userId, userId), gte(documents.createdAt, inicioMes)),
      ),
  ])

  // Actividad últimos 7 días
  const actividadSemanal = Array.from({ length: 7 }, (_, i) => {
    const dia = subDays(hoy, 6 - i)
    const fechaStr = format(dia, 'yyyy-MM-dd')
    const jornadasDia = jornadasMes.filter((j) => j.date === fechaStr)
    return {
      dia: format(dia, 'EEE', { locale: es }),
      cirugias: jornadasDia.length,
      horas: jornadasDia.reduce((acc, j) => {
        if (j.timeIn && j.timeOut) {
          const [ih, im] = j.timeIn.split(':').map(Number)
          const [oh, om] = j.timeOut.split(':').map(Number)
          return acc + Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60)
        }
        return acc
      }, 0),
    }
  })

  const horasMes = jornadasMes.reduce((acc, j) => {
    if (j.timeIn && j.timeOut) {
      const [ih, im] = j.timeIn.split(':').map(Number)
      const [oh, om] = j.timeOut.split(':').map(Number)
      return acc + Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60)
    }
    return acc
  }, 0)

  return {
    jornadasMes: jornadasMes.length,
    hospitalesActivos: hospitalesActivos.length,
    documentosDelMes: docsDelMes.length,
    horasMes: Math.round(horasMes),
    actividadSemanal,
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const userId = session!.user!.id!
  const data = await getDashboardData(userId)

  const nombreCorto = session!.user!.name?.split(' ')[0] ?? 'Doctora'
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {saludo}, {nombreCorto}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          {formatearFecha(new Date(), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Jornadas este mes"
          value={data.jornadasMes}
          subtitle="días trabajados"
          icon={Stethoscope}
          accentColor="cyan"
        />
        <MetricCard
          title="Hospitales activos"
          value={data.hospitalesActivos}
          subtitle="instituciones"
          icon={Building2}
          accentColor="purple"
        />
        <MetricCard
          title="Documentos OCR"
          value={data.documentosDelMes}
          subtitle="este mes"
          icon={FileText}
          accentColor="green"
        />
        <MetricCard
          title="Horas trabajadas"
          value={`${data.horasMes}h`}
          subtitle="este mes"
          icon={Clock}
          accentColor="yellow"
        />
      </div>

      {/* Gráfico semanal */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Actividad semanal
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Últimos 7 días</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-primary" />
              <span className="text-text-secondary">Jornadas</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-secondary" />
              <span className="text-text-secondary">Horas</span>
            </span>
          </div>
        </div>
        <ActivityChart data={data.actividadSemanal} />
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            href: '/dashboard/pacientes',
            icon: Stethoscope,
            iconColor: 'text-accent-primary',
            bg: 'bg-accent-primary/10',
            border: 'border-accent-primary/20',
            title: 'Consultar paciente',
            desc: 'Búsqueda por DNI',
          },
          {
            href: '/dashboard/documentos',
            icon: FileText,
            iconColor: 'text-success',
            bg: 'bg-success/10',
            border: 'border-success/20',
            title: 'Nuevo documento',
            desc: 'Captura OCR',
          },
          {
            href: '/dashboard/hospitales',
            icon: Building2,
            iconColor: 'text-accent-secondary',
            bg: 'bg-accent-secondary/10',
            border: 'border-accent-secondary/20',
            title: 'Registrar jornada',
            desc: 'Hospitales',
          },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="card hover:border-accent-primary/30 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bg} border ${item.border}`}>
                <item.icon size={18} className={item.iconColor} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary group-hover:text-accent-primary transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-text-secondary">{item.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
