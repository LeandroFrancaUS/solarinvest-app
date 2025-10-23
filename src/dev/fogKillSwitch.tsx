import { useEffect, useState } from 'react'

function installCSS(enabled: boolean) {
  const id = 'fog-kill-switch'
  let style = document.getElementById(id) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }
  style.textContent = enabled
    ? `
  @media screen {
    /* neutraliza FOG sem matar z-index ou pointer-events normais */
    html, body, #root, .app, .layout, .page, main {
      filter: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
      opacity: 1 !important; mix-blend-mode: normal !important;
    }
    /* remove apenas camadas full-screen típicas */
    .overlay, .backdrop, .frost, .frosted, .frosted-overlay, .glass, .glass-overlay,
    .page-dim, .dim-layer, .modal-backdrop, .snow-overlay,
    [class*="overlay"], [class*="backdrop"], [class*="frost"], [class*="glass"], [class*="dim"] {
      -webkit-backdrop-filter: none !important; backdrop-filter: none !important; filter: none !important;
      opacity: 1 !important; mix-blend-mode: normal !important;
    }
    /* pseudo-elementos */
    body::before, body::after, #root::before, #root::after, .app::before, .app::after,
    .layout::before, .layout::after, .page::before, .page::after {
      content: none !important;
    }
  }`
    : ''
}

export function FogKillSwitch() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    installCSS(on)
    return () => installCSS(false)
  }, [on])
  return (
    <button
      onClick={() => setOn((v) => !v)}
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 999999,
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid #999',
        background: '#fff',
      }}
    >
      {on ? 'Fog: OFF (limpo)' : 'Fog: ON (efeitos originais)'}
    </button>
  )
}
