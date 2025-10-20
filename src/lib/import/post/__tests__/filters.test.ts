import { describe, expect, it } from 'vitest'

import { containsBudgetNoiseKeyword, sanitizeNoiseText } from '../noise_filters'
import { isValidProductText, isLikelyHeaderRow } from '../validators'
import { parseQuantityToken } from '../units'

describe('noise filters', () => {
  it('detecta palavras de contato e ignora ruídos', () => {
    expect(containsBudgetNoiseKeyword('Telefone: (62) 99999-9999')).toBe(true)
    expect(containsBudgetNoiseKeyword('Módulo solar bifacial')).toBe(false)
  })

  it('normaliza texto removendo bullets e espaços', () => {
    expect(sanitizeNoiseText('•  Inversor  \t trifásico')).toBe('Inversor trifásico')
  })
})

describe('validators', () => {
  it('reconhece linhas de cabeçalho', () => {
    expect(isLikelyHeaderRow(['Produto', 'Qtde'])).toBe(true)
    expect(isLikelyHeaderRow(['Item', 'Descrição'])).toBe(false)
  })

  it('valida nome de produto útil', () => {
    expect(isValidProductText('Inversor Solar 8kW')).toBe(true)
    expect(isValidProductText('Telefone')).toBe(false)
  })
})

describe('units', () => {
  it('interpreta tokens de quantidade e unidade', () => {
    expect(parseQuantityToken('Qtd: 12 un')).toEqual({ quantity: 12, unit: 'UN' })
    expect(parseQuantityToken('Observações')).toBeNull()
  })
})
