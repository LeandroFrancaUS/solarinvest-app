import { useState } from 'react'
import type { ReactNode } from 'react'
import './flows.css'

interface AssistantDrawerProps {
  insights: ReactNode
  label?: string
}

export function AssistantDrawer({ insights, label = 'Assistente' }: AssistantDrawerProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`assistant-drawer ${open ? 'open' : ''}`}>
      <button className="assistant-toggle" onClick={() => setOpen((prev) => !prev)}>
        {label}
      </button>
      {open ? <div className="assistant-content">{insights}</div> : null}
    </div>
  )
}
