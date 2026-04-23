import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALIQUOTA_LEASING,
  DEFAULT_ALIQUOTA_VENDA,
  computeTaxes,
} from '../taxation'

// ─── Venda ───────────────────────────────────────────────────────────────────

describe('computeTaxes — venda', () => {
  it('exclui custo do kit e frete da base tributável', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 50000,
      custoKit: 20000,
      frete: 1000,
      aliquota: 0.06,
    })
    // base = 50000 - 20000 - 1000 = 29000
    expect(result.baseTributavel).toBeCloseTo(29000, 6)
    expect(result.aliquotaAplicada).toBe(0.06)
    expect(result.valorImposto).toBeCloseTo(29000 * 0.06, 6)
  })

  it('aplica default 6% quando aliquota não informada', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 40000,
      custoKit: 20000,
      frete: 500,
    })
    expect(result.aliquotaAplicada).toBe(DEFAULT_ALIQUOTA_VENDA)
    expect(result.aliquotaAplicada).toBe(0.06)
    expect(result.baseTributavel).toBeCloseTo(19500, 6)
    expect(result.valorImposto).toBeCloseTo(19500 * 0.06, 6)
  })

  it('aplica alíquota informada pelo usuário (override manual)', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 40000,
      custoKit: 10000,
      frete: 0,
      aliquota: 0.09,
    })
    expect(result.aliquotaAplicada).toBe(0.09)
    expect(result.baseTributavel).toBe(30000)
    expect(result.valorImposto).toBeCloseTo(30000 * 0.09, 6)
  })

  it('nunca permite base tributável negativa', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 10000,
      custoKit: 15000, // kit > total
      frete: 500,
      aliquota: 0.06,
    })
    expect(result.baseTributavel).toBe(0)
    expect(result.valorImposto).toBe(0)
  })

  it('normaliza custoKit null para 0', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 40000,
      custoKit: null,
      frete: null,
      aliquota: 0.06,
    })
    expect(result.baseTributavel).toBe(40000)
    expect(result.valorImposto).toBeCloseTo(40000 * 0.06, 6)
  })

  it('normaliza custoKit undefined para 0', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 30000,
      aliquota: 0.06,
    })
    expect(result.baseTributavel).toBe(30000)
    expect(result.valorImposto).toBeCloseTo(30000 * 0.06, 6)
  })

  it('aplica default quando aliquota é null', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 40000,
      custoKit: 20000,
      frete: 500,
      aliquota: null,
    })
    expect(result.aliquotaAplicada).toBe(DEFAULT_ALIQUOTA_VENDA)
  })

  it('totalAntesImposto = 0 resulta em base e imposto 0', () => {
    const result = computeTaxes({
      modo: 'venda',
      totalAntesImposto: 0,
      custoKit: 0,
      frete: 0,
      aliquota: 0.06,
    })
    expect(result.baseTributavel).toBe(0)
    expect(result.valorImposto).toBe(0)
  })
})

// ─── Leasing ─────────────────────────────────────────────────────────────────

describe('computeTaxes — leasing', () => {
  it('imposto incide somente sobre a mensalidade', () => {
    const result = computeTaxes({
      modo: 'leasing',
      mensalidade: 2000,
      aliquota: 0.04,
    })
    expect(result.baseTributavel).toBe(2000)
    expect(result.aliquotaAplicada).toBe(0.04)
    expect(result.valorImposto).toBeCloseTo(2000 * 0.04, 6)
  })

  it('aplica default 4% quando aliquota não informada', () => {
    const result = computeTaxes({
      modo: 'leasing',
      mensalidade: 1500,
    })
    expect(result.aliquotaAplicada).toBe(DEFAULT_ALIQUOTA_LEASING)
    expect(result.aliquotaAplicada).toBe(0.04)
    expect(result.valorImposto).toBeCloseTo(1500 * 0.04, 6)
  })

  it('aplica alíquota informada pelo usuário (override manual)', () => {
    const result = computeTaxes({
      modo: 'leasing',
      mensalidade: 1500,
      aliquota: 0.08,
    })
    expect(result.aliquotaAplicada).toBe(0.08)
    expect(result.valorImposto).toBeCloseTo(1500 * 0.08, 6)
  })

  it('mensalidade 0 resulta em imposto 0', () => {
    const result = computeTaxes({
      modo: 'leasing',
      mensalidade: 0,
      aliquota: 0.04,
    })
    expect(result.baseTributavel).toBe(0)
    expect(result.valorImposto).toBe(0)
  })

  it('aplica default quando aliquota é null', () => {
    const result = computeTaxes({
      modo: 'leasing',
      mensalidade: 1200,
      aliquota: null,
    })
    expect(result.aliquotaAplicada).toBe(DEFAULT_ALIQUOTA_LEASING)
  })

  it('não aplica sobre CAPEX, frete, kit ou serviços — apenas mensalidade é a base', () => {
    // Mesmo que haja outros custos no contexto, computeTaxes só vê a mensalidade
    const result = computeTaxes({
      modo: 'leasing',
      mensalidade: 1800,
      aliquota: 0.04,
    })
    // base = mensalidade apenas
    expect(result.baseTributavel).toBe(1800)
    expect(result.valorImposto).toBeCloseTo(1800 * 0.04, 6)
  })
})

// ─── Defaults ────────────────────────────────────────────────────────────────

describe('defaults exportados', () => {
  it('DEFAULT_ALIQUOTA_VENDA = 0.06', () => {
    expect(DEFAULT_ALIQUOTA_VENDA).toBe(0.06)
  })

  it('DEFAULT_ALIQUOTA_LEASING = 0.04', () => {
    expect(DEFAULT_ALIQUOTA_LEASING).toBe(0.04)
  })
})
