export const invariant = (condition: unknown, message: string): asserts condition => {
  if (!condition) {
    throw new Error(message)
  }
}

export const num = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return fallback
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const parsed = typeof value === 'object' && value !== null ? Number(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const nonEmpty = <T>(value: T[] | null | undefined): T[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }
  return value
}
