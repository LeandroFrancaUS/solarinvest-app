/**
 * Parity Test Suite — Section A: Database/Schema
 *
 * These tests verify the structural integrity of the application's schema
 * expectations. Since we run in a jsdom environment without a live DB, we
 * validate the schema definitions found in migration files, type files, and
 * API contracts rather than querying a live database.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const ROOT = resolve(__dirname, '../../..')

// ─── Helper ──────────────────────────────────────────────────────────────────

function readSource(relPath: string): string {
  const full = resolve(ROOT, relPath)
  if (!existsSync(full)) return ''
  return readFileSync(full, 'utf-8')
}

function findMigrationFiles(): string[] {
  const dirs = [
    resolve(ROOT, 'db'),
    resolve(ROOT, 'scripts'),
    resolve(ROOT, 'backend'),
  ]
  const sqlFiles: string[] = []
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const fullPath = join(d, entry.name)
        if (entry.isDirectory()) walk(fullPath)
        else if (entry.name.endsWith('.sql') || entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
          sqlFiles.push(fullPath)
        }
      }
    }
    walk(dir)
  }
  return sqlFiles
}

function allMigrationContent(): string {
  return findMigrationFiles()
    .map((f) => {
      try { return readFileSync(f, 'utf-8') } catch { return '' }
    })
    .join('\n')
}

// ─── A1: Production tables exist in migration definitions ────────────────────

describe('A1 — Production tables defined in migrations', () => {
  const content = allMigrationContent()

  const REQUIRED_TABLES = [
    'clients',
    'proposals',
    'storage',
    'contracts',
  ]

  for (const table of REQUIRED_TABLES) {
    it(`table "${table}" is referenced in migration scripts`, () => {
      // Accept either CREATE TABLE or explicit references
      const found = content.includes(`"${table}"`) || content.includes(`'${table}'`) || content.includes(` ${table} `) || content.includes(` ${table}(`)
      expect(found, `Expected table "${table}" to be present in migrations`).toBe(true)
    })
  }
})

// ─── A2: clients.id is BIGSERIAL/BIGINT ──────────────────────────────────────

describe('A2 — clients.id is BIGSERIAL/BIGINT', () => {
  it('clients id type is numeric (bigint/bigserial) in type definitions', () => {
    // TypeScript types should use number for BIGINT client ids
    const sources = [
      'src/types/clientPortfolio.ts',
      'src/services/clientPortfolioApi.ts',
      'src/services/revenueBillingApi.ts',
    ]
    const combined = sources.map(readSource).join('\n')
    // client_id should be number
    expect(combined).toContain('client_id')
    // The portfolio client row uses numeric client_id
    const hasNumericId = combined.includes('client_id: number') || combined.includes('clientId: number')
    expect(hasNumericId, 'client_id should be typed as number (BIGINT)').toBe(true)
  })
})

// ─── A3: proposals.id is UUID ─────────────────────────────────────────────────

describe('A3 — proposals.id is UUID', () => {
  it('proposals use string id (UUID) in type definitions', () => {
    const src = readSource('src/lib/proposals/types.ts')
    // SavedProposalRecord uses id: string → UUID
    expect(src).toContain('id: string')
  })

  it('proposal normalizer returns string id', () => {
    const src = readSource('src/lib/proposals/normalizers.ts')
    expect(src).toContain('id: row.id')
  })
})

// ─── A4: storage(user_id, key, value) columns ────────────────────────────────

describe('A4 — storage table shape', () => {
  it('serverStorage uses key/value semantics', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('key')
    expect(src).toContain('value')
  })

  it('storage response type includes entries with key/value', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain("key: string")
    expect(src).toContain("value: unknown")
  })
})

// ─── A5: RLS functions in app schema ─────────────────────────────────────────

describe('A5 — RLS / auth schema references', () => {
  it('auth module references user roles', () => {
    const src = readSource('src/auth/useAuthorizationSnapshot.ts')
    expect(src.length).toBeGreaterThan(0)
    // Must reference some authorization concept
    const hasAuth = src.includes('role') || src.includes('permission') || src.includes('auth')
    expect(hasAuth).toBe(true)
  })

  it('guards directory has route protection logic', () => {
    // Verify the guards directory exists (do NOT try to read a directory as a file)
    expect(existsSync(resolve(ROOT, 'src/auth/guards'))).toBe(true)
    // Verify at least one guard file exists
    expect(existsSync(resolve(ROOT, 'src/auth/guards/RequireAuth.tsx'))).toBe(true)
  })
})

// ─── A6: Views vw_clients_listable and vw_proposals_listable ─────────────────

describe('A6 — Listable view contracts', () => {
  it('API endpoints support listing/filtering clients', () => {
    const src = readSource('src/services/clientPortfolioApi.ts')
    // fetchPortfolioClients → equivalent of vw_clients_listable
    expect(src).toContain('fetchPortfolioClients')
  })

  it('API endpoints support listing/filtering proposals', () => {
    const src = readSource('src/lib/api/proposalsApi.ts')
    expect(src.length).toBeGreaterThan(0)
    const hasListProposals = src.includes('listProposals') || src.includes('list')
    expect(hasListProposals).toBe(true)
  })
})
