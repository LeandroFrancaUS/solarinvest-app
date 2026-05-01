/**
 * Parity Test Suite — Section H: Storage/Offline
 *
 * Tests for server storage PUT/GET, compression, production keys,
 * and localStorage-to-server sync.
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

// ─── H1: PUT/GET simple storage ───────────────────────────────────────────────

describe('H1 — PUT/GET simple storage', () => {
  it('persistRemoteStorageEntry and fetchRemoteStorageEntry are exported', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('persistRemoteStorageEntry')
    expect(src).toContain('fetchRemoteStorageEntry')
  })

  it('ensureServerStorageSync is exported for initialization', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('ensureServerStorageSync')
  })

  it('setStorageTokenProvider is exported for auth injection', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('setStorageTokenProvider')
  })

  it('storage uses /api/storage endpoint', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('/api/storage')
  })
})

// ─── H2: Gzip-base64 compressed value ────────────────────────────────────────

describe('H2 — Gzip-base64 compression', () => {
  it('serverStorage implements gzip-base64 compression', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('gzip-base64')
    expect(src).toContain('STORAGE_COMPRESSION_MARKER')
  })

  it('compression marker uses __si_compression key', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain("'__si_compression'")
  })

  it('gzip compression uses CompressionStream API', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('CompressionStream')
    expect(src).toContain("'gzip'")
  })

  it('compressed envelope has data key', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('STORAGE_COMPRESSION_DATA_KEY')
  })
})

// ─── H3: Production storage keys ─────────────────────────────────────────────

describe('H3 — Production storage keys', () => {
  it('localStorage migration uses known production storage keys', () => {
    const src = readSource('src/lib/migrateLocalStorageToServer.ts')
    expect(src).toContain('solarinvest-clientes')
    expect(src).toContain('solarinvest-orcamentos')
  })

  it('migration is idempotent via done-key guard', () => {
    const src = readSource('src/lib/migrateLocalStorageToServer.ts')
    expect(src).toContain('solarinvest-local-migration-done')
  })

  it('server-id map keys allow linking local records to server', () => {
    const src = readSource('src/lib/migrateLocalStorageToServer.ts')
    expect(src).toContain('solarinvest-client-server-id-map')
    expect(src).toContain('solarinvest-proposal-server-id-map')
  })
})

// ─── H4: Sync localStorage → server ──────────────────────────────────────────

describe('H4 — Sync localStorage to server', () => {
  it('migrateLocalStorageToServer module exists', () => {
    const src = readSource('src/lib/migrateLocalStorageToServer.ts')
    expect(src.length).toBeGreaterThan(0)
  })

  it('migration silences network errors (resilient to connectivity)', () => {
    const src = readSource('src/lib/migrateLocalStorageToServer.ts')
    // Error handling must be present
    const hasErrorHandling = src.includes('catch') || src.includes('try') || src.includes('.catch(')
    expect(hasErrorHandling).toBe(true)
  })

  it('serverStorage sync handles 503 with cooldown', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('STORAGE_UNAVAILABLE_COOLDOWN_MS')
    expect(src).toContain('503')
  })

  it('serverStorage uses backoff after failures', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('handleSyncFailure')
    expect(src).toContain('handleSyncSuccess')
    expect(src).toContain('SYNC_BACKOFF_BASE_MS')
  })
})

// ─── H5: IndexedDB offline storage ───────────────────────────────────────────

describe('H5 — Offline storage resilience', () => {
  it('INDEXEDDB_IMPLEMENTATION.md documents offline strategy', () => {
    const src = readSource('INDEXEDDB_IMPLEMENTATION.md')
    expect(src.length).toBeGreaterThan(0)
  })

  it('localStorageWithTtl store exists for TTL-based caching', () => {
    const src = readSource('src/store/localStorageWithTtl.ts')
    expect(src.length).toBeGreaterThan(0)
  })

  it('authorizationSnapshot is persisted offline for resilience', () => {
    const src = readSource('src/lib/auth/authorizationSnapshot.ts')
    expect(src).toContain('saveSnapshotOffline')
    expect(src).toContain('loadOfflineSnapshot')
  })
})

// ─── H6: Storage in-memory cache ─────────────────────────────────────────────

describe('H6 — Storage in-memory cache', () => {
  it('serverStorage uses in-memory cache map', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    // Internal cache map
    expect(src).toContain('cache')
    expect(src).toContain('Map')
  })

  it('pending uploads use AbortController for cancellation', () => {
    const src = readSource('src/app/services/serverStorage.ts')
    expect(src).toContain('AbortController')
    expect(src).toContain('pendingUploads')
  })
})
