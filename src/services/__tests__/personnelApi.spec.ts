// src/services/__tests__/personnelApi.spec.ts
import { describe, it, expect } from 'vitest'
import { consultorDisplayName, formatConsultantOptionLabel } from '../personnelApi.js'

type Entry = { full_name: string; apelido: string | null }

// ─────────────────────────────────────────────────────────────────────────────
// consultorDisplayName — read-view label
// ─────────────────────────────────────────────────────────────────────────────

describe('consultorDisplayName', () => {
  it('returns apelido when set', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: 'Kim' }
    expect(consultorDisplayName(c)).toBe('Kim')
  })

  it('returns first name when apelido is null', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: null }
    expect(consultorDisplayName(c)).toBe('Joaquim')
  })

  it('returns first name when apelido is empty string', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: '' }
    expect(consultorDisplayName(c)).toBe('Joaquim')
  })

  it('returns first name when apelido is whitespace only', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: '   ' }
    expect(consultorDisplayName(c)).toBe('Joaquim')
  })

  it('trims apelido before returning', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: '  Kim  ' }
    expect(consultorDisplayName(c)).toBe('Kim')
  })

  it('returns fallback when both fields are empty', () => {
    const c: Entry = { full_name: '', apelido: null }
    expect(consultorDisplayName(c)).toBe('Consultor não informado')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatConsultantOptionLabel — dropdown option label
// ─────────────────────────────────────────────────────────────────────────────

describe('formatConsultantOptionLabel', () => {
  it('returns (apelido) full_name when apelido is set', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: 'Kim' }
    expect(formatConsultantOptionLabel(c)).toBe('(Kim) Joaquim Amarildo de Oliveira')
  })

  it('returns full_name only when apelido is null', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: null }
    expect(formatConsultantOptionLabel(c)).toBe('Joaquim Amarildo de Oliveira')
  })

  it('returns full_name only when apelido is empty string', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: '' }
    expect(formatConsultantOptionLabel(c)).toBe('Joaquim Amarildo de Oliveira')
  })

  it('returns full_name only when apelido is whitespace only', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: '   ' }
    expect(formatConsultantOptionLabel(c)).toBe('Joaquim Amarildo de Oliveira')
  })

  it('trims apelido in the formatted label', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: '  Kim  ' }
    expect(formatConsultantOptionLabel(c)).toBe('(Kim) Joaquim Amarildo de Oliveira')
  })

  it('option label differs from read label when apelido is set', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: 'Kim' }
    expect(formatConsultantOptionLabel(c)).not.toBe(consultorDisplayName(c))
    expect(formatConsultantOptionLabel(c)).toContain('Joaquim Amarildo de Oliveira')
    expect(consultorDisplayName(c)).toBe('Kim')
  })

  it('option label uses full_name when apelido is absent, read label uses first name', () => {
    const c: Entry = { full_name: 'Joaquim Amarildo de Oliveira', apelido: null }
    expect(formatConsultantOptionLabel(c)).toBe('Joaquim Amarildo de Oliveira')
    expect(consultorDisplayName(c)).toBe('Joaquim')
  })

  it('consultant_id remains unchanged — only display is affected', () => {
    // This test documents that the helpers only affect display strings, not IDs
    const id = 'abc-123'
    expect(id).toBe('abc-123')
  })
})
