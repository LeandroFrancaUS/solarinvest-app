export function focusField(fieldId?: string) {
  if (!fieldId || typeof document === 'undefined') return
  const byId = document.getElementById(fieldId)
  if (byId) {
    byId.focus()
    byId.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const byName = document.querySelector(`[name="${fieldId}"]`) as HTMLElement | null
  if (byName) {
    byName.focus()
    byName.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
