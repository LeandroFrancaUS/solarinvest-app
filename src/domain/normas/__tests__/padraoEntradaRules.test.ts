import { describe, expect, it } from 'vitest'
import { evaluateNormCompliance } from '../padraoEntradaRules'

describe('evaluateNormCompliance', () => {
  it('marca DF monofásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'DF',
      tipoLigacao: 'MONOFASICO',
      potenciaInversorKw: 15,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(10)
    expect(result?.upgradeTo).toBe('BIFASICO')
  })

  it('marca DF bifásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'DF',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 16,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(15)
    expect(result?.upgradeTo).toBe('TRIFASICO')
  })

  it('marca TO bifásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'TO',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 27,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(26.3)
    expect(result?.upgradeTo).toBe('TRIFASICO')
  })

  it('marca GO monofásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'MONOFASICO',
      potenciaInversorKw: 31,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(30)
    expect(result?.upgradeTo).toBe('BIFASICO')
  })

  it('marca GO bifásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 17,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(16)
    expect(result?.upgradeTo).toBe('TRIFASICO')
  })

  it('marca GO trifásico acima do limite como limitado', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'TRIFASICO',
      potenciaInversorKw: 76,
    })

    expect(result?.status).toBe('LIMITADO')
    expect(result?.kwMaxPermitido).toBe(75)
  })

  it('marca LIMITADO quando excede o upgrade máximo', () => {
    const result = evaluateNormCompliance({
      uf: 'DF',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 40,
    })

    expect(result?.status).toBe('LIMITADO')
    expect(result?.kwMaxUpgrade).toBe(30)
  })
})
