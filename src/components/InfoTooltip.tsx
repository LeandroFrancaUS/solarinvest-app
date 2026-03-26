import React from 'react'

export type TooltipIconProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
}

export const TooltipIcon = React.forwardRef<HTMLButtonElement, TooltipIconProps>(
  function TooltipIcon({ active, className = '', ...rest }, ref) {
    const classes = ['tooltip-icon', 'si-help-icon']
    if (active) {
      classes.push('open')
    }
    if (className) {
      classes.push(className)
    }

    return (
      <button
        type="button"
        ref={ref}
        className={classes.join(' ')}
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
  const bubbleRef = React.useRef<HTMLSpanElement | null>(null)

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

  // Adjust bubble horizontal position to stay within viewport
  React.useEffect(() => {
    if (!open || !bubbleRef.current) {
      return
    }
    const bubble = bubbleRef.current
    // Reset inline styles before measuring
    bubble.style.removeProperty('left')
    bubble.style.removeProperty('right')
    bubble.style.removeProperty('transform')

    const rect = bubble.getBoundingClientRect()
    const vw = window.innerWidth
    const margin = 8

    if (rect.right > vw - margin) {
      // Overflows right edge — anchor to right side of container
      bubble.style.left = 'auto'
      bubble.style.right = '0'
      bubble.style.transform = 'none'
    } else if (rect.left < margin) {
      // Overflows left edge — anchor to left side of container
      bubble.style.left = '0'
      bubble.style.right = 'auto'
      bubble.style.transform = 'none'
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
        <span role="tooltip" id={tooltipId} className="info-bubble" ref={bubbleRef}>
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
