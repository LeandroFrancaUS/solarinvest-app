import React from 'react'
import './flow-v6.css'

type StepCardV6Props = {
  title: string
  description?: string
  children: React.ReactNode
}

export function StepCardV6({ title, description, children }: StepCardV6Props) {
  return (
    <div className="flow-v6-step-card">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      <div>{children}</div>
    </div>
  )
}
