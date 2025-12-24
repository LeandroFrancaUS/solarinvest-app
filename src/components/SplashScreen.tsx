import { useEffect } from "react"

const REDIRECT_DELAY_MS = 2000
const HOME_URL = "https://solarinvest.info"

export function SplashScreen() {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.location.replace(HOME_URL)
    }, REDIRECT_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <main className="splash-screen" role="presentation">
      <img src="/LogoNatal2.png" alt="SolarInvest" className="splash-logo" />
    </main>
  )
}
