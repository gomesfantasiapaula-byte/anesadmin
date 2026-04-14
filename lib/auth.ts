import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db'
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema'

export const authOptions: NextAuthOptions = {
  // Adaptador Drizzle para persistir sesiones en Postgres
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

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
