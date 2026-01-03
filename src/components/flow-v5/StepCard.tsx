import type { ReactNode } from 'react'
import './flow-v5.css'

interface StepCardProps {
  title: string
  description?: ReactNode
  children: ReactNode
  actions?: ReactNode
}

export function StepCard({ title, description, children, actions }: StepCardProps) {
  return (
    <section className="card step-card">
      <header className="step-card__header">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions ? <div className="step-card__actions">{actions}</div> : null}
      </header>
      <div className="step-card__body">{children}</div>
    </section>
  )
}

export default StepCard
