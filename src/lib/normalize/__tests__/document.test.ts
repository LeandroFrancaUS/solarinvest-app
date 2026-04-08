import { describe, it, expect } from 'vitest'
import {
  detectDocumentType,
  normalizeDocument,
  isValidDocument,
  normalizeAndValidateDocument,
} from '../document'

describe('detectDocumentType', () => {
  it('detects CPF from 11-digit string', () => {
    expect(detectDocumentType('11144477735')).toBe('cpf')
  })
  it('detects CPF from formatted string', () => {
    expect(detectDocumentType('111.444.777-35')).toBe('cpf')
  })
  it('detects CNPJ from 14-digit string', () => {
    expect(detectDocumentType('11222333000181')).toBe('cnpj')
  })
  it('detects CNPJ from formatted string', () => {
    expect(detectDocumentType('11.222.333/0001-81')).toBe('cnpj')
  })
  it('returns unknown for 8 digits', () => {
    expect(detectDocumentType('12345678')).toBe('unknown')
  })
  it('returns unknown for null', () => {
    expect(detectDocumentType(null)).toBe('unknown')
  })
})

describe('normalizeDocument', () => {
  it('handles valid CPF', () => {
    const result = normalizeDocument('111.444.777-35')
    expect(result.type).toBe('cpf')
    expect(result.normalized).toBe('11144477735')
    expect(result.rawDigits).toBe('11144477735')
  })
  it('handles invalid CPF — normalized is null, rawDigits is set', () => {
    const result = normalizeDocument('111.444.777-00')
    expect(result.type).toBe('cpf')
    expect(result.normalized).toBeNull()
    expect(result.rawDigits).toBe('11144477700')
  })
  it('handles valid CNPJ', () => {
    const result = normalizeDocument('11.222.333/0001-81')
    expect(result.type).toBe('cnpj')
    expect(result.normalized).toBe('11222333000181')
    expect(result.rawDigits).toBe('11222333000181')
  })
  it('handles invalid CNPJ', () => {
    const result = normalizeDocument('11.222.333/0001-00')
    expect(result.type).toBe('cnpj')
    expect(result.normalized).toBeNull()
    expect(result.rawDigits).toBe('11222333000100')
  })
  it('returns unknown for empty input', () => {
    const result = normalizeDocument('')
    expect(result.type).toBe('unknown')
    expect(result.normalized).toBeNull()
  })
})

describe('isValidDocument', () => {
  it('returns true for valid CPF', () => {
    expect(isValidDocument('111.444.777-35')).toBe(true)
  })
  it('returns true for valid CNPJ', () => {
    expect(isValidDocument('11.222.333/0001-81')).toBe(true)
  })
  it('returns false for invalid CPF', () => {
    expect(isValidDocument('111.444.777-00')).toBe(false)
  })
  it('returns false for null', () => {
    expect(isValidDocument(null)).toBe(false)
  })
})

describe('normalizeAndValidateDocument', () => {
  it('returns normalized CPF for valid CPF', () => {
    expect(normalizeAndValidateDocument('111.444.777-35')).toBe('11144477735')
  })
  it('returns normalized CNPJ for valid CNPJ', () => {
    expect(normalizeAndValidateDocument('11.222.333/0001-81')).toBe('11222333000181')
  })
  it('returns null for invalid document', () => {
    expect(normalizeAndValidateDocument('00000000000')).toBeNull()
  })
})
