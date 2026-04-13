'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DatoActividad {
  dia: string
  cirugias: number
  horas: number
}

interface ActivityChartProps {
  data: DatoActividad[]
}

// Tooltip personalizado estilo WHOOP
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-3 text-xs">
      <p className="text-text-secondary font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="text-accent-primary font-bold">{entry.value}</span>
          <span className="text-text-secondary">
            {entry.name === 'cirugias' ? 'cirugías' : 'horas'}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradientCirugias" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradientHoras" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />

        <XAxis
          dataKey="dia"
          tick={{ fill: '#8a8a8a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          tick={{ fill: '#8a8a8a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="cirugias"
          stroke="#00d4aa"
          strokeWidth={2}
          fill="url(#gradientCirugias)"
          dot={false}
          activeDot={{ r: 4, fill: '#00d4aa', stroke: '#0a0a0a', strokeWidth: 2 }}
        />

        <Area
          type="monotone"
          dataKey="horas"
          stroke="#7c3aed"
          strokeWidth={2}
          fill="url(#gradientHoras)"
          dot={false}
          activeDot={{ r: 4, fill: '#7c3aed', stroke: '#0a0a0a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
