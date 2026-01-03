import type { ReactNode } from 'react'
import './flows.css'

interface StepCardProps {
  title: string
  description?: string
  children: ReactNode
}

export function StepCard({ title, description, children }: StepCardProps) {
  return (
    <section className="step-card">
      <header className="step-card-header">
        <div>
          <h3>{title}</h3>
          {description ? <p className="step-card-description">{description}</p> : null}
        </div>
      </header>
      <div className="step-card-body">{children}</div>
    </section>
  )
}
