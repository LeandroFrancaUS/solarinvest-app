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

  it('marca GO monofásico no limite como ok', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'MONOFASICO',
      potenciaInversorKw: 12,
    })

    expect(result?.status).toBe('OK')
    expect(result?.kwMaxPermitido).toBe(12)
    expect(result?.upgradeTo).toBe('BIFASICO')
  })

  it('marca GO monofásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'MONOFASICO',
      potenciaInversorKw: 12.1,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(12)
    expect(result?.upgradeTo).toBe('BIFASICO')
    expect(result?.kwMaxUpgrade).toBe(25)
  })

  it('marca GO bifásico dentro do limite como ok', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 16,
    })

    expect(result?.status).toBe('OK')
    expect(result?.kwMaxPermitido).toBe(25)
    expect(result?.upgradeTo).toBe('TRIFASICO')
  })

  it('marca GO bifásico no limite como ok', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 25,
    })

    expect(result?.status).toBe('OK')
    expect(result?.kwMaxPermitido).toBe(25)
  })

  it('marca GO bifásico acima do limite como fora da norma', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'BIFASICO',
      potenciaInversorKw: 25.1,
    })

    expect(result?.status).toBe('FORA_DA_NORMA')
    expect(result?.kwMaxPermitido).toBe(25)
    expect(result?.upgradeTo).toBe('TRIFASICO')
    expect(result?.kwMaxUpgrade).toBe(75)
  })

  it('marca GO trifásico no limite como ok', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'TRIFASICO',
      potenciaInversorKw: 75,
    })

    expect(result?.status).toBe('OK')
    expect(result?.kwMaxPermitido).toBe(75)
  })

  it('marca GO trifásico acima do limite como limitado', () => {
    const result = evaluateNormCompliance({
      uf: 'GO',
      tipoLigacao: 'TRIFASICO',
      potenciaInversorKw: 75.1,
    })

    expect(result?.status).toBe('LIMITADO')
    expect(result?.kwMaxPermitido).toBe(75)
    expect(result?.kwMaxUpgrade).toBeUndefined()
  })

  it('normaliza UF de GO sem retornar warning provisório', () => {
    const result = evaluateNormCompliance({
      uf: ' go ',
      tipoLigacao: 'MONOFASICO',
      potenciaInversorKw: 10,
    })

    expect(result?.status).toBe('OK')
    expect(result?.isProvisional).toBeUndefined()
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
