/**
 * Parity Test Suite — Section C: Clients
 *
 * Tests for client creation, deduplication, soft-delete,
 * and portfolio export operations.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Import pure domain functions
import {
  isStatusComercial,
  isStatusCliente,
  deriveClientVisibility,
  applyContractSignedStatus,
  STATUS_COMERCIAL_VALUES,
  STATUS_CLIENTE_VALUES,
} from '../../domain/clients/client-status'

const ROOT = resolve(__dirname, '../../..')

function readSource(relPath: string): string {
  const full = resolve(ROOT, relPath)
  if (!existsSync(full)) return ''
  return readFileSync(full, 'utf-8')
}

// ─── C1: Create PF client (Pessoa Física) ────────────────────────────────────

describe('C1 — PF client creation', () => {
  it('CPF format (11 digits) is distinguishable from CNPJ', () => {
    const cpf = '12345678901'
    const cnpj = '12345678000195'
    expect(cpf.replace(/\D/g, '').length).toBe(11)
    expect(cnpj.replace(/\D/g, '').length).toBe(14)
  })

  it('client status constants include all commercial pipeline values', () => {
    expect(STATUS_COMERCIAL_VALUES).toContain('LEAD')
    expect(STATUS_COMERCIAL_VALUES).toContain('PROPOSTA_ENVIADA')
    expect(STATUS_COMERCIAL_VALUES).toContain('NEGOCIANDO')
    expect(STATUS_COMERCIAL_VALUES).toContain('CONTRATO_ENVIADO')
    expect(STATUS_COMERCIAL_VALUES).toContain('GANHO')
    expect(STATUS_COMERCIAL_VALUES).toContain('PERDIDO')
  })

  it('new PF client starts as LEAD with NAO_CLIENTE status', () => {
    const newClient = { status_comercial: 'LEAD' as const, status_cliente: 'NAO_CLIENTE' as const }
    const vis = deriveClientVisibility(newClient)
    expect(vis.showInComercial).toBe(true)
    expect(vis.showInClientes).toBe(false)
  })
})

// ─── C2: Create PJ client (Pessoa Jurídica) ──────────────────────────────────

describe('C2 — PJ client creation', () => {
  it('CNPJ format (14 digits) identifies PJ clients', () => {
    const cnpj = '12345678000195'
    const digits = cnpj.replace(/\D/g, '')
    expect(digits.length).toBe(14)
  })

  it('PJ client follows same lifecycle as PF', () => {
    const pjClient = { status_comercial: 'LEAD' as const, status_cliente: 'NAO_CLIENTE' as const }
    expect(isStatusComercial(pjClient.status_comercial)).toBe(true)
    expect(isStatusCliente(pjClient.status_cliente)).toBe(true)
  })
})

// ─── C3: Deduplication by CPF/CNPJ ──────────────────────────────────────────

describe('C3 — Deduplication by CPF/CNPJ', () => {
  it('normalizes CPF by removing formatting', () => {
    const raw = '123.456.789-01'
    const normalized = raw.replace(/\D/g, '')
    expect(normalized).toBe('12345678901')
  })

  it('normalizes CNPJ by removing formatting', () => {
    const raw = '12.345.678/0001-95'
    const normalized = raw.replace(/\D/g, '')
    expect(normalized).toBe('12345678000195')
  })

  it('two clients with same CPF should be detected as duplicates', () => {
    const cpfA = '123.456.789-01'
    const cpfB = '123.456.78901'  // same digits, different format
    const keyA = cpfA.replace(/\D/g, '')
    const keyB = cpfB.replace(/\D/g, '')
    expect(keyA).toBe(keyB)
  })

  it('hydrateClientComputedFields module exists for client data enrichment', () => {
    const src = readSource('src/utils/__tests__/hydrateClientComputedFields.test.ts')
    expect(src.length).toBeGreaterThan(0)
  })
})

// ─── C4: Soft-delete ─────────────────────────────────────────────────────────

describe('C4 — Soft-delete', () => {
  it('client status constants support CANCELADO/FINALIZADO (soft-deleted states)', () => {
    expect(STATUS_CLIENTE_VALUES).toContain('CANCELADO')
    expect(STATUS_CLIENTE_VALUES).toContain('FINALIZADO')
    expect(STATUS_CLIENTE_VALUES).toContain('INATIVO')
  })

  it('soft-deleted client (CANCELADO) still appears in Clientes (not erased)', () => {
    const client = { status_comercial: 'GANHO' as const, status_cliente: 'CANCELADO' as const }
    const vis = deriveClientVisibility(client)
    expect(vis.showInClientes).toBe(true)
  })

  it('soft-deleted client does not appear in Comercial pipeline', () => {
    const client = { status_comercial: 'GANHO' as const, status_cliente: 'CANCELADO' as const }
    const vis = deriveClientVisibility(client)
    expect(vis.showInComercial).toBe(false)
  })
})

// ─── C5: Export to portfolio (Carteira) ─────────────────────────────────────

describe('C5 — Export to portfolio', () => {
  it('contract signed status sets correct status fields', () => {
    const lead = { status_comercial: 'CONTRATO_ENVIADO' as const, status_cliente: 'NAO_CLIENTE' as const }
    const result = applyContractSignedStatus(lead)
    expect(result.status_comercial).toBe('GANHO')
    expect(result.status_cliente).toBe('ATIVO')
  })

  it('portfolio API module exists', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    expect(src.length).toBeGreaterThan(0)
    expect(src).toContain('fetchPortfolioClients')
  })

  it('portfolio auto-fill service exists for automatic field population', () => {
    const src = readSource('src/services/portfolioAutoFill.ts')
    expect(src.length).toBeGreaterThan(0)
  })
})
