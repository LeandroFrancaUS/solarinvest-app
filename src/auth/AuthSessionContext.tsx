// src/auth/AuthSessionContext.tsx
// Provides a shared auth session context to avoid duplicate /auth/me fetches.
// When Stack Auth is configured, reacts to Stack Auth user state changes.
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { useUser } from "@stackframe/react"
import { useAuthSession, isAuthConfigured, type AuthSession } from "./auth-session"

const AuthSessionContext = createContext<AuthSession | null>(null)

/**
 * Inner provider that safely bridges Stack Auth user state to the internal session.
 * Only rendered inside StackProvider so useUser() is safe to call here.
 */
function StackAuthBridge({ session }: { session: AuthSession }) {
  const stackUser = useUser({ or: "return-null" })
  const prevRef = useRef<typeof stackUser>(stackUser)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = stackUser
    // Detect login or logout transitions
    if (Boolean(prev) !== Boolean(stackUser)) {
      void session.refresh()
    }
  }, [stackUser, session])

  return null
}

export function AuthSessionProvider({
  children,
  withStackBridge = false,
}: {
  children: ReactNode
  withStackBridge?: boolean
}) {
  const session = useAuthSession()
  return (
    <AuthSessionContext.Provider value={session}>
      {withStackBridge && isAuthConfigured() && <StackAuthBridge session={session} />}
      {children}
    </AuthSessionContext.Provider>
  )
}

export function useAuthSessionContext(): AuthSession {
  const ctx = useContext(AuthSessionContext)
  if (!ctx) {
    throw new Error("useAuthSessionContext must be used within AuthSessionProvider")
  }
  return ctx
}
