import type { FocusEvent } from 'react'

/**
 * Selects the full value of a focused numeric input so the user can overwrite it without
 * keeping the default "0" prefix. When the value is formatted as currency (e.g., "R$ 1,00"),
 * the caret automatically snaps before the decimal separator after typing so new digits
 * append to the integer portion without manual cursor adjustments. Only applies to editable inputs.
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

  ['mouseup', 'pointerup', 'touchend'].forEach((eventName) => {
    input.addEventListener(eventName, preventSelectionOverride, { once: true })
  })

  const handleCaretForCurrency = () => {
    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) {
        return
      }

      const value = input.value
      if (!value || !value.includes('R$')) {
        return
      }

      const { selectionStart, selectionEnd } = input
      if (selectionStart == null || selectionEnd == null) {
        return
      }

      const isCaretAtEnd = selectionStart === value.length && selectionEnd === value.length
      if (!isCaretAtEnd) {
        return
      }

      const decimalIndex = Math.max(value.lastIndexOf(','), value.lastIndexOf('.'))
      if (decimalIndex < 0) {
        return
      }

      try {
        input.setSelectionRange(decimalIndex, decimalIndex)
      } catch {
        // Ignore selection errors on unsupported input types.
      }
    })
  }

  const handleInput = () => {
    handleCaretForCurrency()
  }

  const handleBlur = () => {
    input.removeEventListener('input', handleInput)
  }

  input.addEventListener('input', handleInput)
  input.addEventListener('blur', handleBlur, { once: true })

  // `select()` must run after the browser applies focus; requestAnimationFrame ensures that.
  window.requestAnimationFrame(() => {
    if (document.activeElement === input) {
      selectAll()
    }
  })
}
