// src/components/portfolio/ClientPortfolioEditorShell.tsx
// Full-screen editor shell for the client portfolio.
// Wraps the detail panel in a full-screen overlay with a fixed header.

import React from 'react'

export type ViewMode = 'expanded' | 'collapsed'

interface ClientPortfolioEditorShellProps {
  clientName: string
  viewMode: ViewMode
  onClose: () => void
  onToggleMode: () => void
  children: React.ReactNode
}

export function ClientPortfolioEditorShell({
  clientName,
  viewMode,
  onClose,
  onToggleMode,
  children,
}: ClientPortfolioEditorShellProps) {
  if (viewMode === 'collapsed') {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--header-h, 72px)',
        left: 0,
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
          padding: '12px 20px',
          borderBottom: '1px solid var(--border, #334155)',
          background: 'var(--surface, #1e293b)',
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>👤</span>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border, #334155)',
              background: 'var(--ghost-bg, rgba(255,255,255,0.06))',
              color: 'var(--text-base, inherit)',
              cursor: 'pointer',
              fontSize: 13,
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
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--accent, #ff8c00)',
              background: 'var(--accent-soft, rgba(255,140,0,0.14))',
              color: 'var(--accent, #ff8c00)',
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
          padding: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}
