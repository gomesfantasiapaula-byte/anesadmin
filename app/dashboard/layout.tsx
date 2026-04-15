import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/sidebar'
import { BottomNav } from '@/components/dashboard/bottom-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — solo visible en md+ */}
      <Sidebar />

      {/* Área de contenido principal */}
      <main className="flex-1 overflow-y-auto">
        {/*
          Padding:
          - Top/lados: 4 en mobile, 6 en desktop
          - Bottom en mobile: 16 (4rem) + extra para safe area del iPhone
          - Bottom en desktop: 6
        */}
        <div className="p-4 pb-24 md:p-6 md:pb-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom nav — solo visible en mobile */}
      <BottomNav />
    </div>
  )
}
