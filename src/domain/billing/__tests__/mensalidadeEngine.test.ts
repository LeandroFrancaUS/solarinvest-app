// src/domain/billing/__tests__/mensalidadeEngine.test.ts
import { describe, expect, it } from 'vitest'
import {
  calculateMensalidade,
  calculateMensalidadeGoSolarInvest,
  calculateMensalidadePadrao,
} from '../mensalidadeEngine'

describe('calculateMensalidadePadrao', () => {
  it('M = min(C, Kc) × Tc when Tc is provided', () => {
    const out = calculateMensalidadePadrao({ C: 800, Kc: 1000, T: 1.0, Tc: 0.8 })
    expect(out.status).toBe('OK')
    expect(out.rule).toBe('PADRAO')
    expect(out.valor).toBeCloseTo(800 * 0.8, 6)
  })

  it('uses Kc when consumption exceeds it', () => {
    const out = calculateMensalidadePadrao({ C: 1500, Kc: 1000, T: 1.0, Tc: 0.8 })
    expect(out.valor).toBeCloseTo(1000 * 0.8, 6)
  })

  it('derives Tc from T × (1 − desconto) when Tc is missing (fraction)', () => {
    const out = calculateMensalidadePadrao({ C: 800, Kc: 1000, T: 1.0, desconto: 0.2 })
    expect(out.valor).toBeCloseTo(800 * 0.8, 6)
  })

  it('accepts desconto as a percentage (>1)', () => {
    const out = calculateMensalidadePadrao({ C: 800, Kc: 1000, T: 1.0, desconto: 20 })
    expect(out.valor).toBeCloseTo(800 * 0.8, 6)
  })

  it('returns DADOS_INSUFICIENTES when C is missing', () => {
    const out = calculateMensalidadePadrao({ C: null, Kc: 1000, T: 1.0 })
    expect(out.status).toBe('DADOS_INSUFICIENTES')
    expect(out.faltantes).toContain('C')
    expect(out.valor).toBeNull()
  })

  it('returns DADOS_INSUFICIENTES when Kc is missing', () => {
    const out = calculateMensalidadePadrao({ C: 800, Kc: null, T: 1.0 })
    expect(out.faltantes).toContain('Kc')
  })

  it('returns DADOS_INSUFICIENTES when no tariff is provided', () => {
    const out = calculateMensalidadePadrao({ C: 800, Kc: 1000, T: null })
    expect(out.faltantes).toContain('Tc/T')
  })
})

describe('calculateMensalidadeGoSolarInvest', () => {
  it('M = Kc × Tc + max(0; Kr − (Kc + C)) × T + E (excedente positivo)', () => {
    // Kc = 1000, Tc = 0.8, Kr = 2500, C = 1000, T = 1.0, E = 50
    // piso = 1000 × 0.8 = 800
    // excedente = max(0, 2500 - 2000) × 1.0 = 500
    // M = 800 + 500 + 50 = 1350
    const out = calculateMensalidadeGoSolarInvest({
      Kc: 1000,
      Tc: 0.8,
      Kr: 2500,
      C: 1000,
      T: 1.0,
      E: 50,
    })
    expect(out.status).toBe('OK')
    expect(out.rule).toBe('GO_SOLARINVEST')
    expect(out.valor).toBeCloseTo(1350, 6)
  })

  it('clamps the excedente to 0 when Kr ≤ Kc + C', () => {
    const out = calculateMensalidadeGoSolarInvest({
      Kc: 1000,
      Tc: 0.8,
      Kr: 500,
      C: 1000,
      T: 1.0,
    })
    // piso = 800; excedente = max(0, 500 - 2000) × 1 = 0; E = 0
    expect(out.valor).toBeCloseTo(800, 6)
  })

  it('treats E as zero when not provided', () => {
    const out = calculateMensalidadeGoSolarInvest({
      Kc: 1000,
      Tc: 0.8,
      Kr: 2500,
      C: 1000,
      T: 1.0,
    })
    expect(out.valor).toBeCloseTo(1300, 6)
  })

  it('derives Tc from T and desconto when Tc is missing', () => {
    const out = calculateMensalidadeGoSolarInvest({
      Kc: 1000,
      T: 1.0,
      desconto: 0.2,
      Kr: 2500,
      C: 1000,
    })
    // Tc = 0.8 → piso 800; excedente 500; M = 1300
    expect(out.valor).toBeCloseTo(1300, 6)
  })

  it('reports faltantes when Kc / T / Kr / C are missing', () => {
    const out = calculateMensalidadeGoSolarInvest({
      Kc: null,
      T: null,
      Kr: null,
      C: null,
    })
    expect(out.status).toBe('DADOS_INSUFICIENTES')
    expect(out.faltantes).toEqual(expect.arrayContaining(['Kc', 'T', 'C', 'Kr']))
  })
})

describe('calculateMensalidade dispatcher', () => {
  it('uses PADRAO when isContratanteTitular = true', () => {
    const out = calculateMensalidade(
      { C: 800, Kc: 1000, T: 1.0, Tc: 0.8, Kr: 2500, E: 50 },
      true,
    )
    expect(out.rule).toBe('PADRAO')
    expect(out.valor).toBeCloseTo(640, 6)
  })

  it('uses GO_SOLARINVEST when isContratanteTitular = false', () => {
    const out = calculateMensalidade(
      { C: 1000, Kc: 1000, T: 1.0, Tc: 0.8, Kr: 2500, E: 50 },
      false,
    )
    expect(out.rule).toBe('GO_SOLARINVEST')
    expect(out.valor).toBeCloseTo(1350, 6)
  })
})
