import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Handler compartido para GET y POST
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
