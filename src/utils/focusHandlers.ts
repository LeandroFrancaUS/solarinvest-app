import type { FocusEvent } from 'react'

/**
 * Selects the full value of a focused numeric input so the user can overwrite it without
 * keeping the default "0" prefix. Only applies to editable inputs.
 */
export function selectNumberInputOnFocus(event: FocusEvent<HTMLInputElement>): void {
  const input = event.currentTarget

  if (input.readOnly || input.disabled) {
    return
  }

  // `select()` must run after the browser applies focus; requestAnimationFrame ensures that.
  window.requestAnimationFrame(() => {
    input.select()
  })
}
