import { describe, expect, it } from 'vitest'
import {
  calcPotenciaSistemaKwp,
  calcPricingPorKwp,
  calcProjectedCostsByConsumption,
  getRedeByPotencia,
} from './pricingPorKwp'

describe('pricingPorKwp', () => {
  it('usa piso mínimo para valores baixos', () => {
    const pricing = calcPricingPorKwp(2)
    expect(pricing).toEqual({ rede: 'mono', custoFinal: 7912.83, kitValor: 4138.79 })
  })

  it('interpolates mono anchors', () => {
    const pricing = calcPricingPorKwp(6)
    expect(pricing).toEqual({ rede: 'mono', custoFinal: 13115.827777777778, kitValor: 7290.544444444445 })
  })

  it('switches to trifasico above 23.22', () => {
    const pricing = calcPricingPorKwp(30)
    expect(pricing?.rede).toBe('trifasico')
  })

  it('extrapolates on trifasico range', () => {
    const pricing = calcPricingPorKwp(50)
    expect(pricing).toEqual({ rede: 'trifasico', custoFinal: 92706.65406130267, kitValor: 59987.9254661558 })
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



  it('calcula primeira mensalidade como consumo * (tarifa * (1 - desconto))', () => {
    const projected = calcProjectedCostsByConsumption({
      consumoKwhMes: 1000,
      uf: 'GO',
      tarifaCheia: 1.14,
      descontoPercentual: 20,
      irradiacao: 5.55,
      performanceRatio: 0.8,
      diasMes: 30,
      potenciaModuloWp: 545,
      margemLucroPct: 0.3,
      comissaoVendaPct: 0.05,
    })

    expect(projected).not.toBeNull()
    if (!projected) return

    expect(projected.primeiraMensalidade).toBeCloseTo(912, 6)
  })

  it('aumenta custo final quando desconto contratual diminui', () => {
    const baseParams = {
      consumoKwhMes: 1000,
      uf: 'GO',
      tarifaCheia: 1.14,
      irradiacao: 5.55,
      performanceRatio: 0.8,
      diasMes: 30,
      potenciaModuloWp: 545,
      margemLucroPct: 0.3,
      comissaoVendaPct: 0.05,
    }

    const comDescontoMaior = calcProjectedCostsByConsumption({
      ...baseParams,
      descontoPercentual: 20,
    })
    const comDescontoMenor = calcProjectedCostsByConsumption({
      ...baseParams,
      descontoPercentual: 10,
    })

    expect(comDescontoMaior).not.toBeNull()
    expect(comDescontoMenor).not.toBeNull()
    if (!comDescontoMaior || !comDescontoMenor) return

    expect(comDescontoMenor.primeiraMensalidade).toBeGreaterThan(comDescontoMaior.primeiraMensalidade)
    expect(comDescontoMenor.custoFinalLeasing).toBeGreaterThan(comDescontoMaior.custoFinalLeasing)
  })
  it('calcula custos projetados atualizados para leasing e venda por consumo', () => {
    const projected = calcProjectedCostsByConsumption({
      consumoKwhMes: 1000,
      uf: 'GO',
      tarifaCheia: 1.14,
      descontoPercentual: 20,
      irradiacao: 5.55,
      performanceRatio: 0.8,
      diasMes: 30,
      potenciaModuloWp: 545,
      margemLucroPct: 0.3,
      comissaoVendaPct: 0.05,
    })

    expect(projected).not.toBeNull()
    if (!projected) return

    expect(projected.custoBaseProjeto).toBeGreaterThan(13000)
    expect(projected.custoBaseProjeto).toBeLessThan(14100)
    expect(projected.custoFinalLeasing).toBeGreaterThan(17000)
    expect(projected.custoFinalLeasing).toBeLessThan(19000)
    expect(projected.custoFinalVenda).toBeGreaterThan(projected.custoFinalLeasing)
  })
})
