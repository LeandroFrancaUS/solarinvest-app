// server/__tests__/response.spec.js
// Unit tests for server/response.js.
//
// Verifies that every exported helper sets the correct status code, headers,
// and response body, and that all helpers are no-ops when res.headersSent is
// already true.
//
// Run with: npm run test:server

import { describe, it, expect } from 'vitest'
import {
  jsonResponse,
  noContentResponse,
  methodNotAllowedResponse,
  unauthorizedResponse,
  forbiddenResponse,
  tooManyRequestsResponse,
  serviceUnavailableResponse,
  internalErrorResponse,
  errorResponse,
} from '../response.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes(alreadySent = false) {
  const headers = {}
  const res = {
    statusCode: 0,
    headers,
    body: /** @type {string | null} */ (alreadySent ? 'already-sent' : null),
    setHeader(key, val) { headers[key] = val },
    end(body) { this.body = body ?? null },
    get headersSent() { return this.body !== null },
  }
  return res
}

function parseBody(res) {
  return JSON.parse(/** @type {string} */ (res.body))
}

// ─────────────────────────────────────────────────────────────────────────────
// jsonResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('jsonResponse', () => {
  it('sets status code, Content-Type header, and serialized body', () => {
    const res = makeRes()
    jsonResponse(res, 200, { ok: true })

    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(parseBody(res)).toEqual({ ok: true })
  })

  it('applies extra headers from the headers argument', () => {
    const res = makeRes()
    jsonResponse(res, 200, { ok: true }, { 'X-Custom': 'hello' })

    expect(res.headers['X-Custom']).toBe('hello')
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    jsonResponse(res, 500, { error: 'oops' })

    expect(res.statusCode).toBe(0)
    expect(res.body).toBe('already-sent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// noContentResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('noContentResponse', () => {
  it('returns 204 with an empty body', () => {
    const res = makeRes()
    noContentResponse(res)

    expect(res.statusCode).toBe(204)
    expect(res.body).toBeNull()
  })

  it('sets extra headers when provided', () => {
    const res = makeRes()
    noContentResponse(res, { Allow: 'GET,OPTIONS' })

    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    noContentResponse(res)

    expect(res.statusCode).toBe(0)
    expect(res.body).toBe('already-sent')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// methodNotAllowedResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('methodNotAllowedResponse', () => {
  it('returns 405 with Allow header (array input)', () => {
    const res = makeRes()
    methodNotAllowedResponse(res, ['GET', 'OPTIONS'])

    expect(res.statusCode).toBe(405)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
    expect(parseBody(res)).toMatchObject({ error: 'Method not allowed' })
  })

  it('returns 405 with Allow header (string input)', () => {
    const res = makeRes()
    methodNotAllowedResponse(res, 'POST,OPTIONS')

    expect(res.statusCode).toBe(405)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    methodNotAllowedResponse(res, ['GET'])

    expect(res.statusCode).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// unauthorizedResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('unauthorizedResponse', () => {
  it('returns 401 with default payload', () => {
    const res = makeRes()
    unauthorizedResponse(res)

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 401 with custom payload', () => {
    const res = makeRes()
    unauthorizedResponse(res, { ok: false, code: 'TOKEN_EXPIRED' })

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ code: 'TOKEN_EXPIRED' })
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    unauthorizedResponse(res)

    expect(res.statusCode).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// forbiddenResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('forbiddenResponse', () => {
  it('returns 403 with default payload', () => {
    const res = makeRes()
    forbiddenResponse(res)

    expect(res.statusCode).toBe(403)
    expect(parseBody(res)).toMatchObject({ error: 'Forbidden' })
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    forbiddenResponse(res)

    expect(res.statusCode).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tooManyRequestsResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('tooManyRequestsResponse', () => {
  it('returns 429 with default payload', () => {
    const res = makeRes()
    tooManyRequestsResponse(res)

    expect(res.statusCode).toBe(429)
    expect(parseBody(res)).toMatchObject({ error: 'Too many requests' })
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    tooManyRequestsResponse(res)

    expect(res.statusCode).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// serviceUnavailableResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('serviceUnavailableResponse', () => {
  it('returns 503 with default payload', () => {
    const res = makeRes()
    serviceUnavailableResponse(res)

    expect(res.statusCode).toBe(503)
    expect(parseBody(res)).toMatchObject({ error: 'Service unavailable' })
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    serviceUnavailableResponse(res)

    expect(res.statusCode).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// internalErrorResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('internalErrorResponse', () => {
  it('returns 500 with default payload', () => {
    const res = makeRes()
    internalErrorResponse(res)

    expect(res.statusCode).toBe(500)
    expect(parseBody(res)).toMatchObject({ error: 'Internal server error' })
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    internalErrorResponse(res)

    expect(res.statusCode).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// errorResponse
// ─────────────────────────────────────────────────────────────────────────────

describe('errorResponse', () => {
  it('uses error.statusCode when provided', () => {
    const res = makeRes()
    const err = Object.assign(new Error('not found'), { statusCode: 404 })
    errorResponse(res, err, 'fallback')

    expect(res.statusCode).toBe(404)
    expect(parseBody(res)).toMatchObject({ error: 'Not found' })
  })

  it('uses error.status when statusCode is absent', () => {
    const res = makeRes()
    const err = Object.assign(new Error('forbidden'), { status: 403 })
    errorResponse(res, err, 'fallback')

    expect(res.statusCode).toBe(403)
    expect(parseBody(res)).toMatchObject({ error: 'Forbidden' })
  })

  it('prefers statusCode over status when both are present', () => {
    const res = makeRes()
    const err = Object.assign(new Error('conflict'), { statusCode: 429, status: 500 })
    errorResponse(res, err)

    expect(res.statusCode).toBe(429)
  })

  it('defaults to 500 when error has no statusCode or status', () => {
    const res = makeRes()
    errorResponse(res, new Error('boom'), 'Something broke')

    expect(res.statusCode).toBe(500)
    expect(parseBody(res)).toMatchObject({ error: 'Something broke' })
  })

  it('defaults to 500 for out-of-range status values', () => {
    const res = makeRes()
    const err = Object.assign(new Error('weird'), { statusCode: 200 })
    errorResponse(res, err, 'fallback')

    expect(res.statusCode).toBe(500)
  })

  it('returns 401 for 401 errors', () => {
    const res = makeRes()
    const err = Object.assign(new Error('unauth'), { statusCode: 401 })
    errorResponse(res, err)

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 503 with fallbackMessage for 503 errors', () => {
    const res = makeRes()
    const err = Object.assign(new Error('down'), { statusCode: 503 })
    errorResponse(res, err, 'Service is down')

    expect(res.statusCode).toBe(503)
    expect(parseBody(res)).toMatchObject({ error: 'Service is down' })
  })

  it('does nothing when res.headersSent is true', () => {
    const res = makeRes(true)
    errorResponse(res, new Error('late error'))

    expect(res.statusCode).toBe(0)
    expect(res.body).toBe('already-sent')
  })

  it('handles non-Error objects gracefully', () => {
    const res = makeRes()
    errorResponse(res, null, 'Null error')

    expect(res.statusCode).toBe(500)
    expect(parseBody(res)).toMatchObject({ error: 'Null error' })
  })
})
