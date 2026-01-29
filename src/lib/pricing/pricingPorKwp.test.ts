import { describe, expect, it } from 'vitest'
import { calcPotenciaSistemaKwp, calcPricingPorKwp, getRedeByPotencia } from './pricingPorKwp'

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

  it('calcula potencia do sistema no estilo leasing com modulo', () => {
    const potencia = calcPotenciaSistemaKwp({
      consumoKwhMes: 1000,
      irradiacao: 5,
      performanceRatio: 0.8,
      diasMes: 30,
      potenciaModuloWp: 550,
    })

    expect(potencia).toEqual({ potenciaKwp: 8.8, quantidadeModulos: 16 })
  })

  it('calcula potencia do sistema mesmo sem modulo informado', () => {
    const potencia = calcPotenciaSistemaKwp({
      consumoKwhMes: 1000,
      irradiacao: 5,
      performanceRatio: 0.8,
      diasMes: 30,
      potenciaModuloWp: null,
    })

    expect(potencia).toEqual({ potenciaKwp: 8.33, quantidadeModulos: null })
  })

  it('usa defaults de leasing quando irradiacao ou performance ratio nao sao informados', () => {
    const potencia = calcPotenciaSistemaKwp({
      consumoKwhMes: 1000,
      irradiacao: null,
      performanceRatio: undefined,
      diasMes: null,
      potenciaModuloWp: 550,
    })

    expect(potencia).toEqual({ potenciaKwp: 7.7, quantidadeModulos: 14 })
  })

  it('retorna null quando consumo é inválido', () => {
    expect(
      calcPotenciaSistemaKwp({
        consumoKwhMes: null,
        irradiacao: 5,
        performanceRatio: 0.8,
        potenciaModuloWp: 550,
      }),
    ).toBeNull()
  })
})
