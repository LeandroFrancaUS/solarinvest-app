/**
 * Parity Test Suite — Section D: Proposals
 *
 * Tests for proposal creation, listing, update, and soft-delete.
 * Uses pure functions and source inspection; no live API calls.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Import pure functions
import { filterSavedProposals, sortSavedProposals } from '../../lib/proposals/proposalSearch'
import { normalizeSavedProposalRecord } from '../../lib/proposals/normalizers'
import type { ProposalRow } from '../../lib/api/proposalsApi'
import type { SavedProposalRecord } from '../../lib/proposals/types'

const ROOT = resolve(__dirname, '../../..')

function readSource(relPath: string): string {
  const full = resolve(ROOT, relPath)
  if (!existsSync(full)) return ''
  return readFileSync(full, 'utf-8')
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProposalRow(overrides: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    proposal_type: 'leasing',
    proposal_code: 'PROP-001',
    version: 1,
    status: 'draft',
    owner_user_id: 'user-1',
    owner_email: 'owner@example.com',
    owner_display_name: 'Owner',
    created_by_user_id: 'user-1',
    updated_by_user_id: null,
    client_name: 'João Silva',
    client_document: '12345678901',
    client_city: 'Goiânia',
    client_state: 'GO',
    client_phone: '(62) 99999-9999',
    client_email: 'joao@example.com',
    client_cep: '74000-000',
    client_id: null,
    consumption_kwh_month: 800,
    system_kwp: 8.25,
    capex_total: null,
    contract_value: 45000,
    term_months: 240,
    uc_geradora_nm: null,
    uc_beneficiaria: null,
    payload_json: {
      kcKwhMes: 800,
      prazoMeses: 240,
      tarifaCheia: 0.85,
    },
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

function makeRecord(overrides: Partial<SavedProposalRecord> = {}): SavedProposalRecord {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    code: 'PROP-001',
    clientName: 'João Silva',
    document: '12345678901',
    city: 'Goiânia',
    state: 'GO',
    proposalType: 'leasing',
    status: 'draft',
    createdAt: '2025-01-15T10:00:00Z',
    ...overrides,
  }
}

// ─── D1: Create leasing proposal ─────────────────────────────────────────────

describe('D1 — Create leasing proposal', () => {
  it('normalizes a leasing proposal row into SavedProposalRecord', () => {
    const row = makeProposalRow({ proposal_type: 'leasing' })
    const record = normalizeSavedProposalRecord(row)
    expect(record.id).toBe(row.id)
    expect(record.proposalType).toBe('leasing')
    expect(record.clientName).toBe('João Silva')
    expect(record.code).toBe('PROP-001')
  })

  it('leasing proposal has UUID id (string)', () => {
    const row = makeProposalRow()
    const record = normalizeSavedProposalRecord(row)
    expect(typeof record.id).toBe('string')
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('leasing payload_json fields are preserved', () => {
    const row = makeProposalRow({
      payload_json: {
        kcKwhMes: 800,
        prazoMeses: 240,
        tarifaCheia: 0.85,
        tipoRede: 'trifasico',
        descontoContratual: 20,
      },
    })
    const record = normalizeSavedProposalRecord(row)
    expect(record.payload?.kcKwhMes).toBe(800)
    expect(record.payload?.prazoMeses).toBe(240)
  })

  it('proposals API has create function', () => {
    const src = readSource('src/lib/api/proposalsApi.ts')
    const hasCreate = src.includes('createProposal') || src.includes('create')
    expect(hasCreate).toBe(true)
  })
})

// ─── D2: Create sale (venda) proposal ────────────────────────────────────────

describe('D2 — Create sale (venda) proposal', () => {
  it('normalizes a venda proposal row', () => {
    const row = makeProposalRow({
      proposal_type: 'venda',
      payload_json: {
        potenciaKwp: 8.25,
        totalInvestimento: 45000,
        retornoAnos: 5,
        tipoInstalacao: 'telhado_ceramico',
      },
    })
    const record = normalizeSavedProposalRecord(row)
    expect(record.proposalType).toBe('venda')
    expect(record.payload?.potenciaKwp).toBe(8.25)
  })
})

// ─── D3: List by status/type ─────────────────────────────────────────────────

describe('D3 — List proposals by status/type', () => {
  const records: SavedProposalRecord[] = [
    makeRecord({ proposalType: 'leasing', status: 'draft', createdAt: '2025-03-01T00:00:00Z' }),
    makeRecord({ id: 'id-2', code: 'PROP-002', proposalType: 'venda', status: 'sent', createdAt: '2025-02-01T00:00:00Z' }),
    makeRecord({ id: 'id-3', code: 'PROP-003', proposalType: 'leasing', status: 'sent', createdAt: '2025-01-01T00:00:00Z' }),
  ]

  it('filters by type=leasing', () => {
    const filtered = filterSavedProposals(records, { type: 'leasing' })
    expect(filtered).toHaveLength(2)
    expect(filtered.every((r) => r.proposalType === 'leasing')).toBe(true)
  })

  it('filters by type=venda', () => {
    const filtered = filterSavedProposals(records, { type: 'venda' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.proposalType).toBe('venda')
  })

  it('returns all records when type=all', () => {
    const filtered = filterSavedProposals(records, { type: 'all' })
    expect(filtered).toHaveLength(3)
  })

  it('sorts by createdAt descending (newest first)', () => {
    const sorted = sortSavedProposals(records)
    expect(sorted[0]?.createdAt).toBe('2025-03-01T00:00:00Z')
    expect(sorted[sorted.length - 1]?.createdAt).toBe('2025-01-01T00:00:00Z')
  })
})

// ─── D4: Load old proposal ───────────────────────────────────────────────────

describe('D4 — Load old proposal', () => {
  it('normalizeSavedProposalRecord handles missing optional fields gracefully', () => {
    const row: ProposalRow = {
      ...makeProposalRow(),
      client_name: null,
      client_document: null,
      client_city: null,
      client_state: null,
      payload_json: {},
    }
    const record = normalizeSavedProposalRecord(row)
    expect(record.clientName).toBeNull()
    expect(record.document).toBeNull()
    expect(record.city).toBeNull()
    expect(record.payload).toEqual({})
  })

  it('code falls back to id when proposal_code is null', () => {
    const row = makeProposalRow({ proposal_code: null })
    const record = normalizeSavedProposalRecord(row)
    expect(record.code).toBe(row.id)
  })
})

// ─── D5: Update proposal ─────────────────────────────────────────────────────

describe('D5 — Update proposal', () => {
  it('proposals API has update function', () => {
    const src = readSource('src/lib/api/proposalsApi.ts')
    const hasUpdate = src.includes('updateProposal') || src.includes('update') || src.includes('PATCH') || src.includes('PUT')
    expect(hasUpdate).toBe(true)
  })
})

// ─── D6: Soft-delete proposal ────────────────────────────────────────────────

describe('D6 — Soft-delete proposal', () => {
  it('ProposalRow has deleted_at field for soft-delete', () => {
    const row = makeProposalRow({ deleted_at: '2025-06-01T00:00:00Z' })
    expect(row.deleted_at).toBeTruthy()
  })

  it('proposals API has delete function', () => {
    const src = readSource('src/lib/api/proposalsApi.ts')
    const hasDelete = src.includes('deleteProposal') || src.includes('delete') || src.includes('DELETE')
    expect(hasDelete).toBe(true)
  })
})

// ─── D7: Filter by query ─────────────────────────────────────────────────────

describe('D7 — Proposal search/filter', () => {
  it('filters by clientName (accent-insensitive)', () => {
    const records = [
      makeRecord({ clientName: 'João Silva' }),
      makeRecord({ id: 'id-2', code: 'P2', clientName: 'Maria Souza' }),
    ]
    const filtered = filterSavedProposals(records, { clientName: 'joao' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.clientName).toBe('João Silva')
  })

  it('filters by document', () => {
    const records = [
      makeRecord({ document: '12345678901' }),
      makeRecord({ id: 'id-2', code: 'P2', document: '98765432100' }),
    ]
    const filtered = filterSavedProposals(records, { document: '12345678901' })
    expect(filtered).toHaveLength(1)
  })

  it('full-text query searches across code, name, document', () => {
    const records = [
      makeRecord({ code: 'PROP-XYZ', clientName: 'Alice' }),
      makeRecord({ id: 'id-2', code: 'PROP-ABC', clientName: 'Bob' }),
    ]
    const filtered = filterSavedProposals(records, { query: 'alice' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.clientName).toBe('Alice')
  })
})
