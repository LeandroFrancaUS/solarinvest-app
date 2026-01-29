/**
 * Helper functions for PDF proposal generation
 * to avoid orphaned sections and improve layout quality
 */

/**
 * Check if a value has meaningful content (not empty, null, undefined, or placeholder)
 * @param value - The value to check
 * @returns true if the value has meaningful content
 */
export const hasMeaningfulValue = (value: unknown): boolean => {
  if (value == null) {
    return false
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === '—' || trimmed === 'N/A' || trimmed === '-') {
      return false
    }
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value === 'boolean') {
    return true
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }

  return false
}

/**
 * Check if a section should be rendered based on its content
 * Prevents orphaned section titles by checking if there's meaningful data
 * @param data - The data to check (can be an array of rows, object, or single value)
 * @returns true if the section has meaningful content and should be rendered
 */
export const shouldRenderSection = (data: unknown): boolean => {
  if (data == null) {
    return false
  }

  if (Array.isArray(data)) {
    // For arrays, check if there's at least one item with meaningful value
    return data.some((item) => {
      if (item == null) {
        return false
      }
      // If it's an object, check if it has at least one meaningful property
      if (typeof item === 'object') {
        return Object.values(item).some(hasMeaningfulValue)
      }
      return hasMeaningfulValue(item)
    })
  }

  if (typeof data === 'object') {
    // For objects, check if at least one property has meaningful value
    return Object.values(data).some(hasMeaningfulValue)
  }

  return hasMeaningfulValue(data)
}

/**
 * Check if text content is meaningful (has actual content beyond whitespace)
 * @param text - The text to check
 * @returns true if the text has meaningful content
 */
export const hasMeaningfulText = (text: string | null | undefined): boolean => {
  if (!text) {
    return false
  }

  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed !== '—' && trimmed !== 'N/A' && trimmed !== '-'
}

/**
 * Check if a table/list has meaningful rows
 * @param rows - Array of row objects
 * @param minRows - Minimum number of rows required (default: 1)
 * @returns true if there are enough meaningful rows
 */
export const hasMinimumRows = (
  rows: unknown[] | null | undefined,
  minRows: number = 1,
): boolean => {
  if (!Array.isArray(rows)) {
    return false
  }

  const meaningfulRows = rows.filter((row) => {
    if (row == null) {
      return false
    }
    if (typeof row === 'object') {
      return Object.values(row).some(hasMeaningfulValue)
    }
    return hasMeaningfulValue(row)
  })

  return meaningfulRows.length >= minRows
}
