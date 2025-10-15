import { describe, expect, it } from 'vitest'

import {
  creditoMensal,
  kcAjustadoPorEntrada,
  mensalidadeLiquida,
  tarifaDescontada,
  toMonthly,
  valorCompraCliente,
} from './calcs'

describe('calcs utilitários', () => {
  it('converte taxa anual para mensal composto', () => {
    expect(toMonthly(0.08)).toBeCloseTo(0.006434, 6)
  })

  it('aplica desconto no primeiro mês sem inflação acumulada', () => {
    const tarifa = tarifaDescontada(0.95, 0.12, 0.08, 1, 6, 6)
    expect(tarifa).toBeCloseTo(0.95 * (1 - 0.12), 8)
  })

  it('aguarda 12 meses antes de aplicar o primeiro reajuste anual', () => {
    const antes = tarifaDescontada(1, 0, 0.08, 12, 7, 1)
    const depois = tarifaDescontada(1, 0, 0.08, 13, 7, 1)
    expect(antes).toBeCloseTo(1, 8)
    expect(depois).toBeCloseTo(1.08, 8)
  })

  it('mantém o primeiro ciclo sem reajuste mesmo quando o aniversário ocorre antes de 12 meses', () => {
    const antes = tarifaDescontada(1, 0, 0.08, 8, 6, 11)
    const depois = tarifaDescontada(1, 0, 0.08, 13, 6, 11)
    expect(antes).toBeCloseTo(1, 8)
    expect(depois).toBeCloseTo(1.08, 8)
  })

  it('distribui crédito mensal de entrada', () => {
    expect(creditoMensal(4200, 60)).toBe(70)
  })

  it('ajusta kc respeitando limites', () => {
    const kcOriginal = 650
    const ajustado = kcAjustadoPorEntrada(kcOriginal, 1.05, 0.18, 60, 12000)
    expect(ajustado).toBeGreaterThanOrEqual(0)
    expect(ajustado).toBeLessThanOrEqual(kcOriginal)
  })

  it('zera valor de compra no mês final do contrato', () => {
    const valor = valorCompraCliente({
      m: 60,
      vm0: 120_000,
      depreciacaoAa: 0.1,
      ipcaAa: 0.04,
      inadimplenciaAa: 0.03,
      tributosAa: 0.06,
      custosFixosM: 150,
      opexM: 120,
      seguroM: 60,
      pagosAcumAteM: 50_000,
      cashbackPct: 0.1,
      duracaoMeses: 60,
    })
    expect(valor).toBe(0)
  })

  it('não calcula valor de compra antes do mês 7', () => {
    const baseParams = {
      vm0: 150_000,
      depreciacaoAa: 0.08,
      ipcaAa: 0.04,
      inadimplenciaAa: 0.02,
      tributosAa: 0.05,
      custosFixosM: 200,
      opexM: 150,
      seguroM: 75,
      pagosAcumAteM: 20_000,
      cashbackPct: 0.05,
      duracaoMeses: 60,
    }
    const antes = valorCompraCliente({ ...baseParams, m: 6 })
    const depois = valorCompraCliente({ ...baseParams, m: 7 })
    expect(antes).toBe(0)
    expect(depois).toBeGreaterThanOrEqual(0)
  })

  it('aplica cashback reduzindo o valor de compra', () => {
    const comum = {
      m: 12,
      vm0: 200_000,
      depreciacaoAa: 0.07,
      ipcaAa: 0.04,
      inadimplenciaAa: 0.03,
      tributosAa: 0.05,
      custosFixosM: 250,
      opexM: 180,
      seguroM: 90,
      duracaoMeses: 72,
      pagosAcumAteM: 40_000,
    }
    const semCashback = valorCompraCliente({ ...comum, cashbackPct: 0 })
    const comCashback = valorCompraCliente({ ...comum, cashbackPct: 0.3 })
    expect(comCashback).toBeLessThanOrEqual(semCashback)
    expect(semCashback).toBeCloseTo(Math.round(semCashback * 100) / 100, 8)
  })

  it('mantém mensalidade mínima sem entrada', () => {
    const params = {
      kcKwhMes: 500,
      tarifaCheia: 0.92,
      desconto: 0.1,
      inflacaoAa: 0.06,
      m: 1,
      taxaMinima: 120,
      encargosFixos: 35,
      entradaRs: 0,
      prazoMeses: 60,
      modoEntrada: 'NONE' as const,
      mesReajuste: 6,
      mesReferencia: 1,
    }
    const mensalidade = mensalidadeLiquida(params)
    const tarifa = tarifaDescontada(
      params.tarifaCheia,
      params.desconto,
      params.inflacaoAa,
      params.m,
      params.mesReajuste,
      params.mesReferencia,
    )
    const esperado = Math.max(params.taxaMinima, params.kcKwhMes * tarifa + params.encargosFixos)
    expect(mensalidade).toBeCloseTo(esperado, 6)
  })
})
