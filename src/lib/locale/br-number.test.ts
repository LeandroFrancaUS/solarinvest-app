import { describe, expect, it } from 'vitest'
import {
  formatMoneyBR,
  formatPercentBR,
  toNumberFlexible,
} from './br-number'

describe('br-number utilities', () => {
  it('toNumberFlexible parseia formatos BR e US', () => {
    expect(toNumberFlexible('1.234,56')).toBeCloseTo(1234.56)
    expect(toNumberFlexible('1234.56')).toBeCloseTo(1234.56)
    expect(toNumberFlexible('R$\u00a01.234,56')).toBeCloseTo(1234.56)
  })

  it('formatMoneyBR formata BRL', () => {
    expect(formatMoneyBR(1234.56)).toBe('R$\u00a01.234,56')
  })

  it('formatPercentBR usa vírgula', () => {
    const formatted = formatPercentBR(0.105)
    expect(formatted).toContain('10')
    expect(formatted).toContain(',')
  })
})
