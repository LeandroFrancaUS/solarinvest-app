import type { ClientFieldKey, RequiredClientField } from '../validation/clientRequiredFields'

const canUseDom = (): boolean => typeof document !== 'undefined'

export function clearClientHighlights(root?: ParentNode) {
  if (!canUseDom()) {
    return
  }
  const scope = root ?? document
  scope
    .querySelectorAll('input.field-error, select.field-error, textarea.field-error')
    .forEach((element) => element.classList.remove('field-error'))
}

export function clearFieldHighlight(target: EventTarget | null) {
  if (!canUseDom()) {
    return
  }
  if (target instanceof HTMLElement) {
    target.classList.remove('field-error')
  }
}

export function highlightMissingFields(
  requiredFields: RequiredClientField[],
  missingKeys: ClientFieldKey[],
) {
  if (!canUseDom()) {
    return
  }
  for (const field of requiredFields) {
    if (!missingKeys.includes(field.key)) {
      continue
    }
    document
      .querySelectorAll(field.selector)
      .forEach((element) => element.classList.add('field-error'))
  }

  const first = requiredFields.find((field) => missingKeys.includes(field.key))
  const firstEl = first ? (document.querySelector(first.selector) as HTMLElement | null) : null
  if (firstEl) {
    firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    firstEl.focus?.()
  }
}
