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
      // input.select() can throw on certain input types (e.g., type="number", "email", "date") in browsers like Safari and older versions of Chrome/Edge.
      // See: https://github.com/facebook/react/issues/7267, https://stackoverflow.com/q/21177489
      // Ignore and continue.
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

  ['mouseup', 'pointerup', 'touchend'].forEach(eventName => {
    input.addEventListener(eventName, preventSelectionOverride, { once: true })
  })

  // `select()` must run after the browser applies focus; requestAnimationFrame ensures that.
  window.requestAnimationFrame(() => {
    if (document.activeElement === input) {
      selectAll()
    }
  })
}
