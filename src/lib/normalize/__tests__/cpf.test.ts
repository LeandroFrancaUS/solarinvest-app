import { describe, it, expect } from 'vitest'
import { normalizeCpf, isValidCpf, formatCpf, normalizeAndValidateCpf } from '../cpf'

describe('normalizeCpf', () => {
  it('strips punctuation', () => {
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909')
  })
  it('returns null for short input', () => {
    expect(normalizeCpf('1234')).toBeNull()
  })
  it('returns null for null', () => {
    expect(normalizeCpf(null)).toBeNull()
  })
  it('returns null for undefined', () => {
    expect(normalizeCpf(undefined)).toBeNull()
  })
  it('keeps 11 digits', () => {
    expect(normalizeCpf('12345678909')).toBe('12345678909')
  })
})

describe('isValidCpf', () => {
  it('validates a known valid CPF', () => {
    expect(isValidCpf('11144477735')).toBe(true)
  })
  it('rejects all-same digits', () => {
    expect(isValidCpf('11111111111')).toBe(false)
  })
  it('rejects invalid CPF', () => {
    expect(isValidCpf('12345678900')).toBe(false)
  })
  it('rejects null', () => {
    expect(isValidCpf(null)).toBe(false)
  })
})

describe('formatCpf', () => {
  it('formats correctly', () => {
    expect(formatCpf('12345678909')).toBe('123.456.789-09')
  })
  it('returns original if not 11 digits', () => {
    expect(formatCpf('123')).toBe('123')
  })
})

describe('normalizeAndValidateCpf', () => {
  it('normalizes and validates', () => {
    expect(normalizeAndValidateCpf('111.444.777-35')).toBe('11144477735')
  })
  it('returns null for invalid CPF', () => {
    expect(normalizeAndValidateCpf('111.444.777-00')).toBeNull()
  })
})
