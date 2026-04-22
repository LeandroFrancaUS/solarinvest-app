// src/lib/services/__tests__/closeProposalPipeline.test.ts
import { describe, it, expect } from 'vitest'
import {
  validateProposalReadinessForClosing,
  closeProposalAndHydrateClientPortfolio,
  type ProposalClosingInput,
} from '../closeProposalPipeline'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A fully valid leasing proposal input */
function validLeasingInput(overrides: Partial<ProposalClosingInput> = {}): ProposalClosingInput {
  return {
    proposalId: 'test-proposal-id',
    clientId: 42,
    clienteDados: {
      nome: 'Maria Souza',
      documento: '529.982.247-25', // valid CPF
      email: 'maria@example.com',
      telefone: '11987654321',
      cep: '01001-000',
      cidade: 'São Paulo',
      uf: 'SP',
      endereco: 'Rua Teste, 1',
      distribuidora: 'Enel São Paulo',
      uc: '123456789012345', // 15 digits
      diaVencimento: '10',
    },
    snapshot: {
      activeTab: 'leasing',
      kcKwhMes: 800,
      prazoMeses: 240,
      tipoRede: 'trifasico',
      leasingSnapshot: {
        prazoContratualMeses: 240,
        valorDeMercadoEstimado: 45000,
        dadosTecnicos: {
          potenciaInstaladaKwp: 8.25,
          geracaoEstimadakWhMes: 930,
          potenciaPlacaWp: 550,
          numeroModulos: 15,
        },
      },
    },
    ucBeneficiarias: [],
    ...overrides,
  }
}

/** A fully valid venda proposal input */
function validVendaInput(overrides: Partial<ProposalClosingInput> = {}): ProposalClosingInput {
  return {
    proposalId: 'venda-proposal-id',
    clientId: 99,
    clienteDados: {
      nome: 'Carlos Lima',
      documento: '11.222.333/0001-81', // valid CNPJ
      email: 'carlos@empresa.com',
      telefone: '1134567890',
      cep: '04538-133',
      cidade: 'São Paulo',
      uf: 'SP',
      endereco: 'Av Paulista, 1000',
      distribuidora: 'Enel São Paulo',
      uc: '987654321098765',
    },
    snapshot: {
      activeTab: 'venda',
      kcKwhMes: 600,
      vendaSnapshot: {
        configuracao: {
          potencia_sistema_kwp: 6.6,
          geracao_estimada_kwh_mes: 750,
          potencia_modulo_wp: 550,
          n_modulos: 12,
        },
        composicao: { venda_total: 28000 },
        parametros: { consumo_kwh_mes: 600 },
      },
    },
    ucBeneficiarias: [],
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// validateProposalReadinessForClosing
// ═════════════════════════════════════════════════════════════════════════════

describe('validateProposalReadinessForClosing', () => {
  describe('valid complete leasing proposal', () => {
    it('returns ok=true when all required fields are valid', () => {
      const result = validateProposalReadinessForClosing(validLeasingInput())
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('may have warnings for computed fields — but ok is still true', () => {
      // Warnings do not block
      const result = validateProposalReadinessForClosing(validLeasingInput())
      expect(result.ok).toBe(true)
    })
  })

  describe('valid complete venda proposal', () => {
    it('returns ok=true for a complete venda proposal', () => {
      const result = validateProposalReadinessForClosing(validVendaInput())
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('blocks on missing/invalid required fields', () => {
    it('blocks when CEP is invalid', () => {
      const input = validLeasingInput()
      input.clienteDados.cep = '123'
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field === 'cep')).toBe(true)
    })

    it('blocks when CPF is invalid', () => {
      const input = validLeasingInput()
      input.clienteDados.documento = '111.111.111-11' // invalid CPF
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field === 'document')).toBe(true)
    })

    it('blocks when phone is invalid', () => {
      const input = validLeasingInput()
      input.clienteDados.telefone = '123'
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field === 'phone')).toBe(true)
    })

    it('blocks when email is invalid', () => {
      const input = validLeasingInput()
      input.clienteDados.email = 'not-an-email'
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field === 'email')).toBe(true)
    })

    it('blocks when UC geradora is missing', () => {
      const input = validLeasingInput()
      input.clienteDados.uc = ''
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field === 'ucGeradora')).toBe(true)
    })

    it('blocks when UC geradora has wrong digit count', () => {
      const input = validLeasingInput()
      input.clienteDados.uc = '12345' // less than 15 digits
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field === 'ucGeradora')).toBe(true)
    })

    it('blocks when UC beneficiária is invalid', () => {
      const input = validLeasingInput({ ucBeneficiarias: ['12345'] })
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(false)
      expect(result.errors.some((e) => e.field.startsWith('ucBeneficiaria'))).toBe(true)
    })
  })

  describe('warnings for missing computed/optional fields', () => {
    it('issues warning when distribuidora is empty', () => {
      const input = validLeasingInput()
      input.clienteDados.distribuidora = ''
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(true) // warning, not error
      expect(result.warnings.some((w) => w.field === 'distribuidora')).toBe(true)
    })

    it('issues warning when system_kwp is not calculated', () => {
      const input = validLeasingInput()
      input.snapshot.leasingSnapshot = {} // no dadosTecnicos
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(true)
      expect(result.warnings.some((w) => w.field === 'systemKwp')).toBe(true)
    })

    it('issues warning when geracao estimada is missing', () => {
      const input = validLeasingInput()
      if (input.snapshot.leasingSnapshot?.dadosTecnicos) {
        // Remove the field to simulate missing generation data
        delete (input.snapshot.leasingSnapshot.dadosTecnicos as Record<string, unknown>)['geracaoEstimadakWhMes']
      }
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(true)
      expect(result.warnings.some((w) => w.field === 'geracaoEstimadaKwh')).toBe(true)
    })

    it('issues warning when prazo is missing', () => {
      const input = validLeasingInput()
      input.snapshot.prazoMeses = 0
      if (input.snapshot.leasingSnapshot) {
        // Remove the field to simulate missing term data
        delete (input.snapshot.leasingSnapshot as Record<string, unknown>)['prazoContratualMeses']
      }
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(true)
      expect(result.warnings.some((w) => w.field === 'prazoMeses')).toBe(true)
    })

    it('all required registration fields valid → ok=true even with warnings', () => {
      const input = validLeasingInput()
      input.clienteDados.distribuidora = ''
      input.snapshot.prazoMeses = 0
      const result = validateProposalReadinessForClosing(input)
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// closeProposalAndHydrateClientPortfolio
// ═════════════════════════════════════════════════════════════════════════════

describe('closeProposalAndHydrateClientPortfolio', () => {
  it('returns ok=false and null payload when validation fails', () => {
    const input = validLeasingInput()
    input.clienteDados.cep = 'invalid'
    const result = closeProposalAndHydrateClientPortfolio(input)
    expect(result.ok).toBe(false)
    expect(result.payload).toBeNull()
    expect(result.readiness.ok).toBe(false)
  })

  it('returns ok=true and populated payload for complete leasing proposal', () => {
    const result = closeProposalAndHydrateClientPortfolio(validLeasingInput())
    expect(result.ok).toBe(true)
    expect(result.payload).not.toBeNull()
    expect(result.payload?.clients.client_name).toBe('Maria Souza')
    expect(result.payload?.clients.system_kwp).toBe(8.25)
    expect(result.payload?.usinaConfig.geracao_estimada_kwh).toBe(930)
    expect(result.payload?.contract.contract_type).toBe('leasing')
    expect(result.payload?.contract.contractual_term_months).toBe(240)
  })

  it('returns ok=true and populated payload for complete venda proposal', () => {
    const result = closeProposalAndHydrateClientPortfolio(validVendaInput())
    expect(result.ok).toBe(true)
    expect(result.payload?.contract.contract_type).toBe('sale')
    expect(result.payload?.clients.system_kwp).toBe(6.6)
    expect(result.payload?.usinaConfig.valordemercado).toBe(28000)
  })

  it('populates clients table fields from clienteDados', () => {
    const result = closeProposalAndHydrateClientPortfolio(validLeasingInput())
    const c = result.payload!.clients
    expect(c.distribuidora).toBe('Enel São Paulo')
    expect(c.uc).toBe('123456789012345')
    expect(c.client_cep).toBe('01001000')
  })

  it('imports uc_beneficiaria when provided by close pipeline source data', () => {
    const result = closeProposalAndHydrateClientPortfolio(validLeasingInput({
      ucBeneficiarias: ['678901234567890'],
    }))
    expect(result.payload?.clients.uc_beneficiaria).toBe('678901234567890')
  })

  it('produces diagnostic log entries', () => {
    const result = closeProposalAndHydrateClientPortfolio(validLeasingInput())
    expect(result.log.length).toBeGreaterThan(0)
    expect(result.log.some((l) => l.includes('hydration_complete'))).toBe(true)
  })

  it('log includes BLOCKED entry when validation fails', () => {
    const input = validLeasingInput()
    input.clienteDados.documento = '111.111.111-11'
    const result = closeProposalAndHydrateClientPortfolio(input)
    expect(result.ok).toBe(false)
    expect(result.log.some((l) => l.includes('BLOCKED'))).toBe(true)
  })
})
