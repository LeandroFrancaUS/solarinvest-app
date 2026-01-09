export function clearClientHighlights(root?: ParentNode) {
  const scope = root ?? document
  scope.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'))
  scope.querySelectorAll('.field-error-bg').forEach((el) => el.classList.remove('field-error-bg'))
}

export function highlightElement(selector: string) {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return
  el.classList.add('field-error')
  el.classList.add('field-error-bg')
}

export function highlightMissingFields(orderedSelectors: string[], missingSelectors: string[]) {
  for (const sel of missingSelectors) highlightElement(sel)

  const firstSel = orderedSelectors.find((s) => missingSelectors.includes(s))
  if (!firstSel) return

  const firstEl = document.querySelector(firstSel) as HTMLElement | null
  if (!firstEl) return

  firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const focusTarget =
    firstEl.matches('input, select, textarea')
      ? firstEl
      : (firstEl.querySelector('input, select, textarea') as HTMLElement | null)
  focusTarget?.focus?.()
}
