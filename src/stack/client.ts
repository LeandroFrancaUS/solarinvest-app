// src/stack/client.ts
import { StackClientApp } from "@stackframe/react"

const projectId =
  import.meta.env.VITE_STACK_PROJECT_ID ?? import.meta.env.NEXT_PUBLIC_STACK_PROJECT_ID

const publishableClientKey =
  import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
  import.meta.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

if (!projectId || !publishableClientKey) {
  console.warn("[stack] Missing STACK env vars (projectId / publishableClientKey)")
}

/**
 * Get the base URL for the application
 * In production (Vercel), use the deployment URL
 * In development, use localhost
 */
const getBaseUrl = () => {
  if (typeof window === "undefined") return ""
  
  // Use the current origin (works for both dev and prod)
  return window.location.origin
}

/**
 * Vite SPA: só cria o client no browser.
 * (evita edge cases de SSR e testes)
 */
export const stackClientApp =
  typeof window === "undefined" || !projectId || !publishableClientKey
    ? null
    : new StackClientApp({
        projectId,
        publishableClientKey,
        tokenStore: "cookie", // Use cookie-based token storage for browser
        urls: {
          home: getBaseUrl(),
          signIn: getBaseUrl(),
          signUp: getBaseUrl(),
          afterSignIn: getBaseUrl(),
          afterSignUp: getBaseUrl(),
          afterSignOut: getBaseUrl(),
        },
      })
