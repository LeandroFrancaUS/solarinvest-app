// src/features/project-finance/__tests__/deriveProjectFinanceCosts.test.ts
// Unit tests for the AF-engine cost derivation function.
// Verifies that the same formulas as App.tsx's Análise Financeira are used.

import { describe, it, expect } from 'vitest'
import { deriveProjectFinanceCosts, LEASING_PREMISE_DEFAULTS } from '../calculations'
import {
  CREA_GO_RS,
  CREA_DF_RS,
  PROJETO_FAIXAS,
  resolveCustoProjetoPorFaixa,
  calcSeguroLeasing,
} from '../../../lib/finance/analiseFinanceiraSpreadsheet'

describe('deriveProjectFinanceCosts', () => {
  describe('auto-pricing formulas (same as App.tsx)', () => {
    it('computes custo_equipamentos = round(1500 + 9.5 × consumo)', () => {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: 400 }, 'leasing')
      expect(result.custo_equipamentos).toBe(Math.round(1500 + 9.5 * 400))
    })

    it('computes custo_frete_logistica = round(300 + 0.52 × consumo)', () => {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: 400 }, 'leasing')
      expect(result.custo_frete_logistica).toBe(Math.round(300 + 0.52 * 400))
    })

    it('returns no kit/frete when consumo is null', () => {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: null }, 'leasing')
      expect(result.custo_equipamentos).toBeUndefined()
      expect(result.custo_frete_logistica).toBeUndefined()
    })

    it('returns no kit/frete when consumo is zero', () => {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: 0 }, 'leasing')
      expect(result.custo_equipamentos).toBeUndefined()
      expect(result.custo_frete_logistica).toBeUndefined()
    })
  })

  describe('engineering cost by kWp faixa', () => {
    it('uses resolveCustoProjetoPorFaixa with default faixas', () => {
      const kwp = 8
      const expected = resolveCustoProjetoPorFaixa(kwp, PROJETO_FAIXAS)
      const result = deriveProjectFinanceCosts({ potencia_sistema_kwp: kwp }, 'leasing')
      expect(result.custo_engenharia).toBe(expected)
    })

    it('uses custom faixas when provided', () => {
      const faixas = [{ max_kwp: 10, valor_rs: 999 }, { max_kwp: Infinity, valor_rs: 1500 }]
      const result = deriveProjectFinanceCosts(
        { potencia_sistema_kwp: 5, projeto_faixas: faixas },
        'leasing',
      )
      expect(result.custo_engenharia).toBe(999)
    })

    it('returns no engineering cost when kwp is null', () => {
      const result = deriveProjectFinanceCosts({ potencia_sistema_kwp: null }, 'leasing')
      expect(result.custo_engenharia).toBeUndefined()
    })
  })

  describe('CREA by UF', () => {
    it('uses CREA_GO_RS for non-DF states', () => {
      const result = deriveProjectFinanceCosts({ uf: 'GO' }, 'leasing')
      expect(result.custo_homologacao).toBe(CREA_GO_RS)
    })

    it('uses CREA_GO_RS when uf is null (defaults to GO)', () => {
      const result = deriveProjectFinanceCosts({ uf: null }, 'leasing')
      expect(result.custo_homologacao).toBe(CREA_GO_RS)
    })

    it('uses CREA_DF_RS for DF state', () => {
      const result = deriveProjectFinanceCosts({ uf: 'DF' }, 'leasing')
      expect(result.custo_homologacao).toBe(CREA_DF_RS)
    })

    it('can use custom CREA values', () => {
      const result = deriveProjectFinanceCosts({ uf: 'GO', crea_go_rs: 200 }, 'leasing')
      expect(result.custo_homologacao).toBe(200)
    })
  })

  describe('leasing: seguro derived from CAPEX base', () => {
    it('computes seguro using calcSeguroLeasing on capex base', () => {
      const consumo = 500
      const kwp = 10
      const custo_equipamentos = Math.round(1500 + 9.5 * consumo)
      const custo_frete = Math.round(300 + 0.52 * consumo)
      const custo_eng = resolveCustoProjetoPorFaixa(kwp, PROJETO_FAIXAS)
      const custo_crea = CREA_GO_RS
      const capexBase = custo_equipamentos + custo_frete + custo_eng + custo_crea
      const expectedSeguro = calcSeguroLeasing(capexBase)

      const result = deriveProjectFinanceCosts(
        { consumo_kwh_mes: consumo, potencia_sistema_kwp: kwp, uf: 'GO' },
        'leasing',
      )
      expect(result.custo_seguro).toBe(expectedSeguro)
    })

    it('computes seguro from CREA-only capex when no other cost inputs are available', () => {
      // CREA is always computed (defaults to GO), so capexBase >= CREA_GO_RS
      const result = deriveProjectFinanceCosts({}, 'leasing')
      expect(result.custo_homologacao).toBe(CREA_GO_RS)
      // seguro is derived from the CREA-only capex base
      const expectedSeguro = calcSeguroLeasing(CREA_GO_RS)
      expect(result.custo_seguro).toBeCloseTo(expectedSeguro, 6)
    })
  })

  describe('leasing: comissao = mensalidade_base (CAC)', () => {
    it('sets custo_comissao to mensalidade_base for leasing', () => {
      const result = deriveProjectFinanceCosts({ mensalidade_base: 1200 }, 'leasing')
      expect(result.custo_comissao).toBe(1200)
    })

    it('skips custo_comissao when mensalidade_base is null', () => {
      const result = deriveProjectFinanceCosts({ mensalidade_base: null }, 'leasing')
      expect(result.custo_comissao).toBeUndefined()
    })
  })

  describe('leasing: custo_impostos over contract term', () => {
    it('computes total impostos for leasing when mensalidade and prazo are provided', () => {
      const mensalidade = 1000
      const prazo = 60
      const aliquota = 4 / 100
      const expectedImpostoPerMonth = mensalidade * aliquota
      const result = deriveProjectFinanceCosts(
        { mensalidade_base: mensalidade, prazo_meses: prazo },
        'leasing',
      )
      expect(result.custo_impostos).toBeCloseTo(expectedImpostoPerMonth * prazo, 2)
    })

    it('skips custo_impostos when prazo is missing', () => {
      const result = deriveProjectFinanceCosts({ mensalidade_base: 1000 }, 'leasing')
      expect(result.custo_impostos).toBeUndefined()
    })
  })

  describe('venda: comissao as % of capex', () => {
    it('computes custo_comissao as comissao_minima_percent of capex base', () => {
      const consumo = 400
      const custo_equipamentos = Math.round(1500 + 9.5 * consumo)
      const custo_frete = Math.round(300 + 0.52 * consumo)
      const custo_crea = CREA_GO_RS
      const capexBase = custo_equipamentos + custo_frete + custo_crea
      const expected = Math.round(capexBase * (5 / 100))

      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: consumo, uf: 'GO' }, 'venda')
      expect(result.custo_comissao).toBe(expected)
    })

    it('does not set custo_seguro for venda', () => {
      const result = deriveProjectFinanceCosts(
        { consumo_kwh_mes: 500, potencia_sistema_kwp: 10, mensalidade_base: 1200 },
        'venda',
      )
      expect(result.custo_seguro).toBeUndefined()
    })
  })

  describe('full leasing scenario', () => {
    it('derives all expected cost fields from complete input', () => {
      const consumo = 450
      const kwp = 9
      const mensalidade = 1100
      const prazo = 60

      const result = deriveProjectFinanceCosts(
        {
          consumo_kwh_mes: consumo,
          potencia_sistema_kwp: kwp,
          uf: 'GO',
          mensalidade_base: mensalidade,
          prazo_meses: prazo,
        },
        'leasing',
      )

      expect(result.custo_equipamentos).toBe(Math.round(1500 + 9.5 * consumo))
      expect(result.custo_frete_logistica).toBe(Math.round(300 + 0.52 * consumo))
      expect(result.custo_engenharia).toBe(resolveCustoProjetoPorFaixa(kwp, PROJETO_FAIXAS))
      expect(result.custo_homologacao).toBe(CREA_GO_RS)
      expect(result.custo_comissao).toBe(mensalidade)
      expect(typeof result.custo_seguro).toBe('number')
      expect((result.custo_seguro ?? 0)).toBeGreaterThan(0)
      expect(typeof result.custo_impostos).toBe('number')
      expect((result.custo_impostos ?? 0)).toBeGreaterThan(0)
    })
  })

  describe('LEASING_PREMISE_DEFAULTS — auto-fill of empty leasing premises', () => {
    it('applies LEASING_PREMISE_DEFAULTS when caller omits the premise inputs', () => {
      // Caller passes none of reajuste / inadimplencia / opex / manutencao.
      // The engine must still emit all four with the AF-screen defaults so
      // "Preencher campos vazios" produces useful values out of the box.
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: 400 }, 'leasing')
      expect(result.reajuste_anual_pct).toBe(LEASING_PREMISE_DEFAULTS.reajuste_anual_pct)
      expect(result.inadimplencia_pct).toBe(LEASING_PREMISE_DEFAULTS.inadimplencia_pct)
      expect(result.opex_pct).toBe(LEASING_PREMISE_DEFAULTS.custo_operacional_pct)
      expect(result.custo_manutencao).toBe(LEASING_PREMISE_DEFAULTS.custo_manutencao)
    })

    it('honours explicit caller values over LEASING_PREMISE_DEFAULTS', () => {
      const result = deriveProjectFinanceCosts(
        {
          reajuste_anual_pct: 7,
          inadimplencia_pct: 5,
          custo_operacional_pct: 8,
          custo_manutencao: 120,
        },
        'leasing',
      )
      expect(result.reajuste_anual_pct).toBe(7)
      expect(result.inadimplencia_pct).toBe(5)
      expect(result.opex_pct).toBe(8)
      expect(result.custo_manutencao).toBe(120)
    })

    it('does not emit leasing premise defaults for venda contracts', () => {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: 400 }, 'venda')
      expect(result.reajuste_anual_pct).toBeUndefined()
      expect(result.inadimplencia_pct).toBeUndefined()
      expect(result.opex_pct).toBeUndefined()
      expect(result.custo_manutencao).toBeUndefined()
    })

    it('cascades mensalidade_base into CAC, impostos and receita_esperada', () => {
      // Smallest scenario: only mensalidade_base + prazo_meses. The engine
      // must derive CAC (= mensalidade), receita_esperada (= mens × prazo),
      // and total impostos over the contract term.
      const result = deriveProjectFinanceCosts(
        { mensalidade_base: 800, prazo_meses: 60 },
        'leasing',
      )
      expect(result.mensalidade_base).toBe(800)
      expect(result.custo_comissao).toBe(800)
      expect(result.receita_esperada).toBe(800 * 60)
      expect(typeof result.custo_impostos).toBe('number')
      expect((result.custo_impostos ?? 0)).toBeGreaterThan(0)
    })
  })
})
