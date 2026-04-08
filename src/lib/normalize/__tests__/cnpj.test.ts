import { describe, it, expect } from 'vitest'
import { normalizeCnpj, isValidCnpj, formatCnpj, normalizeAndValidateCnpj } from '../cnpj'

describe('normalizeCnpj', () => {
  it('strips punctuation', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181')
  })
  it('returns null for short input', () => {
    expect(normalizeCnpj('1234')).toBeNull()
  })
  it('returns null for null', () => {
    expect(normalizeCnpj(null)).toBeNull()
  })
  it('returns null for undefined', () => {
    expect(normalizeCnpj(undefined)).toBeNull()
  })
  it('keeps 14 digits unchanged', () => {
    expect(normalizeCnpj('11222333000181')).toBe('11222333000181')
  })
  it('returns null for 11-digit CPF input', () => {
    expect(normalizeCnpj('11144477735')).toBeNull()
  })
})

describe('isValidCnpj', () => {
  it('validates a known valid CNPJ', () => {
    // 11.222.333/0001-81 is a standard test CNPJ
    expect(isValidCnpj('11222333000181')).toBe(true)
  })
  it('rejects all-same digits', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })
  it('rejects wrong check digit', () => {
    expect(isValidCnpj('11222333000100')).toBe(false)
  })
  it('rejects null', () => {
    expect(isValidCnpj(null)).toBe(false)
  })
  it('rejects a string shorter than 14 digits', () => {
    expect(isValidCnpj('1122233300018')).toBe(false)
  })
})

describe('formatCnpj', () => {
  it('formats correctly', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })
  it('returns original if not 14 digits', () => {
    expect(formatCnpj('1234')).toBe('1234')
  })
  it('returns empty string for null', () => {
    expect(formatCnpj(null)).toBe('')
  })
})

describe('normalizeAndValidateCnpj', () => {
  it('normalizes and validates a valid CNPJ with punctuation', () => {
    expect(normalizeAndValidateCnpj('11.222.333/0001-81')).toBe('11222333000181')
  })
  it('returns null for invalid CNPJ', () => {
    expect(normalizeAndValidateCnpj('11.222.333/0001-00')).toBeNull()
  })
  it('returns null for null input', () => {
    expect(normalizeAndValidateCnpj(null)).toBeNull()
  })
})
