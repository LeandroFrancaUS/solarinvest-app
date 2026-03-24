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
 *
 * - redirectMethod: "window" — REQUIRED.  The SDK default is "none", which makes
 *   all SDK-initiated redirects (redirectToAfterSignIn, redirectToSignIn, etc.) into
 *   silent no-ops.  With "none", after callOAuthCallback() exchanges the code for
 *   tokens the user stays stuck on the /handler/oauth-callback page forever.
 *   Setting "window" ensures window.location.replace/assign is used for redirects.
 *
 * - urls.signIn / urls.signUp — intentionally NOT overridden here.
 *   The SDK defaults to "/handler/sign-in" and "/handler/sign-up".  Overriding both
 *   to "/" was added by a previous fix but is incorrect: when redirectToSignIn() or
 *   redirectToSignUp() is called without noRedirectBack:true (e.g., when the user
 *   clicks the "Sign up" link inside <SignIn>), the SDK's _redirectToHandler logic
 *   adds an "after_auth_return_to" query param to "/"  (same-origin redirect rule).
 *   The SDK's constructRedirectUrl() then propagates that param into the OAuth
 *   redirect_uri, producing:
 *     https://<domain>/handler/oauth-callback?after_auth_return_to=%2F
 *   This parameterised URL differs from the plain /handler/oauth-callback that must
 *   be registered in the Stack Auth project, causing Stack Auth to reject it (HTTP
 *   400) even after the URL is registered.  Leaving signIn/signUp at the SDK default
 *   ("/handler/sign-in") avoids that pollution because those pages are different
 *   URLs from the OAuth callback, and Vercel's SPA catch-all rewrite serves
 *   index.html for /handler/sign-in just like any other path.
 *
 * - urls.oauthCallback = "/handler/oauth-callback" — explicitly declared (matches
 *   the SDK default) so it is unambiguous which redirect URI must be registered in
 *   the Stack Auth project dashboard.
 *   ⚠️  REQUIRED DASHBOARD ACTION:
 *       Stack Auth project → Auth → OAuth → Allowed Callback URLs
 *       Add: https://<your-domain>/handler/oauth-callback
 *   Without this entry Stack Auth returns HTTP 400 at its own
 *   /api/v1/auth/oauth/callback/google endpoint before ever redirecting to the app.
 */
export const stackClientApp =
  typeof window === "undefined" || !projectId || !publishableClientKey
    ? null
    : new StackClientApp({
        projectId,
        publishableClientKey,
        tokenStore: "cookie",
        // "window" is required — SDK default "none" is a no-op for redirects.
        redirectMethod: "window",
        urls: {
          home: "/",
          // signIn / signUp intentionally use SDK defaults (/handler/sign-in,
          // /handler/sign-up) — see note above about after_auth_return_to pollution.
          afterSignIn: "/",
          afterSignUp: "/",
          afterSignOut: "/",
          // Must match the URL registered in Stack Auth project settings.
          oauthCallback: "/handler/oauth-callback",
        },
      })

// Startup diagnostics — DEV-only so internal OAuth config is not exposed in
// production DevTools.  Helps developers copy-paste the redirectUri into the
// Stack Auth dashboard without leaking implementation details to end users.
if (import.meta.env.DEV && typeof window !== "undefined" && stackClientApp) {
  const urls = stackClientApp.urls
  // Compute the actual redirect_uri that will be sent to Stack Auth's authorize
  // endpoint so developers can copy-paste it straight into the Stack Auth dashboard.
  const redirectUri = new URL(urls.oauthCallback, window.location.href).toString()
  console.debug('[stack-auth] client initialized', {
    redirectUri,           // register this exact URL in Stack Auth dashboard
    oauthCallbackPath: urls.oauthCallback,
    signInUrl: urls.signIn,
    afterSignInUrl: urls.afterSignIn,
    isOAuthCallbackPage:
      window.location.pathname.replace(/\/$/, '') ===
      new URL(urls.oauthCallback, window.location.href).pathname.replace(/\/$/, ''),
    currentPath: window.location.pathname,
  })
}
