import React, { useId } from 'react'

export function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: React.ReactNode
  children: React.ReactNode
  hint?: React.ReactNode
  htmlFor?: string
}) {
  const generatedId = useId()
  let firstControlId: string | undefined

  const enhancedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) {
      return child
    }

    if (typeof child.type === 'string') {
      if (child.type === 'input') {
        const inputType = (child.props as { type?: string }).type
        if (inputType === 'checkbox' || inputType === 'radio') {
          return child
        }
      }

      if (child.type === 'input' || child.type === 'select' || child.type === 'textarea') {
        const existingProps = child.props as {
          className?: string
          id?: string
          name?: string
        }
        const existingClassName = existingProps.className ?? ''
        const classes = existingClassName.split(' ').filter(Boolean)
        if (!classes.includes('cfg-input')) {
          classes.push('cfg-input')
        }
        const resolvedId = existingProps.id ?? (index === 0 ? generatedId : `${generatedId}-${index}`)
        if (!firstControlId) {
          firstControlId = resolvedId
        }
        return React.cloneElement(child, {
          className: classes.join(' '),
          id: existingProps.id ?? resolvedId,
          name: existingProps.name ?? resolvedId,
        })
      }
    }

    return child
  })

  const labelHtmlFor = htmlFor ?? firstControlId

  return (
    <div className="field cfg-field">
      <label className="field-label cfg-label" {...(labelHtmlFor ? { htmlFor: labelHtmlFor } : undefined)}>
        {label}
      </label>
      <div className="field-control cfg-control">
        {enhancedChildren}
        {hint ? <small className="cfg-help">{hint}</small> : null}
      </div>
    </div>
  )
}

export function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null
}
