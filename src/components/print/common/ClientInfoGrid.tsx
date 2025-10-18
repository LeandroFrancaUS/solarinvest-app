import React from 'react'

export type ClientInfoField = {
  label: string
  value: React.ReactNode
  wide?: boolean
}

export type ClientInfoGridProps = {
  fields: ClientInfoField[]
  className?: string
  fieldClassName?: string
  wideFieldClassName?: string
}

export function ClientInfoGrid({
  fields,
  className,
  fieldClassName,
  wideFieldClassName,
}: ClientInfoGridProps) {
  const rootClassName = ['client-info-grid', className].filter(Boolean).join(' ')
  const fieldClass = fieldClassName ?? 'client-info-field'
  const wideClass = wideFieldClassName ?? `${fieldClass}--wide`

  return (
    <dl className={rootClassName.trim()}>
      {fields.map((field, index) => {
        const classes = [fieldClass]
        if (field.wide) {
          classes.push(wideClass)
        }
        return (
          <div key={`${field.label}-${index}`} className={classes.join(' ')}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        )
      })}
    </dl>
  )
}

export default ClientInfoGrid
