import 'next-auth'

// Extender los tipos de NextAuth para incluir el id del usuario en la sesión
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
  }
}
