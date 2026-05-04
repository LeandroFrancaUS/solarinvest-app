// server/__tests__/proposals-handler.spec.js
// Integration tests for the proposals HTTP handler verifying that the
// proposalAdapter is applied at API boundaries:
//   • incoming request body  → normalised canonical write payload
//   • DB row                 → canonical API response shape
//
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock all external modules before importing the handler ───────────────────

vi.mock('../database/neonClient.js')
vi.mock('../database/withRLSContext.js')
vi.mock('../database/connection.js')
vi.mock('../proposals/repository.js')
vi.mock('../proposals/permissions.js')

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { getCanonicalDatabaseDiagnostics } from '../database/connection.js'
import {
  createProposal,
  getProposalById,
  listProposals,
  updateProposal,
  softDeleteProposal,
  appendAuditLog,
} from '../proposals/repository.js'
import {
  resolveActor,
  actorRole,
  requireProposalAuth,
  canReadProposal,
  canWriteProposals,
  canModifyProposal,
  canDeleteProposal,
} from '../proposals/permissions.js'

import {
  handleProposalsRequest,
  handleProposalByIdRequest,
} from '../proposals/handler.js'

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeRes() {
  return { statusCode: null, body: null, ended: false }
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.body = body
  res.ended = true
}

function sendNoContent(res) {
  res.statusCode = 204
  res.ended = true
}

function makeCtx(method, opts = {}) {
  return {
    method,
    readJsonBody: vi.fn().mockResolvedValue(opts.body ?? null),
    sendJson,
    sendNoContent,
    requestUrl: opts.requestUrl ?? new URL('http://localhost/api/proposals'),
  }
}

const MOCK_ACTOR = {
  userId: 'user-abc',
  email: 'tester@example.com',
  displayName: 'Tester',
}

const MOCK_DB = { sql: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()

  getDatabaseClient.mockReturnValue(MOCK_DB)
  createUserScopedSql.mockReturnValue(MOCK_DB.sql)
  getCanonicalDatabaseDiagnostics.mockReturnValue({
    source: 'test', host: 'test', database: 'test', schema: 'public',
  })

  resolveActor.mockResolvedValue(MOCK_ACTOR)
  requireProposalAuth.mockImplementation(() => {})
  actorRole.mockReturnValue('admin')
  canReadProposal.mockReturnValue(true)
  canWriteProposals.mockReturnValue(true)
  canModifyProposal.mockReturnValue(true)
  canDeleteProposal.mockReturnValue(true)

  appendAuditLog.mockResolvedValue(undefined)
})

// ── handleProposalsRequest ────────────────────────────────────────────────────

describe('handleProposalsRequest()', () => {

  // ── GET ────────────────────────────────────────────────────────────────────

  describe('GET /api/proposals', () => {
    it('normalises legacy-field DB rows to canonical shape in the response', async () => {
      const legacyRow = {
        id: 'uuid-leg-1',
        proposal_type: 'leasing',
        name: 'João Silva',         // legacy — should become client_name
        document: '12345678901',    // legacy — should become client_document
        payload_json: { kWp: 10 },
        client_id: null,
      }
      listProposals.mockResolvedValue({
        data: [legacyRow],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      })

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('GET'))

      expect(res.statusCode).toBe(200)
      expect(res.body.data[0].client_name).toBe('João Silva')
      expect(res.body.data[0].client_document).toBe('12345678901')
    })

    it('preserves client_id as a BIGINT (number) in the list response', async () => {
      const row = {
        id: 'uuid-bigint-1',
        proposal_type: 'venda',
        client_name: 'Ana',
        payload_json: { kWp: 8 },
        client_id: 42,
      }
      listProposals.mockResolvedValue({
        data: [row],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      })

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('GET'))

      expect(res.body.data[0].client_id).toBe(42)
    })

    it('preserves client_id as null in the list response', async () => {
      const row = {
        id: 'uuid-null-1',
        proposal_type: 'leasing',
        client_name: 'Bruno',
        payload_json: { kWp: 6 },
        client_id: null,
      }
      listProposals.mockResolvedValue({
        data: [row],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      })

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('GET'))

      expect(res.body.data[0].client_id).toBeNull()
    })

    it('forwards pagination metadata unchanged', async () => {
      listProposals.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 10, total: 25, pages: 3 },
      })

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('GET'))

      expect(res.body.pagination).toEqual({ page: 2, limit: 10, total: 25, pages: 3 })
    })
  })

  // ── POST ───────────────────────────────────────────────────────────────────

  describe('POST /api/proposals', () => {
    it('creates a leasing proposal and returns a 201 with canonical response', async () => {
      const body = {
        proposal_type: 'leasing',
        client_name: 'Carla Leasing',
        payload_json: { kWp: 12, tipo: 'leasing' },
      }
      const dbRow = {
        id: 'uuid-post-1',
        proposal_type: 'leasing',
        client_name: 'Carla Leasing',
        payload_json: body.payload_json,
        client_id: null,
      }
      createProposal.mockResolvedValue(dbRow)

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(201)
      expect(res.body.data.proposal_type).toBe('leasing')
      expect(res.body.data.client_name).toBe('Carla Leasing')
      expect(res.body.data.client_id).toBeNull()
    })

    it('creates a venda proposal and returns a 201 with canonical response', async () => {
      const body = {
        proposal_type: 'venda',
        client_name: 'Daniel Venda',
        payload_json: { kWp: 5, tipo: 'venda' },
      }
      const dbRow = {
        id: 'uuid-post-2',
        proposal_type: 'venda',
        client_name: 'Daniel Venda',
        payload_json: body.payload_json,
        client_id: 99,
      }
      createProposal.mockResolvedValue(dbRow)

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(201)
      expect(res.body.data.proposal_type).toBe('venda')
      expect(res.body.data.client_id).toBe(99)
    })

    it('normalises legacy field names in the POST body to canonical before creating', async () => {
      const body = {
        proposal_type: 'venda',
        name: 'Eduardo Legacy',        // legacy → client_name
        document: '99988877766',        // legacy → client_document
        email: 'edu@test.com',          // legacy → client_email
        city: 'Belo Horizonte',         // legacy → client_city
        state: 'MG',                    // legacy → client_state
        payload_json: { kWp: 7 },
      }
      const dbRow = {
        id: 'uuid-post-3',
        proposal_type: 'venda',
        client_name: 'Eduardo Legacy',
        payload_json: body.payload_json,
      }
      createProposal.mockResolvedValue(dbRow)

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(201)
      // Verify the adapter-normalised fields were passed to the repository
      const passedData = createProposal.mock.calls[0][2]
      expect(passedData.client_name).toBe('Eduardo Legacy')
      expect(passedData.client_document).toBe('99988877766')
      expect(passedData.client_email).toBe('edu@test.com')
      expect(passedData.client_city).toBe('Belo Horizonte')
      expect(passedData.client_state).toBe('MG')
    })

    it('prefers canonical field names over legacy aliases in the POST body', async () => {
      const body = {
        proposal_type: 'leasing',
        client_name: 'Canonical Name',   // canonical — should win
        name: 'Legacy Name',             // legacy — should lose
        payload_json: { kWp: 9 },
      }
      createProposal.mockResolvedValue({ id: 'uuid-post-4', ...body })

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(201)
      const passedData = createProposal.mock.calls[0][2]
      expect(passedData.client_name).toBe('Canonical Name')
    })

    it('preserves payload_json content intact in the response', async () => {
      const payload = { kWp: 8.5, inversor: 'Fronius', paineis: ['350W', '350W'] }
      const body = {
        proposal_type: 'leasing',
        client_name: 'Flávia',
        payload_json: payload,
      }
      const dbRow = { id: 'uuid-post-5', client_name: 'Flávia', payload_json: payload }
      createProposal.mockResolvedValue(dbRow)

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(201)
      expect(res.body.data.payload_json).toEqual(payload)
    })

    it('returns 422 when payload_json is an empty object', async () => {
      const body = {
        proposal_type: 'leasing',
        client_name: 'G',
        payload_json: {},
      }

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(422)
      expect(res.body.error.code).toBe('INVALID_PAYLOAD')
      expect(createProposal).not.toHaveBeenCalled()
    })

    it('returns 422 when payload_json is null', async () => {
      const body = {
        proposal_type: 'leasing',
        client_name: 'H',
        payload_json: null,
      }

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(422)
      expect(createProposal).not.toHaveBeenCalled()
    })

    it('normalises a legacy DB row returned by createProposal to canonical response shape', async () => {
      const body = {
        proposal_type: 'venda',
        client_name: 'Igor',
        payload_json: { kWp: 11 },
      }
      // Repository returns a row that still has only legacy client fields
      const legacyDbRow = {
        id: 'uuid-post-6',
        proposal_type: 'venda',
        name: 'Igor',            // legacy
        document: '11100099988', // legacy
        payload_json: body.payload_json,
        client_id: 77,
      }
      createProposal.mockResolvedValue(legacyDbRow)

      const res = makeRes()
      await handleProposalsRequest({}, res, makeCtx('POST', { body }))

      expect(res.statusCode).toBe(201)
      expect(res.body.data.client_name).toBe('Igor')
      expect(res.body.data.client_document).toBe('11100099988')
      expect(res.body.data.client_id).toBe(77)
    })
  })
})

// ── handleProposalByIdRequest ─────────────────────────────────────────────────

describe('handleProposalByIdRequest()', () => {

  // ── GET /api/proposals/:id ─────────────────────────────────────────────────

  describe('GET /api/proposals/:id', () => {
    it('normalises a legacy-field DB row to canonical shape', async () => {
      const legacyRow = {
        id: 'uuid-get-1',
        proposal_type: 'leasing',
        name: 'Gabriela',          // legacy
        document: '11122233344',    // legacy
        payload_json: { kWp: 9 },
        client_id: 55,
      }
      getProposalById.mockResolvedValue(legacyRow)

      const res = makeRes()
      const ctx = { ...makeCtx('GET'), proposalId: 'uuid-get-1' }
      await handleProposalByIdRequest({}, res, ctx)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.client_name).toBe('Gabriela')
      expect(res.body.data.client_document).toBe('11122233344')
      expect(res.body.data.client_id).toBe(55)
    })

    it('preserves client_id as null in GET single response', async () => {
      const row = {
        id: 'uuid-get-2',
        client_name: 'Heitor',
        payload_json: { kWp: 4 },
        client_id: null,
      }
      getProposalById.mockResolvedValue(row)

      const res = makeRes()
      const ctx = { ...makeCtx('GET'), proposalId: 'uuid-get-2' }
      await handleProposalByIdRequest({}, res, ctx)

      expect(res.body.data.client_id).toBeNull()
    })

    it('preserves payload_json content in GET single response', async () => {
      const payload = { kWp: 6, módulos: 12, inversor: 'SMA' }
      const row = {
        id: 'uuid-get-3',
        client_name: 'Iara',
        payload_json: payload,
        client_id: null,
      }
      getProposalById.mockResolvedValue(row)

      const res = makeRes()
      const ctx = { ...makeCtx('GET'), proposalId: 'uuid-get-3' }
      await handleProposalByIdRequest({}, res, ctx)

      expect(res.body.data.payload_json).toEqual(payload)
    })
  })

  // ── PATCH /api/proposals/:id ───────────────────────────────────────────────

  describe('PATCH /api/proposals/:id', () => {
    it('normalises legacy field names in PATCH body when payload_json is provided', async () => {
      const existingRow = {
        id: 'uuid-patch-1',
        client_name: 'Irene',
        payload_json: { kWp: 5 },
        owner_user_id: 'user-abc',
      }
      const patchBody = {
        name: 'Irene Updated',    // legacy — should become client_name
        payload_json: { kWp: 6 },
      }
      const updatedRow = {
        id: 'uuid-patch-1',
        client_name: 'Irene Updated',
        payload_json: { kWp: 6 },
      }
      getProposalById.mockResolvedValue(existingRow)
      updateProposal.mockResolvedValue(updatedRow)

      const res = makeRes()
      const ctx = { ...makeCtx('PATCH', { body: patchBody }), proposalId: 'uuid-patch-1' }
      await handleProposalByIdRequest({}, res, ctx)

      expect(res.statusCode).toBe(200)
      const passedData = updateProposal.mock.calls[0][2]
      expect(passedData.client_name).toBe('Irene Updated')
    })

    it('returns canonical response after a successful PATCH', async () => {
      const existingRow = {
        id: 'uuid-patch-2',
        client_name: 'Júlio',
        payload_json: { kWp: 7 },
        owner_user_id: 'user-abc',
      }
      const patchBody = { status: 'sent' }   // no payload_json — no adapter normalization needed
      const updatedRow = {
        id: 'uuid-patch-2',
        name: 'Júlio',        // legacy field in DB row
        status: 'sent',
        payload_json: { kWp: 7 },
        client_id: 123,
      }
      getProposalById.mockResolvedValue(existingRow)
      updateProposal.mockResolvedValue(updatedRow)

      const res = makeRes()
      const ctx = { ...makeCtx('PATCH', { body: patchBody }), proposalId: 'uuid-patch-2' }
      await handleProposalByIdRequest({}, res, ctx)

      expect(res.statusCode).toBe(200)
      // toCanonicalProposal normalises the legacy-field response row
      expect(res.body.data.client_name).toBe('Júlio')
      expect(res.body.data.client_id).toBe(123)
    })

    it('returns 422 when payload_json in PATCH body is empty', async () => {
      const existingRow = {
        id: 'uuid-patch-3',
        client_name: 'Karen',
        payload_json: { kWp: 3 },
        owner_user_id: 'user-abc',
      }
      const patchBody = { payload_json: {} }  // empty → adapter should reject
      getProposalById.mockResolvedValue(existingRow)

      const res = makeRes()
      const ctx = { ...makeCtx('PATCH', { body: patchBody }), proposalId: 'uuid-patch-3' }
      await handleProposalByIdRequest({}, res, ctx)

      expect(res.statusCode).toBe(422)
      expect(updateProposal).not.toHaveBeenCalled()
    })
  })
})
