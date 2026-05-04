// server/__tests__/middleware.spec.js
// Unit tests for the server/middleware layer (PR 17).
//
// Tests each middleware in isolation using lightweight in-process fakes for
// req, res, and handler functions.  No HTTP server is started.
//
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock resolveActor so withAuth tests do not require a real DB/Stack Auth ───

vi.mock('../proposals/permissions.js', () => ({
  resolveActor: vi.fn(),
}))

import { resolveActor } from '../proposals/permissions.js'
import { withAuth } from '../middleware/withAuth.js'
import { withErrorHandler } from '../middleware/withErrorHandler.js'
import { withRateLimit } from '../middleware/withRateLimit.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const headers = {}
  return {
    statusCode: 0,
    headers,
    body: /** @type {string | null} */ (null),
    setHeader(key, val) { headers[key] = val },
    end(body) { this.body = body ?? null },
    get headersSent() { return this.body !== null },
  }
}

function makeReq(method = 'POST') {
  return { method, headers: {}, socket: { remoteAddress: '127.0.0.1' } }
}

function parseBody(res) {
  return JSON.parse(/** @type {string} */ (res.body))
}

/** A handler that always records that it was called and sends 200. */
function makePassthroughHandler() {
  const fn = vi.fn(async (_req, res, _ctx) => {
    res.statusCode = 200
    res.end('{"ok":true}')
  })
  return fn
}

// ─────────────────────────────────────────────────────────────────────────────
// withAuth
// ─────────────────────────────────────────────────────────────────────────────

describe('withAuth', () => {
  beforeEach(() => { vi.resetAllMocks() })

  // ── OPTIONS pass-through ──────────────────────────────────────────────────

  it('passes OPTIONS requests through without calling resolveActor', async () => {
    const inner = makePassthroughHandler()
    const handler = withAuth(inner)
    const req = makeReq('OPTIONS')
    const res = makeRes()

    await handler(req, res, {})

    expect(resolveActor).not.toHaveBeenCalled()
    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── 401 — unauthenticated ─────────────────────────────────────────────────

  it('returns 401 when resolveActor throws', async () => {
    resolveActor.mockRejectedValue(new Error('Token invalid'))
    const inner = makePassthroughHandler()
    const handler = withAuth(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Autenticação necessária.' })
    expect(inner).not.toHaveBeenCalled()
  })

  it('returns 401 when resolveActor returns null', async () => {
    resolveActor.mockResolvedValue(null)
    const inner = makePassthroughHandler()
    const handler = withAuth(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Autenticação necessária.' })
    expect(inner).not.toHaveBeenCalled()
  })

  it('returns 401 when actor has no userId', async () => {
    resolveActor.mockResolvedValue({ userId: null, isAdmin: true })
    const inner = makePassthroughHandler()
    const handler = withAuth(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ ok: false })
    expect(inner).not.toHaveBeenCalled()
  })

  // ── No role restriction — passes through ──────────────────────────────────

  it('calls handler when no role restriction is set', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: false, isOffice: false })
    const inner = makePassthroughHandler()
    const handler = withAuth(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(200)
    expect(inner).toHaveBeenCalledOnce()
  })

  // ── role option ───────────────────────────────────────────────────────────

  it('calls handler when actor has the required single role', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: true })
    const inner = makePassthroughHandler()
    const handler = withAuth(inner, { role: 'admin' })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(200)
    expect(inner).toHaveBeenCalledOnce()
  })

  it('returns 403 when actor lacks the required single role', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: false, isOffice: false })
    const inner = makePassthroughHandler()
    const handler = withAuth(inner, { role: 'admin' })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(403)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Sem permissão para acessar este recurso.' })
    expect(inner).not.toHaveBeenCalled()
  })

  // ── roles option ──────────────────────────────────────────────────────────

  it('calls handler when actor satisfies one of several allowed roles', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: false, isOffice: true })
    const inner = makePassthroughHandler()
    const handler = withAuth(inner, { roles: ['admin', 'office'] })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(200)
    expect(inner).toHaveBeenCalledOnce()
  })

  it('returns 403 when actor satisfies none of the allowed roles', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: false, isOffice: false, isComercial: true })
    const inner = makePassthroughHandler()
    const handler = withAuth(inner, { roles: ['admin', 'office'] })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(403)
    expect(inner).not.toHaveBeenCalled()
  })

  // ── actor injection ───────────────────────────────────────────────────────

  it('injects actor into reqCtx when auth succeeds', async () => {
    const actor = { userId: 'u1', isAdmin: true }
    resolveActor.mockResolvedValue(actor)
    let capturedCtx = null
    const inner = vi.fn(async (_req, _res, ctx) => { capturedCtx = ctx })
    const handler = withAuth(inner, { role: 'admin' })

    await handler(makeReq(), makeRes(), { requestId: 'r1' })

    expect(capturedCtx).toMatchObject({ requestId: 'r1', actor })
  })

  // ── all supported roles ───────────────────────────────────────────────────

  it.each([
    ['admin',      { userId: 'u', isAdmin: true }],
    ['office',     { userId: 'u', isOffice: true }],
    ['financeiro', { userId: 'u', isFinanceiro: true }],
    ['comercial',  { userId: 'u', isComercial: true }],
  ])('role "%s" is recognized', async (role, actor) => {
    resolveActor.mockResolvedValue(actor)
    const inner = makePassthroughHandler()
    const handler = withAuth(inner, { role })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// withErrorHandler
// ─────────────────────────────────────────────────────────────────────────────

describe('withErrorHandler', () => {
  // ── No error — handler runs normally ─────────────────────────────────────

  it('calls handler normally when no error is thrown', async () => {
    const inner = makePassthroughHandler()
    const handler = withErrorHandler(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── Unhandled error → 500 ─────────────────────────────────────────────────

  it('returns 500 for an unhandled error with no statusCode', async () => {
    const inner = vi.fn().mockRejectedValue(new Error('Something went wrong'))
    const handler = withErrorHandler(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(500)
    expect(parseBody(res)).toMatchObject({ ok: false })
  })

  // ── Custom statusCode override ────────────────────────────────────────────

  it('uses error.statusCode when provided', async () => {
    const err = new Error('Not found')
    err.statusCode = 404
    const inner = vi.fn().mockRejectedValue(err)
    const handler = withErrorHandler(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(404)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Recurso não encontrado.' })
  })

  it('maps 401 statusCode to the standard message', async () => {
    const err = new Error('token expired')
    err.statusCode = 401
    const inner = vi.fn().mockRejectedValue(err)
    const handler = withErrorHandler(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Autenticação necessária.' })
  })

  it('maps 403 statusCode to the standard message', async () => {
    const err = new Error('forbidden')
    err.statusCode = 403
    const inner = vi.fn().mockRejectedValue(err)
    const handler = withErrorHandler(inner)
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(403)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Sem permissão para acessar este recurso.' })
  })

  // ── headersSent guard ─────────────────────────────────────────────────────

  it('does not double-write when res.headersSent is true at catch time', async () => {
    const inner = vi.fn(async (_req, res, _ctx) => {
      // Start the response, then throw.
      res.statusCode = 200
      res.end('partial')
      throw new Error('late error')
    })
    const handler = withErrorHandler(inner)
    const res = makeRes()

    await expect(handler(makeReq(), res, {})).resolves.toBeUndefined()

    // Status must stay at the value set before the throw.
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('partial')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// withRateLimit — check mode
// ─────────────────────────────────────────────────────────────────────────────

describe('withRateLimit (check mode)', () => {
  // ── Not rate-limited — passes through ─────────────────────────────────────

  it('calls handler when check returns false', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { check: () => false })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── Rate-limited → 429 ────────────────────────────────────────────────────

  it('returns 429 when check returns true', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { check: () => true })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(res.statusCode).toBe(429)
    expect(parseBody(res)).toMatchObject({ error: 'Too many requests. Try again later.' })
    expect(inner).not.toHaveBeenCalled()
  })

  // ── OPTIONS pass-through ──────────────────────────────────────────────────

  it('passes OPTIONS through even when check would return true', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { check: () => true })
    const res = makeRes()

    await handler(makeReq('OPTIONS'), res, {})

    // check is bypassed; handler is called
    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── check receives the request ────────────────────────────────────────────

  it('passes req to the check function', async () => {
    const check = vi.fn(() => false)
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { check })
    const req = makeReq('POST')

    await handler(req, makeRes(), {})

    expect(check).toHaveBeenCalledWith(req)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// withRateLimit — standalone mode
// ─────────────────────────────────────────────────────────────────────────────

describe('withRateLimit (standalone mode)', () => {
  // ── Under limit — passes through ──────────────────────────────────────────

  it('calls handler when under the request limit', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { limit: 5, windowMs: 60_000 })
    const res = makeRes()

    await handler(makeReq(), res, {})

    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── Exceeds limit → 429 ───────────────────────────────────────────────────

  it('returns 429 after exceeding the per-IP limit', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { limit: 2, windowMs: 60_000 })
    const req = makeReq('POST')

    // 2 successful calls (at or below limit)
    await handler(req, makeRes(), {})
    await handler(req, makeRes(), {})

    // 3rd call exceeds the limit
    const res = makeRes()
    await handler(req, res, {})

    expect(res.statusCode).toBe(429)
    expect(parseBody(res)).toMatchObject({ error: 'Too many requests. Try again later.' })
  })

  // ── OPTIONS pass-through ──────────────────────────────────────────────────

  it('passes OPTIONS through regardless of the bucket state', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { limit: 0, windowMs: 60_000 })
    const res = makeRes()

    // limit = 0 means every non-OPTIONS request would be blocked
    await handler(makeReq('OPTIONS'), res, {})

    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── Requests with no IP are never blocked ─────────────────────────────────

  it('never blocks when the request has no resolvable IP', async () => {
    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { limit: 0, windowMs: 60_000 })
    const req = { method: 'POST', headers: {}, socket: {} } // no remoteAddress
    const res = makeRes()

    await handler(req, res, {})

    expect(inner).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  // ── Window expiry resets the count ───────────────────────────────────────

  it('resets the count after the window expires', async () => {
    vi.useFakeTimers()

    const inner = makePassthroughHandler()
    const handler = withRateLimit(inner, { limit: 1, windowMs: 1_000 })
    const req = makeReq('POST')

    // 1st request — within limit
    await handler(req, makeRes(), {})

    // 2nd request — over limit → 429
    const blockedRes = makeRes()
    await handler(req, blockedRes, {})
    expect(blockedRes.statusCode).toBe(429)

    // Advance past the window
    vi.advanceTimersByTime(2_000)

    // 3rd request — window reset → allowed
    const allowedRes = makeRes()
    await handler(req, allowedRes, {})
    expect(allowedRes.statusCode).toBe(200)

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Composition: withErrorHandler + withRateLimit + withAuth
// ─────────────────────────────────────────────────────────────────────────────

describe('composed: withErrorHandler(withRateLimit(withAuth(handler)))', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('calls handler and injects actor on fully authorized request', async () => {
    const actor = { userId: 'u1', isAdmin: true }
    resolveActor.mockResolvedValue(actor)
    let capturedActor = null
    const inner = vi.fn(async (_req, _res, ctx) => {
      capturedActor = ctx.actor
      _res.statusCode = 200
      _res.end('{"ok":true}')
    })
    const composed = withErrorHandler(
      withRateLimit(
        withAuth(inner, { role: 'admin' }),
        { check: () => false },
      ),
    )

    const res = makeRes()
    await composed(makeReq(), res, {})

    expect(res.statusCode).toBe(200)
    expect(capturedActor).toBe(actor)
    expect(inner).toHaveBeenCalledOnce()
  })

  it('returns 429 before reaching auth when rate-limited', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: true })
    const inner = makePassthroughHandler()
    const composed = withErrorHandler(
      withRateLimit(
        withAuth(inner, { role: 'admin' }),
        { check: () => true },
      ),
    )

    const res = makeRes()
    await composed(makeReq(), res, {})

    expect(res.statusCode).toBe(429)
    expect(resolveActor).not.toHaveBeenCalled()
    expect(inner).not.toHaveBeenCalled()
  })

  it('returns 500 and suppresses stack traces for unhandled errors', async () => {
    resolveActor.mockResolvedValue({ userId: 'u1', isAdmin: true })
    const inner = vi.fn().mockRejectedValue(new Error('Unexpected DB crash'))
    const composed = withErrorHandler(
      withRateLimit(
        withAuth(inner, { role: 'admin' }),
        { check: () => false },
      ),
    )

    const res = makeRes()
    await composed(makeReq(), res, {})

    expect(res.statusCode).toBe(500)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.error).not.toContain('DB crash') // message not leaked in default NODE_ENV
  })
})
