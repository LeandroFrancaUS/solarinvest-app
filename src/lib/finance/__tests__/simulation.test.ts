import { describe, expect, it } from 'vitest'

import {
  calcEconomiaContrato,
  calcKPIs,
  calcTarifaComDesconto,
  calcValorMercado,
  defaultTUSD,
  projectTarifaCheia,
  type Simulacao,
} from '../simulation'

const createSimulacao = (overrides: Partial<Simulacao> = {}): Simulacao => {
  const now = Date.now()
  return {
    id: 'SIM-TEST',
    nome: 'Teste',
    createdAt: now,
    updatedAt: now,
    desconto_pct: 20,
    capex_solarinvest: 100000,
    anos_contrato: 5,
    inflacao_energetica_pct: 10,
    inflacao_ipca_pct: 4,
    tarifa_cheia_r_kwh_m1: 1,
    kc_kwh_mes: 600,
    perfil_consumo: 'residencial',
    tusd_pct: 65,
    seguro_pct: 0.8,
    obs: '',
    subtrair_tusd_contrato: true,
    subtrair_tusd_pos_contrato: true,
    ...overrides,
  }
}

describe('simulation finance helpers', () => {
  it('calcula tarifa com desconto corretamente', () => {
    expect(calcTarifaComDesconto(1.2, 20)).toBeCloseTo(0.96, 6)
  })

  it('calcula valor de mercado como 1,29x o CAPEX', () => {
    expect(calcValorMercado(100000)).toBe(129000)
  })

  it('projeta tarifa cheia com inflação anual convertida para mensal', () => {
    const inflacao = 10
    const crescimentoMensal = Math.pow(1 + inflacao / 100, 1 / 12) - 1
    expect(projectTarifaCheia(1, inflacao, 1)).toBeCloseTo(1, 6)
    expect(projectTarifaCheia(1, inflacao, 13)).toBeCloseTo(Math.pow(1 + crescimentoMensal, 12), 6)
  })

  it('retorna TUSD padrão por perfil', () => {
    expect(defaultTUSD('residencial')).toBe(65)
    expect(defaultTUSD('comercial')).toBe(25)
  })

  it('gera economia acumulada positiva quando há desconto e consumo', () => {
    const sim = createSimulacao({ desconto_pct: 18, kc_kwh_mes: 800, inflacao_energetica_pct: 8 })
    expect(calcEconomiaContrato(sim)).toBeGreaterThan(0)
  })

  it('estima payback finito quando a receita cobre o CAPEX e infinito caso contrário', () => {
    const comPayback = createSimulacao({ capex_solarinvest: 20000, kc_kwh_mes: 900, desconto_pct: 25, tusd_pct: 30 })
    const kpisPositivo = calcKPIs(comPayback)
    expect(Number.isFinite(kpisPositivo.paybackMeses)).toBe(true)
    if (Number.isFinite(kpisPositivo.paybackMeses)) {
      expect(Number.isInteger(kpisPositivo.paybackMeses)).toBe(true)
    }

    const semPayback = createSimulacao({ capex_solarinvest: 5000000, kc_kwh_mes: 150, desconto_pct: 5 })
    const kpisNegativo = calcKPIs(semPayback)
    expect(kpisNegativo.paybackMeses).toBe(Number.POSITIVE_INFINITY)
  })
})
