import { describe, it, expect } from 'vitest'
import {
  estimateMonthlyGenerationKWh,
  estimateMonthlyKWh,
  reverseGenerationToKwp,
  kwpFromWpQty,
  normalizePerformanceRatio,
  DEFAULT_PERFORMANCE_RATIO,
} from '../generation'

describe('normalizePerformanceRatio', () => {
  it('retorna 0 para entradas inválidas', () => {
    expect(normalizePerformanceRatio(undefined)).toBe(0)
    expect(normalizePerformanceRatio(NaN)).toBe(0)
    expect(normalizePerformanceRatio(0)).toBe(0)
    expect(normalizePerformanceRatio(-1)).toBe(0)
  })

  it('converte percentuais (>= 1.5) para fração', () => {
    expect(normalizePerformanceRatio(80)).toBeCloseTo(0.80, 6)
    expect(normalizePerformanceRatio(75)).toBeCloseTo(0.75, 6)
    expect(normalizePerformanceRatio(100)).toBeCloseTo(1.0, 6)
  })

  it('retorna frações diretas (< 1.5) inalteradas', () => {
    expect(normalizePerformanceRatio(0.8)).toBeCloseTo(0.80, 6)
    expect(normalizePerformanceRatio(0.75)).toBeCloseTo(0.75, 6)
    expect(normalizePerformanceRatio(1.0)).toBeCloseTo(1.0, 6)
    expect(normalizePerformanceRatio(1.4)).toBeCloseTo(1.4, 6)
  })
})

describe('estimateMonthlyGenerationKWh', () => {
  it('retorna 0 para entradas inválidas', () => {
    expect(estimateMonthlyGenerationKWh({ potencia_instalada_kwp: 0 })).toBe(0)
    expect(estimateMonthlyGenerationKWh({ potencia_instalada_kwp: -1 })).toBe(0)
    expect(estimateMonthlyGenerationKWh({ potencia_instalada_kwp: NaN })).toBe(0)
  })

  it('calcula geração corretamente para sistema de 5 kWp', () => {
    // 5 kWp * 4.5 HSP * 30 dias * 0.8 PR = 540 kWh/mês
    const result = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: 5,
      irradiacao_kwh_m2_dia: 4.5,
      performance_ratio: 0.8,
      dias_mes: 30,
    })
    expect(result).toBeCloseTo(540, 0)
  })

  it('usa defaults quando parâmetros opcionais omitidos', () => {
    const result = estimateMonthlyGenerationKWh({ potencia_instalada_kwp: 5 })
    expect(result).toBeGreaterThan(0)
  })

  it('normaliza PR em percentual (ex.: 80 → 0.80)', () => {
    const withFraction = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: 5,
      irradiacao_kwh_m2_dia: 4.5,
      performance_ratio: 0.8,
      dias_mes: 30,
    })
    const withPercent = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: 5,
      irradiacao_kwh_m2_dia: 4.5,
      performance_ratio: 80,
      dias_mes: 30,
    })
    expect(withFraction).toBe(withPercent)
  })
})

describe('reverseGenerationToKwp', () => {
  it('retorna null para entradas inválidas', () => {
    expect(reverseGenerationToKwp(0)).toBeNull()
    expect(reverseGenerationToKwp(-100)).toBeNull()
    expect(reverseGenerationToKwp(NaN)).toBeNull()
  })

  it('é o inverso de estimateMonthlyGenerationKWh', () => {
    const kwpOriginal = 5
    const geracao = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: kwpOriginal,
      irradiacao_kwh_m2_dia: 4.5,
      performance_ratio: 0.8,
      dias_mes: 30,
    })
    const kwpRecuperado = reverseGenerationToKwp(geracao, {
      hsp: 4.5,
      pr: 0.8,
      dias_mes: 30,
    })
    expect(kwpRecuperado).toBeCloseTo(kwpOriginal, 2)
  })
})

describe('kwpFromWpQty', () => {
  it('retorna null para entradas inválidas', () => {
    expect(kwpFromWpQty(null, 10)).toBeNull()
    expect(kwpFromWpQty(545, null)).toBeNull()
    expect(kwpFromWpQty(0, 10)).toBeNull()
    expect(kwpFromWpQty(545, 0)).toBeNull()
  })

  it('calcula kWp corretamente', () => {
    // 16 módulos × 545 Wp = 8720 Wp = 8.72 kWp
    expect(kwpFromWpQty(545, 16)).toBeCloseTo(8.72, 4)
  })
})

describe('estimateMonthlyKWh (deprecated)', () => {
  it('produz o mesmo resultado que estimateMonthlyGenerationKWh para os mesmos parâmetros', () => {
    const viaLegacy = estimateMonthlyKWh(5, { hsp: 4.5, pr: 0.8 })
    const viaCanonica = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: 5,
      irradiacao_kwh_m2_dia: 4.5,
      performance_ratio: 0.8,
      dias_mes: 30,
    })
    expect(viaLegacy).toBe(viaCanonica)
  })

  it('DEFAULT_PERFORMANCE_RATIO é exportado corretamente', () => {
    expect(DEFAULT_PERFORMANCE_RATIO).toBe(0.8)
  })
})
