import React from 'react'
import './flow-v6.css'

type FlowLayoutV6Props = {
  title: string
  stepIndex: number
  totalSteps: number
  onToggleLegacy?: () => void
  children: React.ReactNode
  sidebar: React.ReactNode
}

export function FlowLayoutV6({
  title,
  stepIndex,
  totalSteps,
  onToggleLegacy,
  children,
  sidebar,
}: FlowLayoutV6Props) {
  const progress = Math.min(Math.max(stepIndex + 1, 1), totalSteps)
  const percentage = Math.round((progress / totalSteps) * 100)

  return (
    <div>
      <div className="flow-v6-header">
        <div className="flow-v6-title-row">
          <h2>{title}</h2>
          <span className="flow-v6-badge" aria-label="Flow V6 ativo">
            FLOW V6 ATIVO
          </span>
          {onToggleLegacy ? (
            <button type="button" className="ghost" onClick={onToggleLegacy} style={{ marginLeft: 'auto' }}>
              Alternar Legacy
            </button>
          ) : null}
        </div>
        <div className="flow-v6-progress" aria-label={`Etapa ${progress} de ${totalSteps}`}>
          <strong>
            Etapa {progress} de {totalSteps}
          </strong>
          <div className="flow-v6-progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={progress}>
            <div className="flow-v6-progress-bar-fill" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>
      <div className="flow-v6-layout">
        <div>{children}</div>
        <aside className="flow-v6-sidebar">{sidebar}</aside>
      </div>
    </div>
  )
}
