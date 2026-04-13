'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

// Wrapper client component para proveer la sesión de NextAuth
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
