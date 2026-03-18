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
 * - urls.signIn = "/" — the app renders its own <SignIn> component at the root.
 *   Without this override the SDK defaults to "/handler/sign-in" which is not a
 *   registered route in this Vite SPA, causing a blank page when redirectToSignIn()
 *   is called (e.g., on OAuth-callback fallback paths).
 * - urls.oauthCallback = "/handler/oauth-callback" — explicitly declared (matches
 *   the SDK default) so it is unambiguous which redirect URI must be registered in
 *   the Stack Auth project dashboard under "Allowed OAuth Callback URLs".
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
          // Sign-in lives at the app root, not at /handler/sign-in.
          // This prevents a blank-page redirect when redirectToSignIn() is called.
          signIn: "/",
          signUp: "/",
          afterSignIn: "/",
          afterSignUp: "/",
          afterSignOut: "/",
          // Explicitly set so dashboard registration requirements are obvious.
          // The app handles this path in RequireAuth.tsx via OAuthCallbackHandler.
          // Register this full absolute URL in your Stack Auth project dashboard:
          //   https://<your-domain>/handler/oauth-callback
          oauthCallback: "/handler/oauth-callback",
        },
      })

// Startup diagnostics — visible in browser DevTools, never logs secrets or tokens.
if (typeof window !== "undefined" && stackClientApp) {
  const urls = stackClientApp.urls
  console.debug('[stack-auth] client initialized', {
    signInUrl: urls.signIn,
    oauthCallbackPath: urls.oauthCallback,
    afterSignInUrl: urls.afterSignIn,
    isOAuthCallbackPage: window.location.pathname.replace(/\/$/, '') === '/handler/oauth-callback',
    currentPath: window.location.pathname,
  })
}
