import { describe, expect, it } from 'vitest'

import { toNumberFlexible } from '../../lib/locale/br-number'

describe('toNumberFlexible', () => {
  it('normaliza vírgula decimal e ponto decimal', () => {
    expect(toNumberFlexible('4,88')).toBeCloseTo(4.88, 6)
    expect(toNumberFlexible('4.88')).toBeCloseTo(4.88, 6)
  })

  it('remove separadores de milhar antes de converter', () => {
    expect(toNumberFlexible('1.234,56')).toBeCloseTo(1234.56, 6)
    expect(toNumberFlexible('1\u00A0234,56')).toBeCloseTo(1234.56, 6)
  })

  it('preserva negativos válidos e rejeita entradas inválidas', () => {
    expect(toNumberFlexible('-12,3')).toBeCloseTo(-12.3, 6)
    expect(toNumberFlexible('texto')).toBeNull()
    expect(toNumberFlexible(undefined)).toBeNull()
  })
})
