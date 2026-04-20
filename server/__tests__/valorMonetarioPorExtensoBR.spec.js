// server/__tests__/valorMonetarioPorExtensoBR.spec.js
// Unit tests for the valorMonetarioPorExtensoBR helper in leasingContracts.js
import { describe, it, expect } from 'vitest'
import { valorMonetarioPorExtensoBR } from '../leasingContracts.js'

describe('valorMonetarioPorExtensoBR', () => {
  it('converts zero to "zero reais"', () => {
    expect(valorMonetarioPorExtensoBR(0)).toBe('zero reais')
  })

  it('converts 1 real to "um real"', () => {
    expect(valorMonetarioPorExtensoBR(1)).toBe('um real')
  })

  it('converts 2 reais to "dois reais"', () => {
    expect(valorMonetarioPorExtensoBR(2)).toBe('dois reais')
  })

  it('converts 100 to "cem reais"', () => {
    expect(valorMonetarioPorExtensoBR(100)).toBe('cem reais')
  })

  it('converts 101 to "cento e um reais"', () => {
    expect(valorMonetarioPorExtensoBR(101)).toBe('cento e um reais')
  })

  it('converts 1000 to "mil reais"', () => {
    expect(valorMonetarioPorExtensoBR(1000)).toBe('mil reais')
  })

  it('converts 2000 to "dois mil reais"', () => {
    expect(valorMonetarioPorExtensoBR(2000)).toBe('dois mil reais')
  })

  it('converts 13600.81 to "treze mil e seiscentos reais e oitenta e um centavos"', () => {
    expect(valorMonetarioPorExtensoBR(13600.81))
      .toBe('treze mil e seiscentos reais e oitenta e um centavos')
  })

  it('converts 13600.00 to "treze mil e seiscentos reais" (no centavos)', () => {
    expect(valorMonetarioPorExtensoBR(13600)).toBe('treze mil e seiscentos reais')
  })

  it('converts 0.81 to "oitenta e um centavos"', () => {
    expect(valorMonetarioPorExtensoBR(0.81)).toBe('oitenta e um centavos')
  })

  it('converts 0.01 to "um centavo"', () => {
    expect(valorMonetarioPorExtensoBR(0.01)).toBe('um centavo')
  })

  it('converts 500000 to "quinhentos mil reais"', () => {
    expect(valorMonetarioPorExtensoBR(500000)).toBe('quinhentos mil reais')
  })

  it('converts 1000000 to "um milhão reais"', () => {
    expect(valorMonetarioPorExtensoBR(1000000)).toBe('um milhão reais')
  })

  it('converts 25999.99 to correct full phrase', () => {
    expect(valorMonetarioPorExtensoBR(25999.99))
      .toBe('vinte e cinco mil e novecentos e noventa e nove reais e noventa e nove centavos')
  })

  it('handles floating point rounding correctly for 0.005', () => {
    // 0.005 rounds to 0.01 = 1 centavo
    expect(valorMonetarioPorExtensoBR(0.005)).toBe('um centavo')
  })
})
