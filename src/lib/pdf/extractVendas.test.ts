import { describe, expect, it } from 'vitest'

import { maybeFillQuantidadeModulos, mergeParsedVendaPdfData, RE_POT_KWP } from './extractVendas'
import { toNumberFlexible } from '../locale/br-number'

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

  it('RE_POT_KWP captura decimais preservando separador', () => {
    const texto = 'Potência do sistema 4.88kWp'
    const match = texto.match(RE_POT_KWP)
    expect(match?.[1]).toBe('4.88')
    expect(toNumberFlexible(match?.[1])).toBeCloseTo(4.88, 6)
  })
})

describe('mergeParsedVendaPdfData', () => {
  it('prioriza quantidade extraída do PDF quando presente', () => {
    const merged = mergeParsedVendaPdfData(
      {
        quantidade_modulos: 12,
        geracao_estimada_source: 'extracted',
      },
      {
        quantidade_modulos: null,
        potencia_instalada_kwp: 6.6,
        potencia_da_placa_wp: 550,
        geracao_estimada_source: 'calculated',
      },
    )

    expect(merged.quantidade_modulos).toBe(12)
    expect(merged.geracao_estimada_source).toBe('extracted')
  })
})
