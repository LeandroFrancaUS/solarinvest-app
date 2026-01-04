import type { ReactNode } from 'react'
import './flow-v5.css'

interface FlowLayoutProps {
  title: string
  subtitle?: ReactNode
  sidebar: ReactNode
  children: ReactNode
  actionSlot?: ReactNode
}

export function FlowLayout({ title, subtitle, sidebar, children, actionSlot }: FlowLayoutProps) {
  return (
    <div className="flow-v5">
      <header className="flow-v5__header">
        <div>
          <p className="flow-v5__eyebrow">Nova experiência</p>
          <h1 className="flow-v5__title">{title}</h1>
          {subtitle ? <div className="flow-v5__subtitle">{subtitle}</div> : null}
        </div>
        {actionSlot ? <div className="flow-v5__actions">{actionSlot}</div> : null}
      </header>
      <div className="flow-v5__body">
        <div className="flow-v5__main">{children}</div>
        <aside className="flow-v5__sidebar">{sidebar}</aside>
      </div>
    </div>
  )
}

export default FlowLayout
