import React from 'react'

export type TooltipIconProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
}

export const TooltipIcon = React.forwardRef<HTMLButtonElement, TooltipIconProps>(
  function TooltipIcon({ active, className = '', ...rest }, ref) {
    return (
      <button
        type="button"
        ref={ref}
        className={`tooltip-icon${active ? ' open' : ''}${className ? ` ${className}` : ''}`}
        {...rest}
      >
        ?
      </button>
    )
  },
)

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false)
  const tooltipId = React.useId()
  const containerRef = React.useRef<HTMLSpanElement | null>(null)
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <span className="info-tooltip" ref={containerRef}>
      <TooltipIcon
        aria-expanded={open}
        aria-label="Mostrar explicação"
        aria-haspopup="true"
        aria-controls={open ? tooltipId : undefined}
        active={open}
        onClick={() => setOpen((prev) => !prev)}
        ref={buttonRef}
        onBlur={(event) => {
          const nextFocus = event.relatedTarget as Node | null
          if (!nextFocus || !containerRef.current?.contains(nextFocus)) {
            setOpen(false)
          }
        }}
      />
      {open ? (
        <span role="tooltip" id={tooltipId} className="info-bubble">
          {text}
        </span>
      ) : null}
    </span>
  )
}

export const labelWithTooltip = (label: React.ReactNode, text: string) => (
  <span className="tooltip-label">
    {label}
    <InfoTooltip text={text} />
  </span>
)
