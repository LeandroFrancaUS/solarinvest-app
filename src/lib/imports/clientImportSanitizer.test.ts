import { describe, it, expect } from 'vitest'
import {
  sanitizeText,
  sanitizeCpfCnpj,
  sanitizePhone,
  splitCidadeUf,
  sanitizePotenciaKwp,
  sanitizeAndDeduplicateClients,
} from './clientImportSanitizer'

describe('client import sanitizer', () => {
  it('sanitizeText removes [object Object] and icon noise', () => {
    expect(sanitizeText('[object Object]')).toBeNull()
    expect(sanitizeText('ℹ📁🗑')).toBeNull()
    expect(sanitizeText('0')).toBeNull()
  })

  it('sanitizeCpfCnpj keeps only valid lengths', () => {
    expect(sanitizeCpfCnpj('123.456.789-01')).toBe('12345678901')
    expect(sanitizeCpfCnpj('12.345.678/0001-99')).toBe('12345678000199')
    expect(sanitizeCpfCnpj('1234')).toBeNull()
  })

  it('sanitizePhone validates coherent ranges', () => {
    expect(sanitizePhone('(62) 98341-6949')).toBe('62983416949')
    expect(sanitizePhone('123')).toBeNull()
  })

  it('splitCidadeUf parses city and uf', () => {
    expect(splitCidadeUf('Anapolis/GO')).toEqual({ cidade: 'Anapolis', uf: 'GO' })
  })

  it('sanitizePotenciaKwp parses kwp text', () => {
    expect(sanitizePotenciaKwp('5,40 Kwp')).toBe(5.4)
    expect(sanitizePotenciaKwp('2.88 Kwp')).toBe(2.88)
  })

  it('deduplicates by keeping most complete row', () => {
    const { clients, discarded } = sanitizeAndDeduplicateClients([
      { Cliente: 'Maria Silva', CPF: '12345678901' },
      { Cliente: 'Maria Silva', CPF: '12345678901', Email: 'maria@email.com', Telefone: '(62) 99999-9999' },
    ])

    expect(clients).toHaveLength(1)
    expect(clients[0]?.email).toBe('maria@email.com')
    expect(discarded.length).toBeGreaterThan(0)
  })
})
