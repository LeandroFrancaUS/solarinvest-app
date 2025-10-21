import { describe, expect, it } from 'vitest'

import { anosAlvoEconomia } from '../years'

describe('anosAlvoEconomia', () => {
  it('60 meses → [5,6,10,15,20,30]', () => {
    expect(anosAlvoEconomia(60)).toEqual([5, 6, 10, 15, 20, 30])
  })

  it('84 meses → [7,8,10,15,20,30]', () => {
    expect(anosAlvoEconomia(84)).toEqual([7, 8, 10, 15, 20, 30])
  })

  it('120 meses → [10,11,15,20,30]', () => {
    expect(anosAlvoEconomia(120)).toEqual([10, 11, 15, 20, 30])
  })

  it('dedup e ordena: 120 meses já inclui 10', () => {
    expect(anosAlvoEconomia(120)).toEqual([10, 11, 15, 20, 30])
  })
})
