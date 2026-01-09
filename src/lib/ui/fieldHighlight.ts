export function clearClientHighlights(root?: ParentNode) {
  if (typeof document === 'undefined') {
    return
  }
  const scope = root ?? document
  scope.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'))
  scope
    .querySelectorAll('.field-error-bg')
    .forEach((el) => el.classList.remove('field-error-bg'))
}

export function highlightElement(selector: string) {
  if (typeof document === 'undefined') {
    return
  }
  const elements = document.querySelectorAll(selector)
  if (!elements.length) {
    return
  }
  elements.forEach((el) => {
    el.classList.add('field-error')
    el.classList.add('field-error-bg')
  })
}

export function highlightMissingFields(
  orderedSelectors: string[],
  missingSelectors: string[],
) {
  if (typeof document === 'undefined') {
    return
  }
  for (const sel of missingSelectors) {
    highlightElement(sel)
  }

  const firstSel = orderedSelectors.find((selector) => missingSelectors.includes(selector))
  if (!firstSel) {
    return
  }

  const firstEl = document.querySelector(firstSel) as HTMLElement | null
  if (!firstEl) {
    return
  }

  firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  firstEl.focus?.()
}
