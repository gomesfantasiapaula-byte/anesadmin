import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  // Color del ícono y acento
  accentColor?: 'cyan' | 'purple' | 'green' | 'yellow' | 'red'
  // Tendencia respecto al período anterior
  trend?: {
    value: number
    label: string
  }
  className?: string
}

const accentStyles = {
  cyan: {
    icon: 'text-accent-primary',
    bg: 'bg-accent-primary/10',
    border: 'border-accent-primary/20',
  },
  purple: {
    icon: 'text-accent-secondary',
    bg: 'bg-accent-secondary/10',
    border: 'border-accent-secondary/20',
  },
  green: {
    icon: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
  },
  yellow: {
    icon: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
  },
  red: {
    icon: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/20',
  },
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = 'cyan',
  trend,
  className,
}: MetricCardProps) {
  const accent = accentStyles[accentColor]
  const trendPositive = trend && trend.value >= 0

  return (
    <div className={cn('card group hover:border-border/80 transition-colors duration-200', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <p className="metric-label">{title}</p>
        <div
          className={cn(
            'p-2 rounded-lg border',
            accent.bg,
            accent.border,
          )}
        >
          <Icon size={18} className={accent.icon} />
        </div>
      </div>

      {/* Valor principal */}
      <p className="metric-number mb-1">{value}</p>

      {/* Subtítulo y tendencia */}
      <div className="flex items-center gap-3 mt-2">
        {subtitle && (
          <span className="text-xs text-text-secondary">{subtitle}</span>
        )}
        {trend && (
          <span
            className={cn(
              'text-xs font-medium flex items-center gap-0.5',
              trendPositive ? 'text-success' : 'text-danger',
            )}
          >
            {trendPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            <span className="text-text-secondary font-normal ml-1">
              {trend.label}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
