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
      })
