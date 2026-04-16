// src/components/portfolio/ClientPortfolioEditorShell.tsx
// Full-screen editor shell for the client portfolio.
// Wraps the detail panel in a full-screen overlay with a fixed header.

import React, { useEffect, useState } from 'react'

export type ViewMode = 'expanded' | 'collapsed'

/** Sidebar width on desktop (matches .sidebar { width: 256px } in styles.css) */
const SIDEBAR_W = 256

interface ClientPortfolioEditorShellProps {
  clientName: string
  viewMode: ViewMode
  onClose: () => void
  onToggleMode: () => void
  children: React.ReactNode
}

function useIsDesktop(breakpoint = 921): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : true,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isDesktop
}

export function ClientPortfolioEditorShell({
  clientName,
  viewMode,
  onClose,
  onToggleMode,
  children,
}: ClientPortfolioEditorShellProps) {
  const isDesktop = useIsDesktop()

  if (viewMode === 'collapsed') {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--header-h, 72px)',
        left: isDesktop ? SIDEBAR_W : 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg, #0f172a)',
        color: 'var(--text-base, #e2e8f0)',
      }}
    >
      {/* Fixed header — below the app topbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid var(--border, #334155)',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>👤</span>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#f1f5f9',
            }}
          >
            {clientName || 'Cliente'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onToggleMode}
            title="Minimizar"
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid rgba(148,163,184,0.3)',
              background: 'rgba(148,163,184,0.12)',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ↙ Minimizar
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar editor"
            title="Fechar"
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid rgba(255,140,0,0.4)',
              background: 'rgba(255,140,0,0.18)',
              color: '#ff8c00',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✕ Fechar
          </button>
        </div>
      </div>

      {/* Content area — fills remaining viewport */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
        }}
      >
        {children}
      </div>
    </div>
  )
}
