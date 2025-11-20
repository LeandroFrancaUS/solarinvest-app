import type { InputHTMLAttributes } from 'react'
import React from 'react'

const baseClassName = 'checkbox-small'

export type CheckboxSmallProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export const CheckboxSmall = React.forwardRef<HTMLInputElement, CheckboxSmallProps>(
  ({ className = '', ...props }, ref) => {
    const classes = [baseClassName, className].filter(Boolean).join(' ')
    return <input ref={ref} type="checkbox" className={classes} {...props} />
  },
)

CheckboxSmall.displayName = 'CheckboxSmall'
