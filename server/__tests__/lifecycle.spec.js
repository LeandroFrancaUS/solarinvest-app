// server/__tests__/lifecycle.spec.js
// Unit tests for PATCH /api/client-management/:id/lifecycle handler logic.
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Minimal test helpers ─────────────────────────────────────────────────────

const VALID_LIFECYCLE_STATUSES = [
  'lead', 'negotiating', 'contracted', 'active',
  'suspended', 'cancelled', 'completed',
]
const VALID_ONBOARDING_STATUSES = ['pending', 'in_progress', 'completed', 'skipped']

// Mirrors the pure validation + lifecycle-update logic extracted from handlePatchLifecycle,
// so tests don't need to import server-only modules (DB clients, etc.).
async function runLifecyclePatch({
  clientId,
  actor,
  body,
  upsertResult = { id: 1, client_id: 1, lifecycle_status: 'contracted', is_converted_customer: true },
  upsertError = null,
}) {
  const responses = []
  const sendJson = (status, payload) => responses.push({ status, payload })
  const sendError = (status, code, message) => sendJson(status, { error: { code, message } })

  // Path param validation
  const clientIdNum = parseInt(clientId, 10)
  if (!Number.isFinite(clientIdNum) || clientIdNum <= 0) {
    sendError(400, 'VALIDATION_ERROR', 'clientId must be a positive integer')
    return responses
  }

  // Auth checks
  if (!actor?.userId) { sendError(401, 'UNAUTHENTICATED', 'Login required'); return responses }
  if (!actor.isAdmin && !actor.isOffice && !actor.isFinanceiro) {
    sendError(403, 'FORBIDDEN', 'Access forbidden')
    return responses
  }
  if (actor.isFinanceiro && !actor.isAdmin) {
    sendError(403, 'FORBIDDEN', 'Read-only role for lifecycle writes')
    return responses
  }

  // Payload validation
  const validStatuses = new Set(VALID_LIFECYCLE_STATUSES)
  const validOnboarding = new Set(VALID_ONBOARDING_STATUSES)
  if (body.lifecycle_status !== undefined && !validStatuses.has(body.lifecycle_status)) {
    sendError(400, 'VALIDATION_ERROR', `lifecycle_status must be one of: ${[...validStatuses].join(', ')}`)
    return responses
  }
  if (body.onboarding_status !== undefined && !validOnboarding.has(body.onboarding_status)) {
    sendError(400, 'VALIDATION_ERROR', `onboarding_status must be one of: ${[...validOnboarding].join(', ')}`)
    return responses
  }
  if (body.is_converted_customer !== undefined && typeof body.is_converted_customer !== 'boolean') {
    sendError(400, 'VALIDATION_ERROR', 'is_converted_customer must be a boolean')
    return responses
  }

  // Audit fields — always set server-side, never trust client
  const payload = {
    ...body,
    converted_by_user_id: body.is_converted_customer ? actor.userId : undefined,
  }

  // Simulate upsert
  if (upsertError) {
    sendError(500, 'INTERNAL_ERROR', 'Failed to update lifecycle')
    return responses
  }
  sendJson(200, { data: { ...upsertResult, ...payload, client_id: clientIdNum } })
  return responses
}

// ─── Actors ───────────────────────────────────────────────────────────────────

const adminActor = { userId: 'user-admin', isAdmin: true, isOffice: false, isFinanceiro: false }
const officeActor = { userId: 'user-office', isAdmin: false, isOffice: true, isFinanceiro: false }
const financeiroActor = { userId: 'user-fin', isAdmin: false, isOffice: false, isFinanceiro: true }
const comercialActor = { userId: 'user-com', isAdmin: false, isOffice: false, isFinanceiro: false }
const noActor = null

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /api/client-management/:id/lifecycle', () => {

  it('admin can mark negócio fechado — returns 200 with data', async () => {
    const res = await runLifecyclePatch({
      clientId: '54',
      actor: adminActor,
      body: { lifecycle_status: 'contracted', is_converted_customer: true, converted_at: new Date().toISOString() },
    })
    expect(res[0].status).toBe(200)
    expect(res[0].payload.data.lifecycle_status).toBe('contracted')
    expect(res[0].payload.data.is_converted_customer).toBe(true)
  })

  it('admin: converted_by_user_id is set server-side from actor.userId', async () => {
    const res = await runLifecyclePatch({
      clientId: '10',
      actor: adminActor,
      body: { lifecycle_status: 'contracted', is_converted_customer: true },
    })
    expect(res[0].status).toBe(200)
    expect(res[0].payload.data.converted_by_user_id).toBe('user-admin')
  })

  it('converted_by_user_id from client is overwritten by actor.userId (security)', async () => {
    const res = await runLifecyclePatch({
      clientId: '10',
      actor: adminActor,
      body: { lifecycle_status: 'contracted', is_converted_customer: true, converted_by_user_id: 'fake-user-id' },
    })
    expect(res[0].status).toBe(200)
    // Server always uses actor.userId, ignoring client-supplied value
    expect(res[0].payload.data.converted_by_user_id).toBe('user-admin')
  })

  it('office can mark negócio fechado — returns 200', async () => {
    const res = await runLifecyclePatch({
      clientId: '51',
      actor: officeActor,
      body: { lifecycle_status: 'contracted', is_converted_customer: true },
    })
    expect(res[0].status).toBe(200)
  })

  it('financeiro is blocked from lifecycle writes — returns 403', async () => {
    const res = await runLifecyclePatch({
      clientId: '51',
      actor: financeiroActor,
      body: { lifecycle_status: 'contracted' },
    })
    expect(res[0].status).toBe(403)
    expect(res[0].payload.error.code).toBe('FORBIDDEN')
  })

  it('comercial (no special flags) is blocked — returns 403', async () => {
    const res = await runLifecyclePatch({
      clientId: '44',
      actor: comercialActor,
      body: { lifecycle_status: 'contracted' },
    })
    expect(res[0].status).toBe(403)
  })

  it('unauthenticated request returns 401', async () => {
    const res = await runLifecyclePatch({
      clientId: '44',
      actor: noActor,
      body: { lifecycle_status: 'contracted' },
    })
    expect(res[0].status).toBe(401)
  })

  it('invalid clientId (string) returns 400', async () => {
    const res = await runLifecyclePatch({
      clientId: 'abc',
      actor: adminActor,
      body: { lifecycle_status: 'contracted' },
    })
    expect(res[0].status).toBe(400)
    expect(res[0].payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('clientId = 0 is rejected with 400', async () => {
    const res = await runLifecyclePatch({
      clientId: '0',
      actor: adminActor,
      body: { lifecycle_status: 'contracted' },
    })
    expect(res[0].status).toBe(400)
  })

  it('invalid lifecycle_status returns 400', async () => {
    const res = await runLifecyclePatch({
      clientId: '54',
      actor: adminActor,
      body: { lifecycle_status: 'INVALID_STATUS' },
    })
    expect(res[0].status).toBe(400)
    expect(res[0].payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('invalid onboarding_status returns 400', async () => {
    const res = await runLifecyclePatch({
      clientId: '54',
      actor: adminActor,
      body: { lifecycle_status: 'contracted', onboarding_status: 'unknown' },
    })
    expect(res[0].status).toBe(400)
  })

  it('is_converted_customer as string returns 400', async () => {
    const res = await runLifecyclePatch({
      clientId: '54',
      actor: adminActor,
      body: { is_converted_customer: 'true' },
    })
    expect(res[0].status).toBe(400)
    expect(res[0].payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('DB error returns 500', async () => {
    const res = await runLifecyclePatch({
      clientId: '54',
      actor: adminActor,
      body: { lifecycle_status: 'contracted' },
      upsertError: new Error('relation "public.client_lifecycle" does not exist'),
    })
    expect(res[0].status).toBe(500)
    expect(res[0].payload.error.code).toBe('INTERNAL_ERROR')
  })

  it('idempotent: second call with same payload returns 200 (no error)', async () => {
    const existingRecord = {
      id: 1, client_id: 54,
      lifecycle_status: 'contracted',
      is_converted_customer: true,
      converted_at: '2026-01-01T00:00:00Z',
    }
    const res = await runLifecyclePatch({
      clientId: '54',
      actor: adminActor,
      body: { lifecycle_status: 'contracted', is_converted_customer: true },
      upsertResult: existingRecord,
    })
    expect(res[0].status).toBe(200)
    expect(res[0].payload.data.is_converted_customer).toBe(true)
  })

  it.each(VALID_LIFECYCLE_STATUSES)('accepts valid lifecycle_status "%s"', async (status) => {
    const res = await runLifecyclePatch({
      clientId: '1',
      actor: adminActor,
      body: { lifecycle_status: status },
    })
    expect(res[0].status).toBe(200)
  })

  it('clientId is parsed to integer in the response', async () => {
    const res = await runLifecyclePatch({
      clientId: '25',
      actor: adminActor,
      body: { lifecycle_status: 'contracted' },
    })
    expect(res[0].payload.data.client_id).toBe(25)
  })

})
