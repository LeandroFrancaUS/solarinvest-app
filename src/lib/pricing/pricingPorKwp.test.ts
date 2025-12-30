import { describe, expect, it } from 'vitest'
import { calcPricingPorKwp, formatBRL, getRedeByPotencia, type Rede } from './pricingPorKwp'

type PricingCase = {
  kwp: number
  rede: Rede
  custoFinal: number
  kitValor: number
}

describe('getRedeByPotencia', () => {
  const cases: { kwp: number; rede: Rede }[] = [
    { kwp: 2.7, rede: 'mono' },
    { kwp: 23.22, rede: 'mono' },
    { kwp: 23.23, rede: 'trifasico' },
    { kwp: 50, rede: 'trifasico' },
  ]

  it.each(cases)('returns correct rede for $kwp kWp', ({ kwp, rede }) => {
    expect(getRedeByPotencia(kwp)).toBe(rede)
  })
})

describe('calcPricingPorKwp', () => {
  const anchorCases: PricingCase[] = [
    { kwp: 2.7, rede: 'mono', custoFinal: 7912.83, kitValor: 4138.79 },
    { kwp: 4.32, rede: 'mono', custoFinal: 10063.53, kitValor: 5590.18 },
    { kwp: 8.1, rede: 'mono', custoFinal: 16931.2, kitValor: 9416.0 },
    { kwp: 15.66, rede: 'mono', custoFinal: 30328.53, kitValor: 17647.64 },
    { kwp: 23.22, rede: 'mono', custoFinal: 44822.0, kitValor: 26982.46 },
    { kwp: 38.88, rede: 'trifasico', custoFinal: 73320.83, kitValor: 46665.64 },
  ]

  it.each(anchorCases)('returns anchors for $kwp kWp', (expected) => {
    const result = calcPricingPorKwp(expected.kwp)
    expect(result).toEqual({
      rede: expected.rede,
      custoFinal: expected.custoFinal,
      kitValor: expected.kitValor,
    })
  })

  it('applies piso mínimo for values below first anchor', () => {
    const result = calcPricingPorKwp(1.5)
    expect(result).toEqual({ rede: 'mono', custoFinal: 7912.83, kitValor: 4138.79 })
  })

  it('interpolates values between anchors', () => {
    const result = calcPricingPorKwp(5.21)
    expect(result).toEqual({ rede: 'mono', custoFinal: 11680.52, kitValor: 6490.97 })
  })

  it('extrapolates values above last trifásico anchor', () => {
    const result = calcPricingPorKwp(50)
    expect(result).toEqual({ rede: 'trifasico', custoFinal: 92706.65, kitValor: 59987.93 })
  })

  it('returns null for invalid inputs', () => {
    expect(calcPricingPorKwp(Number.NaN)).toBeNull()
    expect(calcPricingPorKwp(-10)).toBeNull()
    expect(calcPricingPorKwp(0)).toBeNull()
  })

  it('returns null above 90 kWp (fallback para manual)', () => {
    expect(calcPricingPorKwp(90.1)).toBeNull()
    expect(calcPricingPorKwp(120)).toBeNull()
  })
})

describe('formatBRL', () => {
  it('formats numbers as BRL currency', () => {
    expect(formatBRL(1234.56)).toBe('R$\u00a01.234,56')
  })
})
