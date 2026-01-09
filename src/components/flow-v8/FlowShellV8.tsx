/**
 * Flow V8 - Shell Component
 * Main layout wrapper with 3-column grid (stepper, content, sidebar)
 */

import React from 'react'

export interface FlowShellV8Props {
  title: string
  subtitle?: string
  stepper: React.ReactNode
  content: React.ReactNode
  sidebar: React.ReactNode
}

export function FlowShellV8({
  title,
  subtitle,
  stepper,
  content,
  sidebar,
}: FlowShellV8Props): JSX.Element {
  return (
    <div className="v8-shell">
      <header className="v8-shell-header">
        <div className="v8-shell-title">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="v8-shell-subtitle">{subtitle}</p>}
          </div>
          <span className="v8-badge">Flow V8</span>
        </div>
      </header>
      
      <div className="v8-grid">
        {stepper}
        {content}
        {sidebar}
      </div>
    </div>
  )
}
