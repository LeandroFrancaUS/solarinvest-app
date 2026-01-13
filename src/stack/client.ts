// src/stack/client.ts
import { StackClientApp } from "@stackframe/stack"

const projectId =
  import.meta.env.VITE_STACK_PROJECT_ID ?? import.meta.env.NEXT_PUBLIC_STACK_PROJECT_ID

const publishableClientKey =
  import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
  import.meta.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

if (!projectId || !publishableClientKey) {
  console.warn("[stack] Missing STACK env vars (projectId / publishableClientKey)")
}

/**
 * IMPORTANTE (Vite SPA):
 * - Evita criar StackClientApp fora do browser
 * - Define tokenStore explicitamente para não ficar undefined
 */
export const stackClientApp =
  typeof window === "undefined" || !projectId || !publishableClientKey
    ? null
    : new StackClientApp({
        projectId,
        publishableClientKey,

        // ✅ isso normalmente evita exatamente o erro "accessToken in undefined"
        tokenStore: "localStorage",
      } as any)
