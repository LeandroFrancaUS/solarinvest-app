import { describe, expect, it } from 'vitest'

import { maybeFillQuantidadeModulos } from './extractVendas'

describe('maybeFillQuantidadeModulos', () => {
  it('não recalcula quantidade quando PDF trouxe valor explícito', () => {
    const resolved = maybeFillQuantidadeModulos({
      quantidade_modulos: 8,
      potencia_instalada_kwp: 4.88,
      potencia_da_placa_wp: 610,
    })
    expect(resolved).toBe(8)
  })

  it('estima quantidade quando faltante e dados de potência estão disponíveis', () => {
    const resolved = maybeFillQuantidadeModulos({
      quantidade_modulos: null,
      potencia_instalada_kwp: 6.1,
      potencia_da_placa_wp: 610,
    })
    expect(resolved).toBe(10)
  })

  it('retorna null quando faltam dados suficientes', () => {
    expect(
      maybeFillQuantidadeModulos({
        quantidade_modulos: null,
        potencia_instalada_kwp: null,
        potencia_da_placa_wp: 550,
      }),
    ).toBeNull()
  })
})
