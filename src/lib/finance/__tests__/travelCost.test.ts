import { describe, it, expect } from 'vitest'
import {
  isExemptRegion,
  calculateInstallerTravelCost,
  DEFAULT_EXEMPT_REGIONS,
  DEFAULT_TRAVEL_COST_CONFIG,
} from '../travelCost'

// ─── isExemptRegion ───────────────────────────────────────────────────────────

describe('isExemptRegion', () => {
  it('returns true for Anápolis/GO', () => {
    expect(isExemptRegion('Anápolis', 'GO', DEFAULT_EXEMPT_REGIONS)).toBe(true)
  })

  it('returns true for Abadiânia/GO', () => {
    expect(isExemptRegion('Abadiânia', 'GO', DEFAULT_EXEMPT_REGIONS)).toBe(true)
  })

  it('returns true for Terezópolis de Goiás/GO', () => {
    expect(isExemptRegion('Terezópolis de Goiás', 'GO', DEFAULT_EXEMPT_REGIONS)).toBe(true)
  })

  it('returns true for Goiânia/GO', () => {
    expect(isExemptRegion('Goiânia', 'GO', DEFAULT_EXEMPT_REGIONS)).toBe(true)
  })

  it('is case-insensitive for city and UF', () => {
    expect(isExemptRegion('ANÁPOLIS', 'go', DEFAULT_EXEMPT_REGIONS)).toBe(true)
    expect(isExemptRegion('anápolis', 'GO', DEFAULT_EXEMPT_REGIONS)).toBe(true)
    expect(isExemptRegion('goiânia', 'go', DEFAULT_EXEMPT_REGIONS)).toBe(true)
  })

  it('returns false for non-exempt city', () => {
    expect(isExemptRegion('Brasília', 'DF', DEFAULT_EXEMPT_REGIONS)).toBe(false)
  })

  it('returns false for exempt city name but wrong UF', () => {
    expect(isExemptRegion('Anápolis', 'DF', DEFAULT_EXEMPT_REGIONS)).toBe(false)
  })

  it('returns false for unknown city', () => {
    expect(isExemptRegion('Caldas Novas', 'GO', DEFAULT_EXEMPT_REGIONS)).toBe(false)
  })

  it('returns false when exemptRegions list is empty', () => {
    expect(isExemptRegion('Anápolis', 'GO', [])).toBe(false)
  })
})

// ─── calculateInstallerTravelCost ─────────────────────────────────────────────

describe('calculateInstallerTravelCost', () => {
  it('returns 0 for km = 0 (exempt handled by caller)', () => {
    expect(calculateInstallerTravelCost(0, DEFAULT_TRAVEL_COST_CONFIG)).toBe(0)
  })

  it('returns 0 for negative km', () => {
    expect(calculateInstallerTravelCost(-10, DEFAULT_TRAVEL_COST_CONFIG)).toBe(0)
  })

  it('returns 150 for km 180 (faixa 1)', () => {
    expect(calculateInstallerTravelCost(180, DEFAULT_TRAVEL_COST_CONFIG)).toBe(150)
  })

  it('returns 150 for km exactly 200 (faixa 1 upper boundary)', () => {
    expect(calculateInstallerTravelCost(200, DEFAULT_TRAVEL_COST_CONFIG)).toBe(150)
  })

  it('returns 250 for km 201 (faixa 2 starts)', () => {
    expect(calculateInstallerTravelCost(201, DEFAULT_TRAVEL_COST_CONFIG)).toBe(250)
  })

  it('returns 250 for km 250 (faixa 2)', () => {
    expect(calculateInstallerTravelCost(250, DEFAULT_TRAVEL_COST_CONFIG)).toBe(250)
  })

  it('returns 250 for km exactly 320 (faixa 2 upper boundary)', () => {
    expect(calculateInstallerTravelCost(320, DEFAULT_TRAVEL_COST_CONFIG)).toBe(250)
  })

  it('returns 314 for km 400 (excedente: 250 + (400-320)*0.80)', () => {
    expect(calculateInstallerTravelCost(400, DEFAULT_TRAVEL_COST_CONFIG)).toBe(314)
  })

  it('returns 794 for km 1000 (250 + (1000-320)*0.80)', () => {
    expect(calculateInstallerTravelCost(1000, DEFAULT_TRAVEL_COST_CONFIG)).toBe(794)
  })

  it('handles custom config', () => {
    const config = {
      exemptRegions: [],
      faixa1MaxKm: 100,
      faixa1Rs: 100,
      faixa2MaxKm: 200,
      faixa2Rs: 200,
      kmExcedenteRs: 1.0,
    }
    expect(calculateInstallerTravelCost(50, config)).toBe(100)
    expect(calculateInstallerTravelCost(150, config)).toBe(200)
    expect(calculateInstallerTravelCost(300, config)).toBe(300) // 200 + (300-200)*1.0
  })
})
