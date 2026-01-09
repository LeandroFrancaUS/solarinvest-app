/**
 * Flow V8 - Shell Component
 * Main layout wrapper with 3-column grid (stepper, content, sidebar)
 */

import React from 'react'

export interface FlowShellV8Props {
  title: string
  subtitle?: string
  headerExtras?: React.ReactNode
  stepper: React.ReactNode
  content: React.ReactNode
  sidebar: React.ReactNode
}

export function FlowShellV8({
  title,
  subtitle,
  headerExtras,
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
        </div>
        {headerExtras && <div className="v8-shell-header-extras">{headerExtras}</div>}
      </header>
      
      <div className="v8-grid">
        {stepper}
        {content}
        {sidebar}
      </div>
    </div>
  )
}
