import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { pgTableCreator } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'

// Map NextAuth default table names → our actual table names
const tableNameMap: Record<string, string> = {
  user: 'users',
  account: 'accounts',
  session: 'sessions',
  verificationToken: 'verification_tokens',
}

export const authOptions: NextAuthOptions = {
  // Adaptador Drizzle para persistir sesiones en Postgres
  adapter: DrizzleAdapter(db, pgTableCreator((name) => tableNameMap[name] ?? name)),

  providers: [
    GoogleProvider({
      // Las vars se validan en runtime — el build no las necesita
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          // Solicitar acceso offline para refresh tokens
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    }),
  ],

  session: {
    strategy: 'database', // Sesiones en Postgres (más seguro que JWT para datos sensibles)
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // Exponer el id del usuario en la sesión del cliente
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },

  events: {
    // Log de eventos para debugging (solo en desarrollo)
    async signIn({ user }) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth] Sesión iniciada: ${user.email}`)
      }
    },
  },
}

export default NextAuth(authOptions)
