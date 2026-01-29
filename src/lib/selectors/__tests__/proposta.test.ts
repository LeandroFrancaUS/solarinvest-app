import { describe, expect, it } from 'vitest'

import { getPotenciaModuloW, type PropostaState } from '../proposta'

describe('getPotenciaModuloW', () => {
  it('retorna 0 quando o valor não está disponível', () => {
    const state: PropostaState = {}
    expect(getPotenciaModuloW(state)).toBe(0)
  })

  it('retorna valor numérico quando presente', () => {
    const state: PropostaState = {
      orcamento: { modulo: { potenciaW: 610 } },
    }
    expect(getPotenciaModuloW(state)).toBe(610)
  })

  it('normaliza entradas não numéricas', () => {
    const state: PropostaState = {
      orcamento: { modulo: { potenciaW: '550' } },
    }
    expect(getPotenciaModuloW(state)).toBe(550)
  })
})
