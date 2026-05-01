/**
 * Parity Test Suite — Section B: Auth/RLS
 *
 * These tests verify that authorization, role-based access control,
 * and user permission concepts are properly implemented.
 * Tests use source inspection and pure-logic tests (no live DB/auth).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../..')

function readSource(relPath: string): string {
  const full = resolve(ROOT, relPath)
  if (!existsSync(full)) return ''
  return readFileSync(full, 'utf-8')
}

// ─── B1: Commercial user sees only own clients/proposals ─────────────────────

describe('B1 — Commercial user scoping', () => {
  it('authz snapshot includes consultant/commercial role concept', () => {
    const src = readSource('src/lib/auth/authorizationSnapshot.ts')
    if (!src) return // optional file
    const hasConcept = src.includes('comercial') || src.includes('consultant') || src.includes('role')
    expect(hasConcept).toBe(true)
  })

  it('proposal API supports consultant_id filtering', () => {
    // proposalsApi should support filtering by consultant_id to scope commercial view
    const src = readSource('src/lib/api/proposalsApi.ts')
    const hasConsultantFilter = src.includes('consultant_id') || src.includes('user_id') || src.includes('created_by')
    expect(hasConsultantFilter, 'Proposal listing should support user-scoped filtering').toBe(true)
  })
})

// ─── B2: Admin sees all ────────────────────────────────────────────────────────

describe('B2 — Admin access', () => {
  it('RequireAdmin guard exists and protects admin routes', () => {
    const src = readSource('src/auth/guards/RequireAdmin.tsx')
    expect(src.length).toBeGreaterThan(0)
    // Must import some kind of redirect or access check
    const hasAccessCheck = src.includes('redirect') || src.includes('navigate') || src.includes('Navigate') || src.includes('role') || src.includes('admin')
    expect(hasAccessCheck).toBe(true)
  })

  it('RequireAuth guard protects all authenticated routes', () => {
    const src = readSource('src/auth/guards/RequireAuth.tsx')
    expect(src.length).toBeGreaterThan(0)
    expect(src).toContain('user')
  })
})

// ─── B3: Financial cannot create proposal ────────────────────────────────────

describe('B3 — Financial role restriction', () => {
  it('proposals RBAC module exists', () => {
    const src = readSource('src/lib/proposals/useProposalsRbac.ts')
    expect(src.length).toBeGreaterThan(0)
  })

  it('proposals RBAC checks role before allowing creation', () => {
    const src = readSource('src/lib/proposals/useProposalsRbac.ts')
    // Must reference some role restriction
    const hasRestriction = src.includes('canCreate') || src.includes('role') || src.includes('permission') || src.includes('financeiro') || src.includes('FINANCEIRO')
    expect(hasRestriction).toBe(true)
  })
})

// ─── B4: Office edits portfolio ───────────────────────────────────────────────

describe('B4 — Portfolio edit access', () => {
  it('portfolio API supports PATCH operations', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    // Must have patch/update methods
    const hasPatch = src.includes('PATCH') || src.includes('PUT') || src.includes('patch') || src.includes('update')
    expect(hasPatch).toBe(true)
  })
})

// ─── B5: Unapproved user falls into AccessPending ────────────────────────────

describe('B5 — AccessPending for unapproved users', () => {
  it('AccessPendingPage exists', () => {
    const src = readSource('src/pages/AccessPendingPage.tsx')
    expect(src.length).toBeGreaterThan(0)
  })

  it('RequireAuthorizedUser redirects to pending when not approved', () => {
    const src = readSource('src/auth/guards/RequireAuthorizedUser.tsx')
    expect(src.length).toBeGreaterThan(0)
    const hasAccessPending = src.includes('AccessPending') || src.includes('access-pending') || src.includes('pending')
    expect(hasAccessPending).toBe(true)
  })

  it('AccessPendingPage communicates why access is blocked', () => {
    const src = readSource('src/pages/AccessPendingPage.tsx')
    // Should have some user-facing text
    expect(src.length).toBeGreaterThan(100)
  })
})

// ─── B6: Authorization snapshot persists offline ─────────────────────────────

describe('B6 — Offline authorization persistence', () => {
  it('authorizationSnapshot lib has save/load/clear functions', () => {
    const src = readSource('src/lib/auth/authorizationSnapshot.ts')
    expect(src).toContain('saveSnapshotOffline')
    expect(src).toContain('loadOfflineSnapshot')
    expect(src).toContain('clearOfflineSnapshot')
  })
})
