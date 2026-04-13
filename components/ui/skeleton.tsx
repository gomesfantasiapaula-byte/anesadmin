import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

// Skeleton loader estilo WHOOP con shimmer
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton rounded-lg', className)}
      aria-hidden="true"
    />
  )
}

// Skeleton para card de métrica
export function MetricCardSkeleton() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}
