// server/adapters/__tests__/financeAdapter.spec.js
// Unit tests for server/adapters/financeAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import {
  fromEntryDb,
  toEntryDb,
  fromInvoiceDb,
  fromImportBatchDb,
  fromImportItemDb,
  toSoftDelete,
} from '../financeAdapter.js'

const ACTOR = { authProviderUserId: 'user-finance-test' }

// ─── fromEntryDb ──────────────────────────────────────────────────────────────

describe('FinanceAdapter.fromEntryDb', () => {
  const DB_ENTRY_ROW = {
    id:                   'entry-uuid-1',
    entry_type:           'income',
    scope_type:           'project',
    category:             'Mensalidade Leasing',
    subcategory:          null,
    description:          'Mensalidade de maio',
    amount:               1250.00,
    currency:             'BRL',
    competence_date:      '2024-05-01',
    payment_date:         '2024-05-05',
    status:               'received',
    is_recurring:         true,
    recurrence_frequency: 'monthly',
    project_kind:         'leasing',
    // ⚠️ client_id is UUID in financial_entries (schema mismatch vs clients.id BIGINT)
    client_id:            'client-uuid-not-bigint',
    project_id:           'project-uuid-1',
    proposal_id:          'proposal-uuid-1',
    consultant_id:        null,
    notes:                null,
    created_by_user_id:   'creator',
    updated_by_user_id:   'updater',
    created_at:           '2024-01-01T00:00:00Z',
    updated_at:           '2024-05-01T00:00:00Z',
    deleted_at:           null,
  }

  it('maps all columns correctly', () => {
    const model = fromEntryDb(DB_ENTRY_ROW)

    expect(model.id).toBe('entry-uuid-1')
    expect(model.entry_type).toBe('income')
    expect(model.scope_type).toBe('project')
    expect(model.amount).toBe(1250.00)
    expect(model.status).toBe('received')
    expect(model.is_recurring).toBe(true)
    expect(model.project_kind).toBe('leasing')
    expect(model.project_id).toBe('project-uuid-1')
  })

  it('surfaces client_id as a string (UUID vs BIGINT mismatch)', () => {
    const model = fromEntryDb(DB_ENTRY_ROW)
    // client_id in financial_entries is UUID — must be string, not number
    expect(typeof model.client_id).toBe('string')
    expect(model.client_id).toBe('client-uuid-not-bigint')
  })

  it('surfaces null client_id as null', () => {
    const row = { ...DB_ENTRY_ROW, client_id: null }
    const model = fromEntryDb(row)
    expect(model.client_id).toBeNull()
  })

  it('casts numeric client_id to string', () => {
    const row = { ...DB_ENTRY_ROW, client_id: 12345 }
    const model = fromEntryDb(row)
    expect(typeof model.client_id).toBe('string')
    expect(model.client_id).toBe('12345')
  })

  it('defaults amount to 0 when absent', () => {
    const model = fromEntryDb({ id: 'x' })
    expect(model.amount).toBe(0)
  })

  it('defaults status to planned when absent', () => {
    const model = fromEntryDb({ id: 'x' })
    expect(model.status).toBe('planned')
  })

  it('returns null for null input', () => {
    expect(fromEntryDb(null)).toBeNull()
  })
})

// ─── toEntryDb ────────────────────────────────────────────────────────────────

describe('FinanceAdapter.toEntryDb', () => {
  it('maps model fields to DB shape', () => {
    const model = {
      entry_type: 'expense',
      scope_type: 'project',
      category:   'Kit',
      amount:     8500,
      status:     'paid',
    }

    const db = toEntryDb(model, ACTOR)

    expect(db.entry_type).toBe('expense')
    expect(db.scope_type).toBe('project')
    expect(db.amount).toBe(8500)
    expect(db.updated_by_user_id).toBe('user-finance-test')
  })

  it('stamps created_by_user_id on insert', () => {
    const db = toEntryDb({ entry_type: 'income' }, ACTOR, 'insert')
    expect(db.created_by_user_id).toBe('user-finance-test')
  })

  it('does not stamp created_by_user_id on update', () => {
    const db = toEntryDb({ entry_type: 'income' }, ACTOR, 'update')
    expect(db.created_by_user_id).toBeUndefined()
  })

  it('throws on invalid entry_type', () => {
    expect(() => toEntryDb({ entry_type: 'transfer' }, ACTOR)).toThrow(TypeError)
    expect(() => toEntryDb({ entry_type: 'transfer' }, ACTOR)).toThrow(/entry_type/)
  })

  it('throws on invalid scope_type', () => {
    expect(() => toEntryDb({ entry_type: 'income', scope_type: 'personal' }, ACTOR)).toThrow(TypeError)
    expect(() => toEntryDb({ entry_type: 'income', scope_type: 'personal' }, ACTOR)).toThrow(/scope_type/)
  })

  it('throws on invalid status', () => {
    expect(() => toEntryDb({ status: 'invalid' }, ACTOR)).toThrow(TypeError)
    expect(() => toEntryDb({ status: 'invalid' }, ACTOR)).toThrow(/status/)
  })

  it('accepts all valid entry_type values', () => {
    expect(() => toEntryDb({ entry_type: 'income' }, ACTOR)).not.toThrow()
    expect(() => toEntryDb({ entry_type: 'expense' }, ACTOR)).not.toThrow()
  })

  it('throws when actor is missing', () => {
    expect(() => toEntryDb({}, null)).toThrow(TypeError)
  })
})

// ─── fromInvoiceDb ────────────────────────────────────────────────────────────

describe('FinanceAdapter.fromInvoiceDb', () => {
  it('maps all columns', () => {
    const row = {
      id:                          1,
      client_id:                   42,
      uc:                          'UC-99',
      invoice_number:              'INV-001',
      reference_month:             '2024-05-01',
      due_date:                    '2024-05-15',
      amount:                      350.00,
      payment_status:              'pendente',
      paid_at:                     null,
      payment_receipt_number:      null,
      payment_transaction_number:  null,
      payment_attachment_url:      null,
      confirmed_by_user_id:        null,
      notes:                       null,
      created_at:                  '2024-05-01T00:00:00Z',
      updated_at:                  '2024-05-01T00:00:00Z',
    }

    const model = fromInvoiceDb(row)

    expect(model.id).toBe(1)
    expect(model.client_id).toBe(42)
    expect(model.uc).toBe('UC-99')
    expect(model.amount).toBe(350.00)
    expect(model.payment_status).toBe('pendente')
  })

  it('defaults amount to 0 when absent', () => {
    const model = fromInvoiceDb({ id: 1 })
    expect(model.amount).toBe(0)
  })

  it('returns null for null input', () => {
    expect(fromInvoiceDb(null)).toBeNull()
  })
})

// ─── fromImportBatchDb ────────────────────────────────────────────────────────

describe('FinanceAdapter.fromImportBatchDb', () => {
  it('maps key batch fields', () => {
    const row = {
      id:                'batch-uuid',
      source_file_name:  'planilha.xlsx',
      status:            'completed',
      total_worksheets:  3,
      warnings_json:     [{ msg: 'warn1' }],
      summary_json:      { processed: 10 },
      created_by_user_id: 'importer',
    }

    const model = fromImportBatchDb(row)

    expect(model.id).toBe('batch-uuid')
    expect(model.source_file_name).toBe('planilha.xlsx')
    expect(model.status).toBe('completed')
    expect(model.total_worksheets).toBe(3)
    expect(model.warnings).toEqual([{ msg: 'warn1' }])
    expect(model.summary).toEqual({ processed: 10 })
  })

  it('returns null for null input', () => {
    expect(fromImportBatchDb(null)).toBeNull()
  })
})

// ─── fromImportItemDb ─────────────────────────────────────────────────────────

describe('FinanceAdapter.fromImportItemDb', () => {
  it('maps key item fields', () => {
    const row = {
      id:                   'item-uuid',
      batch_id:             'batch-uuid',
      source_sheet_name:    'Planilha1',
      worksheet_type:       'leasing_project',
      detected_client_name: 'João Alves',
      match_type:           'exact',
      match_confidence:     0.99,
      status:               'created',
      raw_json:             { raw: true },
      normalized_json:      { norm: true },
      warnings_json:        [],
      errors_json:          [],
    }

    const model = fromImportItemDb(row)

    expect(model.id).toBe('item-uuid')
    expect(model.batch_id).toBe('batch-uuid')
    expect(model.detected_client_name).toBe('João Alves')
    expect(model.match_type).toBe('exact')
    expect(model.match_confidence).toBe(0.99)
    expect(model.raw).toEqual({ raw: true })
    expect(model.normalized).toEqual({ norm: true })
  })

  it('returns null for null input', () => {
    expect(fromImportItemDb(null)).toBeNull()
  })
})

// ─── toSoftDelete ─────────────────────────────────────────────────────────────

describe('FinanceAdapter.toSoftDelete', () => {
  it('returns id, deleted_at, updated_by_user_id', () => {
    const before = new Date()
    const result = toSoftDelete('entry-uuid-1', ACTOR)
    const after  = new Date()

    expect(result.id).toBe('entry-uuid-1')
    expect(result.deleted_at).toBeInstanceOf(Date)
    expect(result.deleted_at.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(result.deleted_at.getTime()).toBeLessThanOrEqual(after.getTime())
    expect(result.updated_by_user_id).toBe('user-finance-test')
  })

  it('throws when id is missing', () => {
    expect(() => toSoftDelete(null, ACTOR)).toThrow(TypeError)
  })

  it('throws when actor is missing', () => {
    expect(() => toSoftDelete('id', null)).toThrow(TypeError)
  })
})
