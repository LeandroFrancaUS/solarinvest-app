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
    console.debug("VITE_STACK_PROJECT_ID:", import.meta.env.VITE_STACK_PROJECT_ID)
    console.debug(
      "VITE_STACK_PUBLISHABLE_CLIENT_KEY:",
      import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ? "OK" : "MISSING",
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
           * Suspense boundary for App: the Stack Auth useUser() hook inside App
           * may suspend while it validates the user's session after authentication.
           * Without this boundary the suspension propagates to the Boundary error
           * component, which shows "Falhou ao renderizar".  The fallback is null
           * (blank screen) because RequireAuth already owns the visible loading
           * spinner once the user state resolves.
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
