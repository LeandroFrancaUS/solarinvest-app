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

  const selectAll = () => {
    try {
      input.select()
    } catch {
      // Some browsers can throw when selecting certain input types. Ignore and continue.
    }
  }

  // Immediately select so keyboard interactions (Backspace/Arrow keys) overwrite the default value.
  selectAll()

  // Prevent the initial mouseup from overriding the programmatic selection.
  const preventSelectionOverride = (eventToPrevent: Event) => {
    if (eventToPrevent.cancelable) {
      eventToPrevent.preventDefault()
    }
  }

  input.addEventListener('mouseup', preventSelectionOverride, { once: true })
  input.addEventListener('pointerup', preventSelectionOverride, { once: true })
  input.addEventListener('touchend', preventSelectionOverride, { once: true })

  // `select()` must run after the browser applies focus; requestAnimationFrame ensures that.
  window.requestAnimationFrame(() => {
    if (document.activeElement === input) {
      selectAll()
    }
  })
}
