import { useState, useEffect, type ReactNode } from 'react'
import { RequireAuthorizedUser } from '../auth/guards/RequireAuthorizedUser'
import { RequireAdmin } from '../auth/guards/RequireAdmin'
import AdminUsersPage from '../features/admin-users/AdminUsersPage'

interface Props {
  children: ReactNode
}

/**
 * Simple path-based routing overlay.
 * /admin-panel → admin user management (requires admin role)
 * everything else → main app (requires authorized user)
 */
export function AppRoutes({ children }: Props) {
  const [pathname, setPathname] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  )

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (pathname === '/admin-panel') {
    return (
      <RequireAdmin>
        <AdminUsersPage />
      </RequireAdmin>
    )
  }

  return <RequireAuthorizedUser>{children}</RequireAuthorizedUser>
}


