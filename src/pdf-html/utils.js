export const joinClassNames = (...values) => values.filter(Boolean).join(' ')

export const hasMeaningfulValue = (value) => {
  if (value == null) return false
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) return false
    const lowered = normalized.toLowerCase()
    return !['—', '-', 'n/a', 'na', 'n.d.', 'nd'].includes(lowered)
  }
  if (Array.isArray(value)) return value.some(hasMeaningfulValue)
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue)
  return Boolean(value)
}

export const sectionShouldRender = (rows = []) =>
  rows.some((row) => {
    if (row && typeof row === 'object' && 'value' in row) {
      return hasMeaningfulValue(row.value)
    }
    return hasMeaningfulValue(row)
  })
