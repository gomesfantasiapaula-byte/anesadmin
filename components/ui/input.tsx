import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'input-base',
              icon && 'pl-10',
              error && 'border-danger focus:border-danger focus:ring-danger',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
