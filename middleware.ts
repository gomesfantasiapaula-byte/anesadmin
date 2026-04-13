export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    /*
     * Proteger todas las rutas EXCEPTO:
     * - /login (página pública)
     * - /api/auth (rutas de NextAuth)
     * - archivos estáticos (_next, favicon, etc.)
     */
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.json|icons).*)',
  ],
}
