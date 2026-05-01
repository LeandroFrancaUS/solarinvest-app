// server/__tests__/financial-analyses-auth.spec.js
// Verify that the /api/financial-analyses handler correctly rejects
// unauthenticated/unauthorised requests and scopes GET to the current user.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleFinancialAnalyses } from '../financial-analyses/handler.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../database/neonClient.js', () => ({
  getDatabaseClient: () => ({
    sql: Object.assign(() => Promise.resolve([]), { transaction: undefined }),
  }),
}))

vi.mock('../proposals/permissions.js', () => ({
  resolveActor: vi.fn(),
  actorRole: vi.fn(),
}))

vi.mock('../database/withRLSContext.js', () => ({
  createUserScopedSql: vi.fn(() => () => Promise.resolve([])),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

import { resolveActor, actorRole } from '../proposals/permissions.js'
import { createUserScopedSql } from '../database/withRLSContext.js'

function makeCtx(method = 'GET') {
  let statusCode, body
  return {
    method,
    readJsonBody: vi.fn().mockResolvedValue({}),
    sendJson: vi.fn((code, data) => { statusCode = code; body = data }),
    get lastStatus() { return statusCode },
    get lastBody() { return body },
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleFinancialAnalyses auth guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when actor is null (unauthenticated)', async () => {
    resolveActor.mockResolvedValue(null)

    const ctx = makeCtx('GET')
    await handleFinancialAnalyses({}, {}, ctx)

    expect(ctx.lastStatus).toBe(401)
    expect(ctx.lastBody).toMatchObject({ error: expect.any(String) })
  })

  it('returns 403 when actor has no recognised role', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: false })
    actorRole.mockReturnValue(null)

    const ctx = makeCtx('GET')
    await handleFinancialAnalyses({}, {}, ctx)

    expect(ctx.lastStatus).toBe(403)
  })

  it('scopes GET to current user for non-admin', async () => {
    const actor = { userId: 'user-123', isAdmin: false }
    resolveActor.mockResolvedValue(actor)
    actorRole.mockReturnValue('role_comercial')

    const scopedSql = vi.fn().mockResolvedValue([])
    createUserScopedSql.mockReturnValue(scopedSql)

    const ctx = makeCtx('GET')
    await handleFinancialAnalyses({}, {}, ctx)

    expect(ctx.lastStatus).toBe(200)
    // The query template should include created_by_user_id filter
    const call = scopedSql.mock.calls[0]
    const template = Array.isArray(call?.[0]) ? call[0].join('') : ''
    expect(template).toContain('created_by_user_id')
  })

  it('allows admin to see all analyses (no user filter)', async () => {
    const actor = { userId: 'admin-1', isAdmin: true }
    resolveActor.mockResolvedValue(actor)
    actorRole.mockReturnValue('role_admin')

    const scopedSql = vi.fn().mockResolvedValue([])
    createUserScopedSql.mockReturnValue(scopedSql)

    const ctx = makeCtx('GET')
    await handleFinancialAnalyses({}, {}, ctx)

    expect(ctx.lastStatus).toBe(200)
    // Admin query should NOT include created_by_user_id filter
    const call = scopedSql.mock.calls[0]
    const template = Array.isArray(call?.[0]) ? call[0].join('') : ''
    expect(template).not.toContain('created_by_user_id')
  })
})
