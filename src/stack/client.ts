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
 *
 * Key configuration notes:
 * - redirectMethod: "window"  — ensures Stack Auth redirects actually happen via
 *   window.location (the default "none" silently swallows all SDK-triggered redirects,
 *   causing the auth loop where the OAuth callback is processed but the user is never
 *   sent on to the app).
 * - urls: only home/afterSignIn/afterSignOut are set so the SDK's /handler/* defaults
 *   remain intact (especially oauthCallback → /handler/oauth-callback), preventing
 *   the sign-in URL from incorrectly pointing at the app root.
 */
export const stackClientApp =
  typeof window === "undefined" || !projectId || !publishableClientKey
    ? null
    : new StackClientApp({
        projectId,
        publishableClientKey,
        tokenStore: "cookie",
        redirectMethod: "window",
        urls: {
          home: "/",
          afterSignIn: "/",
          afterSignUp: "/",
          afterSignOut: "/",
        },
      })
