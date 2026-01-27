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

  it('retorna WARNING para GO com regra provisória', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 12,
    })

    expect(result?.status).toBe('WARNING')
    expect(result?.isProvisional).toBe(true)
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
