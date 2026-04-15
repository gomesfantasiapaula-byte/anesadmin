import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { SessionProvider } from '@/components/providers/session-provider'

export const metadata: Metadata = {
  title: {
    default: 'AnesAdmin',
    template: '%s | AnesAdmin',
  },
  description: 'Plataforma de gestión administrativa para anestesiología',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AnesAdmin',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // viewportFit=cover para que env(safe-area-inset-*) funcione en iPhone con notch
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background text-text-primary antialiased">
        <SessionProvider>
          {children}
          {/* Notificaciones toast estilo WHOOP */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1c1c1c',
                border: '1px solid #2a2a2a',
                color: '#ffffff',
                borderRadius: '12px',
              },
              classNames: {
                success: 'border-success/30',
                error: 'border-danger/30',
                warning: 'border-warning/30',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
