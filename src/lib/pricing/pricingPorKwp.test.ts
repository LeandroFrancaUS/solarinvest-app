import { describe, expect, it } from 'vitest'
import {
  __internal,
  CUSTO_FINAL_MONO_POINTS,
  CUSTO_FINAL_TRI_POINTS,
  KIT_MONO_POINTS,
  KIT_TRI_POINTS,
  calcPricingPorKwp,
  formatBRL,
  getRedeByPotencia,
} from './pricingPorKwp'

const { interpolatePiecewise } = __internal

describe('pricingPorKwp', () => {
  it('calcula âncoras de custo final mono', () => {
    const anchors = CUSTO_FINAL_MONO_POINTS
    anchors.forEach(({ kwp, value }) => {
      const result = calcPricingPorKwp(kwp)
      expect(result?.custoFinal).toBeCloseTo(value, 2)
      expect(result?.rede).toBe('mono')
    })
  })

  it('calcula âncoras do kit mono', () => {
    const anchors = KIT_MONO_POINTS
    anchors.forEach(({ kwp, value }) => {
      const result = calcPricingPorKwp(kwp)
      expect(result?.kitValor).toBeCloseTo(value, 2)
      expect(result?.rede).toBe('mono')
    })
  })

  it('determina rede automaticamente', () => {
    expect(getRedeByPotencia(23.22)).toBe('mono')
    expect(getRedeByPotencia(23.2201)).toBe('trifasico')
    expect(getRedeByPotencia(25)).toBe('trifasico')
  })

  it('valida âncoras trifásico via interpolação', () => {
    const custo2322 = interpolatePiecewise(23.22, CUSTO_FINAL_TRI_POINTS)
    expect(custo2322).toBeCloseTo(46020.29, 2)

    const custo3888 = interpolatePiecewise(38.88, CUSTO_FINAL_TRI_POINTS)
    expect(custo3888).toBeCloseTo(73320.83, 2)

    const kit2322 = interpolatePiecewise(23.22, KIT_TRI_POINTS)
    expect(kit2322).toBeCloseTo(27904.22, 2)

    const kit3888 = interpolatePiecewise(38.88, KIT_TRI_POINTS)
    expect(kit3888).toBeCloseTo(46665.64, 2)
  })

  it('aplica piso mínimo', () => {
    const result = calcPricingPorKwp(2)
    expect(result?.custoFinal).toBeCloseTo(7912.83, 2)
    expect(result?.kitValor).toBeCloseTo(4138.79, 2)
    expect(calcPricingPorKwp(0)).toBeNull()
    expect(calcPricingPorKwp(Number.NaN)).toBeNull()
  })

  it('extrapola acima da última âncora', () => {
    const result = calcPricingPorKwp(40)
    expect(result).not.toBeNull()
    expect(result?.custoFinal).toBeGreaterThan(73320.83)
    expect(result?.kitValor).toBeGreaterThan(46665.64)
    expect(result?.rede).toBe('trifasico')
  })

  it('formata em BRL', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56')
  })
})
