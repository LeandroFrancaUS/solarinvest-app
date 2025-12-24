import React from "react"
import ReactDOM from "react-dom/client"
import { SplashScreen } from "./components/SplashScreen"
import "./styles.css"
import "./styles/anti-overlay.css"
import "./styles/anti-overlay-screen.css"
import "./styles/splash.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SplashScreen />
  </React.StrictMode>,
)
