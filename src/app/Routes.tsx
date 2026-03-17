import type { ReactNode } from 'react'
import { RequireAuth } from '../auth/guards/RequireAuth'
import { RequireAuthorizedUser } from '../auth/guards/RequireAuthorizedUser'

export function AppRoutes({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireAuthorizedUser>
        {children}
      </RequireAuthorizedUser>
    </RequireAuth>
  )
}
