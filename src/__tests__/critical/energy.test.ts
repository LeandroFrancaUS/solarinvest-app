import { describe, expect, it } from 'vitest'

import { estimateMonthlyGenerationKWh, kwpFromWpQty } from '../../lib/energy/generation'

describe('energy calculations', () => {
  it('kwpFromWpQty retorna null para entradas inválidas', () => {
    expect(kwpFromWpQty(null, 10)).toBeNull()
    expect(kwpFromWpQty(550, null)).toBeNull()
    expect(kwpFromWpQty(0, 10)).toBeNull()
  })

  it('kwpFromWpQty converte Wp e quantidade para kWp com segurança', () => {
    expect(kwpFromWpQty(550, 10)).toBeCloseTo(5.5, 6)
  })

  it('estimateMonthlyGenerationKWh zera quando parâmetros essenciais faltam', () => {
    expect(
      estimateMonthlyGenerationKWh({
        potencia_instalada_kwp: 0,
      }),
    ).toBe(0)
    expect(
      estimateMonthlyGenerationKWh({
        potencia_instalada_kwp: 5,
        irradiacao_kwh_m2_dia: 0,
      }),
    ).toBe(0)
  })

  it('estimateMonthlyGenerationKWh calcula produção com arredondamento seguro', () => {
    const resultado = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: 5,
      irradiacao_kwh_m2_dia: 5.2,
      performance_ratio: 0.78,
      dias_mes: 30,
    })
    expect(resultado).toBeGreaterThan(0)
    expect(resultado).toBe(Math.round(resultado))
  })
})
