import { describe, expect, it } from 'vitest'
import { parseContractFromText } from '../parser'
import { buildImportEligibility } from '../validators'
import { compareImportedWithPlan } from '../planComparator'

const SAMPLE_TEXT = `
CONTRATANTE: KARLA DE LIMA PINHEIRO, brasileira, CPF sob o nº 723.162.921-00
residente e domiciliado(a) na Rua Central, 10, São Luís - MA Contato do CONTRATANTE
Email: karla@email.com
Telefone: (98) 99999-0000
Prazo contratual 0 meses.
vigência de 60 meses.
consumo estimado de 500 kWh por mês.
SLRINVST-LSE-42906319
Assinado eletronicamente por KARLA DE LIMA PINHEIRO Data: 13/04/2026 09:32 HASH SIGNATÁRIO CPF 723.162.921-00
Assinado eletronicamente por Nils Correa Pinheiro Data: 13/04/2026 11:52 HASH SIGNATÁRIO CPF 885.814.201-25
`

describe('contract import parser', () => {
  it('detecta contratante principal do corpo do contrato', () => {
    const parsed = parseContractFromText(SAMPLE_TEXT)
    expect(parsed.fields.contractorName).toBe('KARLA DE LIMA PINHEIRO')
    expect(parsed.fields.contractorDocument).toBe('723.162.921-00')
  })

  it('detecta assinatura digital do contratante principal', () => {
    const parsed = parseContractFromText(SAMPLE_TEXT)
    expect(parsed.contractorSignature?.signerName).toBe('KARLA DE LIMA PINHEIRO')
    expect(parsed.contractorSignature?.signedAt).toBe('2026-04-13T09:32:00-03:00')
  })

  it('bloqueia importação quando não há assinatura do contratante', () => {
    const parsed = parseContractFromText('CONTRATANTE: KARLA DE LIMA PINHEIRO, CPF 723.162.921-00')
    const eligibility = buildImportEligibility({
      isPdf: true,
      parsedText: 'ok',
      fields: parsed.fields,
      contractorSignature: parsed.contractorSignature,
      discrepancies: [],
      manualApprovalCodes: new Set(),
    })
    expect(eligibility.canImport).toBe(false)
  })

  it('gera divergência quando CPF/CNPJ do contrato difere do cadastro', () => {
    const parsed = parseContractFromText(SAMPLE_TEXT)
    const diffs = compareImportedWithPlan(parsed.fields, {
      document: '885.814.201-25',
      name: 'KARLA DE LIMA PINHEIRO',
      kwh_contratado: 500,
      kwh_mes_contratado: null,
      prazo_meses: 60,
      modalidade: 'leasing',
      uc: null,
      distribuidora: null,
    })
    expect(diffs.find((d) => d.code === 'CONTRACT_DOCUMENT_MISMATCH')).toBeTruthy()
  })

  it('identifica diferenças entre kwh/prazo do contrato e do plano', () => {
    const parsed = parseContractFromText(SAMPLE_TEXT)
    const diffs = compareImportedWithPlan(parsed.fields, {
      document: '723.162.921-00',
      name: 'KARLA DE LIMA PINHEIRO',
      kwh_contratado: 518,
      kwh_mes_contratado: null,
      prazo_meses: 48,
      modalidade: 'leasing',
      uc: null,
      distribuidora: null,
    })
    expect(diffs.some((d) => d.field === 'kwhContratado')).toBe(true)
    expect(diffs.some((d) => d.field === 'prazoContratual')).toBe(true)
  })

  it('usa a data da assinatura digital do contratante', () => {
    const parsed = parseContractFromText(SAMPLE_TEXT)
    expect(parsed.contractorSignature?.signedAt).toBe('2026-04-13T09:32:00-03:00')
  })
})
