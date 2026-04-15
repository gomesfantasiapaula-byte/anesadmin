'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  FileText,
  Building2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    exact: true,
  },
  {
    href: '/dashboard/pacientes',
    icon: Users,
    label: 'Pacientes',
  },
  {
    href: '/dashboard/documentos',
    icon: FileText,
    label: 'Documentos OCR',
  },
  {
    href: '/dashboard/protocolos',
    icon: ClipboardList,
    label: 'Protocolos',
  },
  {
    href: '/dashboard/hospitales',
    icon: Building2,
    label: 'Hospitales',
  },
]

export function Sidebar() {
  const [colapsado, setColapsado] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-surface border-r border-border transition-all duration-300 ease-in-out',
        colapsado ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-border px-4 flex-shrink-0',
          colapsado ? 'justify-center' : 'gap-3',
        )}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <rect x="13" y="4" width="6" height="24" rx="2" fill="#00d4aa" />
            <rect x="4" y="13" width="24" height="6" rx="2" fill="#00d4aa" />
          </svg>
        </div>
        {!colapsado && (
          <span className="font-bold text-text-primary text-sm tracking-tight">
            AnesAdmin
          </span>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const activo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                colapsado ? 'justify-center' : 'gap-3',
                activo
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
              )}
              title={colapsado ? item.label : undefined}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!colapsado && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer del sidebar: usuario + collapse */}
      <div className="border-t border-border p-3 space-y-2 flex-shrink-0">
        {/* Botón colapsar */}
        <button
          onClick={() => setColapsado(!colapsado)}
          className={cn(
            'w-full flex items-center rounded-xl px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-all duration-150 text-sm',
            colapsado ? 'justify-center' : 'gap-3',
          )}
        >
          {colapsado ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Colapsar</span>
            </>
          )}
        </button>

        {/* Perfil del usuario */}
        {session?.user && (
          <div
            className={cn(
              'flex items-center rounded-xl p-2 bg-surface-elevated border border-border gap-2',
              colapsado && 'justify-center',
            )}
          >
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? 'Perfil'}
                width={28}
                height={28}
                className="rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary text-xs font-bold flex-shrink-0">
                {session.user.name?.charAt(0) ?? 'A'}
              </div>
            )}

            {!colapsado && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  {session.user.name}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {session.user.email}
                </p>
              </div>
            )}

            {!colapsado && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-text-secondary hover:text-danger transition-colors flex-shrink-0"
                title="Cerrar sesión"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
