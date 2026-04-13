import { redirect } from 'next/navigation'

// Redirigir la raíz al dashboard (el middleware maneja la auth)
export default function RootPage() {
  redirect('/dashboard')
}
