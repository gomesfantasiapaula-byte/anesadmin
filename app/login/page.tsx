import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LoginButton } from '@/components/auth/login-button'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar Sesión',
}

export default async function LoginPage() {
  // Si ya hay sesión activa, redirigir al dashboard
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Fondo con gradiente radial sutil estilo WHOOP */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,212,170,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo y nombre */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 mb-6 glow-accent">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-label="Logo AnesAdmin"
            >
              {/* Símbolo de cruz médica simplificado */}
              <rect x="13" y="4" width="6" height="24" rx="2" fill="#00d4aa" />
              <rect x="4" y="13" width="24" height="6" rx="2" fill="#00d4aa" />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            AnesAdmin
          </h1>
          <p className="mt-2 text-text-secondary text-sm">
            Gestión administrativa para anestesiología
          </p>
        </div>

        {/* Card de login */}
        <div className="card-elevated p-8">
          <h2 className="text-lg font-semibold text-text-primary mb-1">
            Bienvenida
          </h2>
          <p className="text-text-secondary text-sm mb-8">
            Iniciá sesión con tu cuenta de Google para continuar.
          </p>

          <LoginButton />

          <p className="mt-6 text-center text-xs text-text-secondary">
            Solo cuentas autorizadas tienen acceso.
            <br />
            Tus datos están protegidos con cifrado en tránsito y en reposo.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-text-secondary/50">
          © {new Date().getFullYear()} AnesAdmin · Versión 1.0
        </p>
      </div>
    </main>
  )
}
