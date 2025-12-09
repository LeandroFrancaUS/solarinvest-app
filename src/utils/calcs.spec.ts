import { describe, expect, it } from 'vitest'

import {
  creditoMensal,
  kcAjustadoPorEntrada,
  tarifaDescontada,
  toMonthly,
  valorCompraCliente,
} from './calcs'
import {
  calcularEconomiaMensal,
  calcularTarifaProjetada,
  calcularTUSDFioB,
  calcularValorContaRede,
} from '../lib/finance/calculations'

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

  it('mantém valor de compra positivo até o último mês e zera no mês de aceite', () => {
    const params = {
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
    }

    const ultimoMes = valorCompraCliente({ ...params, m: 60 })
    const mesAceite = valorCompraCliente({ ...params, m: 61 })

    expect(ultimoMes).toBeGreaterThan(0)
    expect(mesAceite).toBe(0)
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

  it('projeta tarifa apenas pela inflação energética anual', () => {
    const tarifa = calcularTarifaProjetada(1, 0.08, 2)
    expect(tarifa).toBeCloseTo(1 * Math.pow(1.08, 2), 8)
  })

  it('calcula taxa mínima pelo tipo de ligação', () => {
    const valorContaRede = calcularValorContaRede({
      tarifaCheia: 0.9,
      inflacaoEnergetica: 0,
      anosDecorridos: 0,
      tipoLigacao: 'monofasica',
      cipValor: 0,
      tusd: null,
      energiaGeradaKwh: 0,
    })
    expect(valorContaRede).toBeCloseTo(0.9 * 30, 8)
  })

  it('aplica CIP e TUSD Fio B sobre a mensalidade', () => {
    const tusdFioB = calcularTUSDFioB(500, 0.5, 0.25, 0.2, 0.22, 0.75)
    const valorContaRede = calcularValorContaRede({
      tarifaCheia: 1,
      inflacaoEnergetica: 0.05,
      anosDecorridos: 1,
      tipoLigacao: 'bifasica',
      cipValor: 15,
      tusd: {
        percentualFioB: 0.25,
        simultaneidade: 0.5,
        tarifaRkwh: 0.2,
        tarifaFioBOficial: 0.22,
        fatorIncidenciaLei14300: 0.75,
      },
      energiaGeradaKwh: 500,
    })

    const tarifaProjetada = calcularTarifaProjetada(1, 0.05, 1)
    const taxaMinimaEsperada = tarifaProjetada * 50
    expect(tusdFioB).toBeGreaterThan(0)
    expect(valorContaRede).toBeCloseTo(taxaMinimaEsperada + 15 + tusdFioB, 6)
  })

  it('calcula economia mensal considerando apenas conta com e sem solar', () => {
    const economia = calcularEconomiaMensal({
      consumoMensalKwh: 600,
      tarifaCheia: 0.8,
      inflacaoEnergetica: 0.04,
      anosDecorridos: 0.5,
      tipoLigacao: 'trifasica',
      cipValor: 12,
      tusd: { percentualFioB: 0.2, simultaneidade: 0.6, tarifaRkwh: 0.25 },
      energiaGeradaKwh: 650,
    })

    expect(economia).toBeGreaterThan(0)
  })
})
