import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { Boundary } from "./app/Boundary"
import { Providers } from "./app/Providers"
import { ensureServerStorageSync } from "./app/services/serverStorage"
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode } from "./constants/ui"
import "./styles.css"
import "./styles/anti-overlay.css"
import "./styles/anti-overlay-screen.css"
import "./styles/tokens.v8.css"
import "./styles/flow.v8.css"

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
  await ensureServerStorageSync()
  await disableAnimationsInBrave()

  const storedDensity =
    typeof window !== "undefined" ? window.localStorage.getItem(DENSITY_STORAGE_KEY) : null

  const initialDensity = storedDensity && isDensityMode(storedDensity) ? storedDensity : DEFAULT_DENSITY

  if (typeof document !== "undefined") {
    document.documentElement.dataset.density = initialDensity
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Boundary>
        <Providers>
          <App />
        </Providers>
      </Boundary>
    </React.StrictMode>,
  )
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap application", error)
})
