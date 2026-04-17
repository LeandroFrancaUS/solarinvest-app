// src/utils/__tests__/contractReadiness.spec.ts
import { describe, it, expect } from 'vitest'
import {
  evaluateContractGenerationReadiness,
  type ContractReadinessInput,
} from '../contractReadiness'

// Helper to build a valid client data object for tests
function validClientData() {
  return {
    nome: 'João da Silva',
    documento: '123.456.789-09',
    cep: '01001-000',
    endereco: 'Rua Augusta, 100',
    cidade: 'São Paulo',
    uf: 'SP',
    uc: '0012345678',
    distribuidora: 'ENEL SP',
  }
}

describe('evaluateContractGenerationReadiness', () => {
  // ─── Scenario A: client NOT in portfolio, contract should still generate ───
  describe('client outside portfolio — pending-link mode', () => {
    it('allows generation when all minimum data is present', () => {
      const input: ContractReadinessInput = {
        clientData: validClientData(),
        clientId: null,
        inPortfolio: false,
      }
      const result = evaluateContractGenerationReadiness(input)
      expect(result.canGenerate).toBe(true)
      expect(result.canLinkNow).toBe(false)
      expect(result.willUsePendingMode).toBe(true)
      expect(result.missingFields).toEqual([])
      expect(result.reason).toBeNull()
    })

    it('allows generation with clienteEmEdicaoId but no stable client_id', () => {
      const input: ContractReadinessInput = {
        clientData: validClientData(),
        clientId: null,
        inPortfolio: false,
        isConflicted: false,
      }
      const result = evaluateContractGenerationReadiness(input)
      expect(result.canGenerate).toBe(true)
      expect(result.willUsePendingMode).toBe(true)
    })
  })

  // ─── Scenario B: client IN portfolio — direct link ───────────────────────
  describe('client in portfolio — direct link', () => {
    it('allows generation and direct linking when client is in portfolio', () => {
      const input: ContractReadinessInput = {
        clientData: validClientData(),
        clientId: 'server-id-415',
        inPortfolio: true,
      }
      const result = evaluateContractGenerationReadiness(input)
      expect(result.canGenerate).toBe(true)
      expect(result.canLinkNow).toBe(true)
      expect(result.willUsePendingMode).toBe(false)
      expect(result.missingFields).toEqual([])
    })
  })

  // ─── Scenario E: document conflict ───────────────────────────────────────
  describe('conflicted proposal', () => {
    it('allows generation even when proposal is conflicted', () => {
      const input: ContractReadinessInput = {
        clientData: validClientData(),
        clientId: null,
        inPortfolio: false,
        isConflicted: true,
        conflictReason: 'multiple_active_clients_same_document',
      }
      const result = evaluateContractGenerationReadiness(input)
      expect(result.canGenerate).toBe(true)
      expect(result.willUsePendingMode).toBe(true)
    })
  })

  // ─── Scenario F: missing required fields ─────────────────────────────────
  describe('missing required data — blocks generation', () => {
    it('blocks when nome is missing', () => {
      const data = validClientData()
      data.nome = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('nome ou razão social')
    })

    it('blocks when documento is missing', () => {
      const data = validClientData()
      data.documento = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('CPF ou CNPJ completo')
    })

    it('blocks when CPF is incomplete', () => {
      const data = validClientData()
      data.documento = '123.456' // too short
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('CPF ou CNPJ completo')
    })

    it('blocks when CEP is wrong length', () => {
      const data = validClientData()
      data.cep = '0100' // too short
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('CEP com 8 dígitos')
    })

    it('blocks when endereco is missing', () => {
      const data = validClientData()
      data.endereco = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('endereço de instalação')
    })

    it('blocks when cidade is missing', () => {
      const data = validClientData()
      data.cidade = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('cidade')
    })

    it('blocks when uf is missing', () => {
      const data = validClientData()
      data.uf = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('estado (UF)')
    })

    it('blocks when distribuidora is missing', () => {
      const data = validClientData()
      data.distribuidora = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('distribuidora (ANEEL)')
    })

    it('blocks when UC is missing', () => {
      const data = validClientData()
      data.uc = ''
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields).toContain('código da unidade consumidora (UC)')
    })

    it('reports all missing fields at once', () => {
      const result = evaluateContractGenerationReadiness({
        clientData: {},
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(false)
      expect(result.missingFields.length).toBeGreaterThanOrEqual(8)
      expect(result.reason).toBeTruthy()
    })
  })

  // ─── Scenario: CNPJ format ──────────────────────────────────────────────
  describe('CNPJ documents', () => {
    it('accepts 14-digit CNPJ', () => {
      const data = validClientData()
      data.documento = '12.345.678/0001-90'
      const result = evaluateContractGenerationReadiness({
        clientData: data,
        clientId: null,
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(true)
    })
  })

  // ─── canLinkNow requires BOTH clientId AND inPortfolio ──────────────────
  describe('canLinkNow edge cases', () => {
    it('clientId present but not in portfolio → pending mode', () => {
      const result = evaluateContractGenerationReadiness({
        clientData: validClientData(),
        clientId: 'server-id-415',
        inPortfolio: false,
      })
      expect(result.canGenerate).toBe(true)
      expect(result.canLinkNow).toBe(false)
      expect(result.willUsePendingMode).toBe(true)
    })

    it('in portfolio but no clientId → pending mode', () => {
      const result = evaluateContractGenerationReadiness({
        clientData: validClientData(),
        clientId: null,
        inPortfolio: true,
      })
      expect(result.canGenerate).toBe(true)
      expect(result.canLinkNow).toBe(false)
      expect(result.willUsePendingMode).toBe(true)
    })
  })
})
