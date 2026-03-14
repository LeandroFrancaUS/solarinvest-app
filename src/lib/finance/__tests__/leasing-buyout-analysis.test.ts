import { describe, expect, it } from 'vitest'

import {
  analisarBuyout,
  calcularEconomiaFuturaBuyout,
  LIMITE_MELHOR_MES_PADRAO,
  MESES_ROI_BUYOUT_PADRAO,
  VIDA_UTIL_PADRAO_MESES,
} from '../leasing-buyout-analysis'
import type { BuyoutRow } from '../../../types/printableProposal'

// Parâmetros fixos do cenário de teste para gerarTabelaBuyout
const TEST_PRESTACAO_EFETIVA = 800       // Prestação mensal constante (R$)
const TEST_TARIFA_KWMH = 0.85           // Tarifa cheia (R$/kWh)
const TEST_VM0 = 100_000                 // Valor de mercado inicial da usina (R$)
const TEST_DEPREC_MENSAL = 1_200         // Redução mensal do valor residual pela depreciação (R$/mês)
const TEST_CASHBACK_RATE = 0.05          // Taxa de cashback sobre prestações acumuladas (5%)

// Gera uma tabela de buyout simplificada para os testes.
// Todos os meses de 1 até prazo têm valorResidual decrescente e prestacaoAcum crescente.
function gerarTabelaBuyout(prazo: number): BuyoutRow[] {
  const rows: BuyoutRow[] = []
  let prestAcum = 0

  for (let mes = 1; mes <= prazo; mes += 1) {
    prestAcum += TEST_PRESTACAO_EFETIVA
    rows.push({
      mes,
      tarifa: TEST_TARIFA_KWMH,
      prestacaoEfetiva: TEST_PRESTACAO_EFETIVA,
      prestacaoAcum: prestAcum,
      cashback: prestAcum * TEST_CASHBACK_RATE,
      valorResidual:
        mes >= 7
          ? Math.max(0, TEST_VM0 - mes * TEST_DEPREC_MENSAL - prestAcum * TEST_CASHBACK_RATE)
          : null,
    })
  }

  return rows
}

describe('calcularEconomiaFuturaBuyout', () => {
  it('retorna 0 para tarifa zero ou negativa', () => {
    expect(calcularEconomiaFuturaBuyout(12, 0, 600, 0.04)).toBe(0)
    expect(calcularEconomiaFuturaBuyout(12, -0.5, 600, 0.04)).toBe(0)
  })

  it('retorna 0 para geração zero', () => {
    expect(calcularEconomiaFuturaBuyout(12, 0.85, 0, 0.04)).toBe(0)
  })

  it('retorna 0 quando mesInicio >= vidaUtil', () => {
    expect(calcularEconomiaFuturaBuyout(300, 0.85, 600, 0.04, 300)).toBe(0)
    expect(calcularEconomiaFuturaBuyout(400, 0.85, 600, 0.04, 300)).toBe(0)
  })

  it('calcula corretamente com inflação zero (n parcelas iguais)', () => {
    const geracao = 600
    const tarifa = 1.0
    const mes = 0
    const vida = 12
    const economia = calcularEconomiaFuturaBuyout(mes, tarifa, geracao, 0, vida)
    // Sem inflação: 12 meses × 600 kWh × R$ 1,00 = R$ 7.200
    expect(economia).toBeCloseTo(geracao * tarifa * vida, 2)
  })

  it('aplica inflação anual de 4% corretamente (série geométrica)', () => {
    const geracao = 600
    const tarifa = 1.0
    const inflacao = 0.04
    const mes = 0
    const vida = 12 // 12 meses pós-buyout

    const economia = calcularEconomiaFuturaBuyout(mes, tarifa, geracao, inflacao, vida)
    // Verificação manual: Σ_{k=1}^{12} 600 × (1+inflacaoMensal)^k
    const im = Math.pow(1.04, 1 / 12) - 1
    let esperado = 0
    for (let k = 1; k <= 12; k += 1) {
      esperado += geracao * Math.pow(1 + im, k)
    }
    expect(economia).toBeCloseTo(esperado, 4)
  })

  it('retorna valor maior com inflação positiva do que com inflação zero', () => {
    const semInflacao = calcularEconomiaFuturaBuyout(12, 0.85, 600, 0, 300)
    const comInflacao = calcularEconomiaFuturaBuyout(12, 0.85, 600, 0.04, 300)
    expect(comInflacao).toBeGreaterThan(semInflacao)
  })

  it('economia futura é maior quando o buyout ocorre mais cedo (mais meses restantes)', () => {
    const inflacao = 0.04
    const tarifa = 0.85
    const geracao = 600
    const cedo = calcularEconomiaFuturaBuyout(7, tarifa, geracao, inflacao)
    const tarde = calcularEconomiaFuturaBuyout(36, tarifa, geracao, inflacao)
    expect(cedo).toBeGreaterThan(tarde)
  })
})

describe('analisarBuyout', () => {
  const tabelaBase = gerarTabelaBuyout(60)

  it('retorna melhorMes null quando não há dados suficientes', () => {
    const analise = analisarBuyout({ tabelaBuyout: [], geracaoKwhMes: 600, inflacaoAa: 0.04 })
    expect(analise.melhorMes).toBeNull()
    expect(analise.roiPorMes).toHaveLength(0)
  })

  it('retorna melhorMes null quando geracaoKwhMes é zero', () => {
    const analise = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 0, inflacaoAa: 0.04 })
    expect(analise.melhorMes).toBeNull()
  })

  it('encontra o melhor mês dentro do limite padrão (7–36)', () => {
    const analise = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.04 })
    expect(analise.melhorMes).not.toBeNull()
    expect(analise.melhorMes!).toBeGreaterThanOrEqual(7)
    expect(analise.melhorMes!).toBeLessThanOrEqual(LIMITE_MELHOR_MES_PADRAO)
  })

  it('respeita limiteMelhorMes personalizado', () => {
    const analise = analisarBuyout({
      tabelaBuyout: tabelaBase,
      geracaoKwhMes: 600,
      inflacaoAa: 0.04,
      limiteMelhorMes: 20,
    })
    if (analise.melhorMes !== null) {
      expect(analise.melhorMes).toBeLessThanOrEqual(20)
    }
  })

  it('gera tabela de ROI para os meses padrão disponíveis', () => {
    const analise = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.04 })
    const mesesPresentes = analise.roiPorMes.map((p) => p.mes)
    // Os meses disponíveis na tabela base (prazo=60) que estão em MESES_ROI_BUYOUT_PADRAO
    const mesesEsperados = MESES_ROI_BUYOUT_PADRAO.filter((m) => m <= 60 && m >= 7)
    for (const m of mesesEsperados) {
      expect(mesesPresentes).toContain(m)
    }
  })

  it('aceita mesesRoi personalizados', () => {
    const mesesCustom = [7, 12, 24] as const
    const analise = analisarBuyout({
      tabelaBuyout: tabelaBase,
      geracaoKwhMes: 600,
      inflacaoAa: 0.04,
      mesesRoi: mesesCustom,
    })
    const mesesPresentes = analise.roiPorMes.map((p) => p.mes)
    expect(mesesPresentes).toEqual(expect.arrayContaining([7, 12, 24]))
    expect(analise.roiPorMes.length).toBeLessThanOrEqual(mesesCustom.length)
  })

  it('totalInvestido = prestacaoAcum + valorResidual em cada ponto', () => {
    const analise = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.04 })
    for (const ponto of analise.roiPorMes) {
      expect(ponto.totalInvestido).toBeCloseTo(ponto.prestacaoAcum + ponto.valorResidual, 2)
    }
  })

  it('ROI é positivo para uma usina com boa geração e inflação de 4%', () => {
    const analise = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.04 })
    for (const ponto of analise.roiPorMes) {
      expect(ponto.roi).toBeGreaterThan(0)
    }
  })

  it('melhorMesRoi coincide com o ROI do melhorMes na tabela roiPorMes (se presente)', () => {
    const analise = analisarBuyout({
      tabelaBuyout: tabelaBase,
      geracaoKwhMes: 600,
      inflacaoAa: 0.04,
      mesesRoi: MESES_ROI_BUYOUT_PADRAO,
    })
    if (analise.melhorMes !== null) {
      const pontoMelhor = analise.roiPorMes.find((p) => p.mes === analise.melhorMes)
      if (pontoMelhor) {
        expect(pontoMelhor.roi).toBeCloseTo(analise.melhorMesRoi, 6)
      }
    }
  })

  it('inflação mais alta aumenta o ROI projetado', () => {
    const analise4 = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.04 })
    const analise8 = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.08 })
    // Com inflação maior, a economia futura cresce mais, portanto o ROI deve ser maior
    const ponto4 = analise4.roiPorMes[0]
    const ponto8 = analise8.roiPorMes[0]
    if (ponto4 && ponto8) {
      expect(ponto8.roi).toBeGreaterThan(ponto4.roi)
    }
  })

  it('preenche os campos melhorMesValorResidual e melhorMesTotalInvestido', () => {
    const analise = analisarBuyout({ tabelaBuyout: tabelaBase, geracaoKwhMes: 600, inflacaoAa: 0.04 })
    if (analise.melhorMes !== null) {
      expect(analise.melhorMesValorResidual).toBeGreaterThan(0)
      expect(analise.melhorMesTotalInvestido).toBeGreaterThan(analise.melhorMesValorResidual)
    }
  })

  it('omite meses onde valorResidual é null ou zero (antes do mês 7)', () => {
    const analise = analisarBuyout({
      tabelaBuyout: tabelaBase,
      geracaoKwhMes: 600,
      inflacaoAa: 0.04,
      mesesRoi: [1, 3, 6, 7, 13],
    })
    const mesesPresentes = analise.roiPorMes.map((p) => p.mes)
    // Meses 1, 3, 6 não têm valorResidual (null nos dados de teste), portanto devem ser omitidos
    expect(mesesPresentes).not.toContain(1)
    expect(mesesPresentes).not.toContain(3)
    expect(mesesPresentes).not.toContain(6)
    // Meses 7 e 13 devem estar presentes (têm valorResidual > 0 nos dados de teste)
    expect(mesesPresentes).toContain(7)
    expect(mesesPresentes).toContain(13)
  })

  it('constante VIDA_UTIL_PADRAO_MESES equivale a 25 anos', () => {
    expect(VIDA_UTIL_PADRAO_MESES).toBe(300)
  })

  it('constante MESES_ROI_BUYOUT_PADRAO cobre do 7º ao 45º mês em intervalos de 6', () => {
    expect(MESES_ROI_BUYOUT_PADRAO).toEqual([7, 13, 19, 25, 31, 37, 43, 45])
  })
})
