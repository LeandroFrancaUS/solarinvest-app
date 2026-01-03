import { describe, expect, it } from 'vitest'
import { getAutoEligibility, normalizeInstallType, normalizeSystemType } from './autoEligibility'

describe('autoEligibility', () => {
  it('permite orçamento automático quando elegível', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('telhado'),
      systemType: normalizeSystemType('ongrid'),
      kwp: 50,
    })

    expect(eligibility).toEqual({ eligible: true })
  })

  it('bloqueia instalação em solo', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('solo'),
      systemType: normalizeSystemType('ongrid'),
      kwp: 50,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Orçamento automático disponível apenas para instalação em telhado.',
      reasonCode: 'INSTALL_NOT_ELIGIBLE',
    })
  })

  it('bloqueia instalação em outros formatos', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('outros'),
      systemType: normalizeSystemType('ongrid'),
      kwp: 50,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Orçamento automático disponível apenas para instalação em telhado.',
      reasonCode: 'INSTALL_NOT_ELIGIBLE',
    })
  })

  it('bloqueia sistemas híbridos', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('telhado'),
      systemType: normalizeSystemType('hibrido'),
      kwp: 50,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Orçamento automático disponível apenas para sistemas on-grid.',
      reasonCode: 'SYSTEM_NOT_ELIGIBLE',
    })
  })

  it('bloqueia sistemas off-grid', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('telhado'),
      systemType: normalizeSystemType('offgrid'),
      kwp: 50,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Orçamento automático disponível apenas para sistemas on-grid.',
      reasonCode: 'SYSTEM_NOT_ELIGIBLE',
    })
  })

  it('bloqueia kWp acima de 90', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('telhado'),
      systemType: normalizeSystemType('ongrid'),
      kwp: 90.01,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Para sistemas acima de 90 kWp, o orçamento é realizado de forma personalizada.',
      reasonCode: 'KWP_LIMIT',
    })
  })

  it('solicita seleção de instalação', () => {
    const eligibility = getAutoEligibility({
      installType: null,
      systemType: normalizeSystemType('ongrid'),
      kwp: 50,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Selecione o tipo de instalação e o tipo de sistema para continuar.',
      reasonCode: 'MISSING_SELECTION',
    })
  })

  it('solicita seleção de sistema', () => {
    const eligibility = getAutoEligibility({
      installType: normalizeInstallType('telhado'),
      systemType: null,
      kwp: 50,
    })

    expect(eligibility).toEqual({
      eligible: false,
      reason: 'Selecione o tipo de instalação e o tipo de sistema para continuar.',
      reasonCode: 'MISSING_SELECTION',
    })
  })
})
