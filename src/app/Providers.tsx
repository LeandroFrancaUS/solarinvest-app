import type { ReactNode } from 'react'
import { AuthProvider } from './auth/AuthProvider'

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
