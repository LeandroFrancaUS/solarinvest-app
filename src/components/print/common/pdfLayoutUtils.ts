import type React from 'react'

export const hasMeaningfulValue = (value: unknown): boolean => {
  if (value == null) {
    return false
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) {
      return false
    }
    const lowered = normalized.toLowerCase()
    return !['—', '-', 'n/a', 'na', 'n.d.', 'nd'].includes(lowered)
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item))
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulValue(item))
  }

  return Boolean(value)
}

export const sectionShouldRender = (rows: Array<{ value?: unknown } | unknown>): boolean =>
  rows.some((row) => {
    if (row && typeof row === 'object' && 'value' in (row as { value?: unknown })) {
      return hasMeaningfulValue((row as { value?: unknown }).value)
    }
    return hasMeaningfulValue(row)
  })

export const hasRenderableChildren = (children: React.ReactNode): boolean => {
  const childArray = Array.isArray(children) ? children : [children]
  return childArray.some((child) => {
    if (child == null || typeof child === 'boolean') {
      return false
    }
    if (typeof child === 'string') {
      return child.trim().length > 0
    }
    return true
  })
}
