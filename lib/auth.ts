import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db'
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema'

export const authOptions: NextAuthOptions = {
  // Adaptador Drizzle — cast needed due to drizzle-orm@0.30 / adapter type mismatch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: DrizzleAdapter(db, {
    usersTable: users as any,
    accountsTable: accounts as any,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens as any,
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
    strategy: 'jwt', // JWT requerido para next-auth/middleware en Edge Runtime
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // Con JWT, el id viene del token (no de `user`)
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
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
