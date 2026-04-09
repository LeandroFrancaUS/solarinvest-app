// src/main.tsx
import process from "process"
// SES lockdown (e.g. Yoroi wallet extension) may freeze globalThis properties and
// cause a strict-mode TypeError here.  Swallow the error: the `process` module is
// already available via the import above, so only code that reads `globalThis.process`
// (rather than the direct import) would be affected.
try {
  ;(globalThis as any).process = process
} catch (_sesErr) {
  // Ignored: SES lockdown prevented assignment; process shim is still available
  // via the module import and via Vite's built-in process shim.
}

// Intercept uncaught TypeErrors from crypto-wallet browser-extension inject scripts
// (e.g. Yoroi setting window.cardano after MetaMask's SES lockdown has frozen the
// global object).  React 18's concurrent scheduler attaches its own window 'error'
// listener; if an extension script throws an uncaught error while React is active,
// React can incorrectly surface it through the error boundary ("Falhou ao renderizar").
// We register this handler in the capture phase — before React attaches its own
// listener inside ReactDOM.createRoot().render() — so we intercept first and call
// stopImmediatePropagation() to keep the error confined to the extension context.
try {
  if (typeof window !== "undefined") {
    window.addEventListener(
      "error",
      (event) => {
        const src = event.filename ?? ""
        const msg = event.message ?? ""
        const fromExtension =
          src.includes("inject") ||
          src.includes("inpage") ||
          src.includes("chrome-extension://") ||
          src.includes("moz-extension://")
        const isReadOnlyAssignment =
          msg.includes("read only") || msg.includes("Cannot assign")
        if (fromExtension && isReadOnlyAssignment) {
          // Prevent this extension error from reaching React's global error listener.
          // Do NOT call event.preventDefault() so the browser still logs it to the
          // console (useful for debugging extension conflicts).
          event.stopImmediatePropagation()
        }
      },
      true, // capture phase — runs before React's bubble-phase listener
    )
  }
} catch (_listenerErr) {
  // Ignored: SES lockdown or restricted environment prevented listener registration.
}

import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { Boundary } from "./app/Boundary"
import { Providers } from "./app/Providers"
import { ensureServerStorageSync } from "./app/services/serverStorage"
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode } from "./constants/ui"
import { perfLog, perfMeasure, perfNow } from "./utils/perf"
import "./styles.css"
import "./styles/anti-overlay.css"
import "./styles/anti-overlay-screen.css"

const detectBrave = async (): Promise<boolean> => {
  if (typeof navigator === "undefined") {
    return false
  }
  try {
    const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }
    if (nav.brave?.isBrave) {
      return await nav.brave.isBrave()
    }
  } catch (error) {
    console.warn("Brave detection failed", error)
  }
  const userAgent = navigator.userAgent?.toLowerCase() ?? ""
  return userAgent.includes("brave")
}

const disableAnimationsInBrave = async () => {
  if (typeof document === "undefined") {
    return
  }
  if (await detectBrave()) {
    const body = document.body
    if (body) {
      body.classList.add("no-animations")
    }
  }
}

async function bootstrap() {
  const bootStart = perfNow()
  perfLog('LOGIN', 'START')

  if (import.meta.env.DEV) {
    console.debug(
      "STACK_PROJECT_ID (VITE_/NEXT_PUBLIC_):",
      import.meta.env.VITE_STACK_PROJECT_ID ?? import.meta.env.NEXT_PUBLIC_STACK_PROJECT_ID ?? "MISSING",
    )
    console.debug(
      "STACK_PUBLISHABLE_CLIENT_KEY (VITE_/NEXT_PUBLIC_):",
      (import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
        import.meta.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY)
        ? "OK"
        : "MISSING",
    )
  }

  void ensureServerStorageSync().catch((error) => {
    perfLog('BOOT', 'SERVER_STORAGE_SYNC_FAIL', { error: String(error) }, 'warn')
  })
  await disableAnimationsInBrave()

  const storedDensity =
    typeof window !== "undefined" ? window.localStorage.getItem(DENSITY_STORAGE_KEY) : null

  const initialDensity =
    storedDensity && isDensityMode(storedDensity) ? storedDensity : DEFAULT_DENSITY

  if (typeof document !== "undefined") {
    document.documentElement.dataset.density = initialDensity
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Boundary>
        <Providers>
          {/*
           * Suspense boundary for App: catches any component-level suspensions
           * within the app tree (e.g. lazy-loaded routes).  Stack Auth's
           * useUser() session validation is now handled inside Providers.tsx
           * (StackUserPublisher with its own Suspense) and no longer suspends
           * here.  The fallback is null (blank screen) because any visible
           * loading state is owned by the components themselves.
           */}
          <React.Suspense fallback={null}>
            <App />
          </React.Suspense>
        </Providers>
      </Boundary>
    </React.StrictMode>,
  )
  perfMeasure('LOGIN', 'APP_READY', bootStart)
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap application", error)
})
