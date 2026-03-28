import { type ReactNode } from 'react'

interface ActionBarProps {
  children: ReactNode
}

export function ActionBar({ children }: ActionBarProps) {
  return (
    <div className="action-bar">
      <div className="action-bar-inner">{children}</div>
    </div>
  )
}
