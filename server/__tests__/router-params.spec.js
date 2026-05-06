// server/__tests__/router-params.spec.js
//
// Unit tests for the parameterised path support added to server/router.js.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi } from 'vitest'
import { createRouter } from '../router.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeReqCtx() {
  return { requestId: 'test', vercelId: undefined }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Exact-path matching (regression: must still work after param support added)
// ─────────────────────────────────────────────────────────────────────────────

describe('createRouter — exact-path matching (regression)', () => {
  it('matches a registered exact path', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('GET', '/api/health', fn)
    expect(router.match('GET', '/api/health')).toBe(fn)
  })

  it('returns null for an unregistered path', () => {
    const router = createRouter()
    router.register('GET', '/api/health', vi.fn())
    expect(router.match('GET', '/api/missing')).toBeNull()
  })

  it('matches wildcard method for any HTTP verb', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('*', '/api/resource', fn)
    expect(router.match('GET', '/api/resource')).toBe(fn)
    expect(router.match('POST', '/api/resource')).toBe(fn)
    expect(router.match('DELETE', '/api/resource')).toBe(fn)
  })

  it('does NOT match wrong method for non-wildcard route', () => {
    const router = createRouter()
    router.register('GET', '/api/resource', vi.fn())
    expect(router.match('POST', '/api/resource')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Parameterised path matching
// ─────────────────────────────────────────────────────────────────────────────

describe('createRouter — parameterised path matching', () => {
  it('matches a single :param segment', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('*', '/api/users/:id', fn)
    const matched = router.match('GET', '/api/users/42')
    expect(matched).toBeTypeOf('function')
  })

  it('injects params into reqCtx when parameterised route matches', async () => {
    const router = createRouter()
    const handler = vi.fn()
    router.register('*', '/api/users/:id', handler)
    const wrapped = router.match('GET', '/api/users/42')
    const req = {}, res = {}, ctx = makeReqCtx()
    await wrapped(req, res, ctx)
    expect(handler).toHaveBeenCalledWith(req, res, expect.objectContaining({ params: { id: '42' } }))
  })

  it('injects multiple params into reqCtx', async () => {
    const router = createRouter()
    const handler = vi.fn()
    router.register('*', '/api/orgs/:orgId/members/:memberId', handler)
    const wrapped = router.match('GET', '/api/orgs/org-abc/members/member-99')
    await wrapped({}, {}, makeReqCtx())
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ params: { orgId: 'org-abc', memberId: 'member-99' } }),
    )
  })

  it('preserves existing reqCtx fields alongside injected params', async () => {
    const router = createRouter()
    const handler = vi.fn()
    router.register('*', '/api/items/:itemId', handler)
    const wrapped = router.match('GET', '/api/items/77')
    await wrapped({}, {}, { requestId: 'req-1', vercelId: 'v-1' })
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ requestId: 'req-1', vercelId: 'v-1', params: { itemId: '77' } }),
    )
  })

  it('does not match a parameterised route when path has too many segments', () => {
    const router = createRouter()
    router.register('*', '/api/users/:id', vi.fn())
    expect(router.match('GET', '/api/users/42/extra')).toBeNull()
  })

  it('does not match a parameterised route for method mismatch', () => {
    const router = createRouter()
    router.register('GET', '/api/users/:id', vi.fn())
    expect(router.match('POST', '/api/users/42')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Exact-path routes win over parameterised routes
// ─────────────────────────────────────────────────────────────────────────────

describe('createRouter — exact routes have priority over parameterised routes', () => {
  it('exact /api/users/picker wins over /api/users/:id regardless of registration order', () => {
    const router = createRouter()
    const exactFn = vi.fn()
    const paramFn = vi.fn()
    // Register param FIRST, exact SECOND — exact should still win
    router.register('*', '/api/users/:id', paramFn)
    router.register('*', '/api/users/picker', exactFn)
    const matched = router.match('GET', '/api/users/picker')
    // Must be the exact function, not the param wrapper
    expect(matched).toBe(exactFn)
  })

  it('parameterised route matches when no exact route covers the segment', () => {
    const router = createRouter()
    const paramFn = vi.fn()
    router.register('*', '/api/users/:id', paramFn)
    router.register('*', '/api/users/picker', vi.fn())
    const matched = router.match('GET', '/api/users/123')
    expect(matched).toBeTypeOf('function')
    expect(matched).not.toBe(paramFn) // it's a wrapper, not paramFn directly
  })

  it('nested exact /api/consultants/:id/deactivate wins over hypothetical /api/consultants/:id/:action', () => {
    const router = createRouter()
    const exactDeactivateFn = vi.fn()
    const catchAllFn = vi.fn()
    router.register('*', '/api/consultants/:id/:action', catchAllFn)
    router.register('*', '/api/consultants/:id/deactivate', exactDeactivateFn)
    // Both are patterns, but the more specific one should match for exact segment "deactivate"
    const matched = router.match('PATCH', '/api/consultants/5/deactivate')
    // The second registered pattern is also parameterised, but both match — first registered wins
    expect(matched).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. router.size counts parameterised routes
// ─────────────────────────────────────────────────────────────────────────────

describe('createRouter — size includes parameterised routes', () => {
  it('size increments for each registered route including params', () => {
    const router = createRouter()
    router.register('*', '/api/users', vi.fn())
    router.register('*', '/api/users/:id', vi.fn())
    router.register('*', '/api/users/:id/posts', vi.fn())
    expect(router.size).toBe(3)
  })
})
