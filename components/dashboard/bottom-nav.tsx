'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',            icon: LayoutDashboard, label: 'Dashboard',  exact: true },
  { href: '/dashboard/pacientes',  icon: Users,           label: 'Pacientes' },
  { href: '/dashboard/documentos', icon: FileText,        label: 'Docs OCR' },
  { href: '/dashboard/protocolos', icon: ClipboardList,   label: 'Protocolos' },
  { href: '/dashboard/hospitales', icon: Building2,       label: 'Hospitales' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-surface border-t border-border safe-area-bottom">
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const activo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors pt-1',
                activo
                  ? 'text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <item.icon
                size={20}
                strokeWidth={activo ? 2.2 : 1.8}
                className={cn('transition-transform', activo && 'scale-110')}
              />
              <span className="leading-tight">{item.label}</span>
              {activo && (
                <span className="absolute bottom-0 h-0.5 w-8 bg-accent-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
