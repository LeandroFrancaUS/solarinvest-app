import React from 'react'

type SwitchProps = {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  id?: string
  className?: string
  disabled?: boolean
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  id,
  className = '',
  disabled = false,
}) => {
  const toggle = () => {
    if (disabled) return
    onCheckedChange?.(!checked)
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  const baseClasses =
    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500'
  const thumbClasses =
    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      id={id}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={`${baseClasses} ${checked ? 'bg-emerald-500' : 'bg-gray-300'} ${className}`.trim()}
    >
      <span className={`${thumbClasses} ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}
