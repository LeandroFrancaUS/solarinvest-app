import { describe, expect, it } from 'vitest'
import { calcPricingPorKwp, getRedeByPotencia } from './pricingPorKwp'

describe('pricingPorKwp', () => {
  it('usa piso mínimo para valores baixos', () => {
    const pricing = calcPricingPorKwp(2)
    expect(pricing).toEqual({ rede: 'mono', custoFinal: 7912.83, kitValor: 4138.79 })
  })

  it('interpolates mono anchors', () => {
    const pricing = calcPricingPorKwp(6)
    expect(pricing).toEqual({ rede: 'mono', custoFinal: 13734.515, kitValor: 8069.032142857142 })
  })

  it('switches to trifasico above 23.22', () => {
    const pricing = calcPricingPorKwp(30)
    expect(pricing?.rede).toBe('trifasico')
  })

  it('extrapolates on trifasico range', () => {
    const pricing = calcPricingPorKwp(50)
    expect(pricing).toEqual({ rede: 'trifasico', custoFinal: 92012.02999999999, kitValor: 58469.28444444445 })
  })

  it('returns null for invalid or above limit', () => {
    expect(calcPricingPorKwp(-1)).toBeNull()
    expect(calcPricingPorKwp(Number.NaN)).toBeNull()
    expect(calcPricingPorKwp(120)).toBeNull()
  })

  it('computes rede helper', () => {
    expect(getRedeByPotencia(10)).toBe('mono')
    expect(getRedeByPotencia(24)).toBe('trifasico')
  })
})
