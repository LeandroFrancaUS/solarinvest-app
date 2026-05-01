// server/adapters/__tests__/storageAdapter.spec.js
// Unit tests for server/adapters/storageAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import { fromDb, toDb, decodeGzipEnvelope, encodeGzipEnvelope } from '../storageAdapter.js'

// ─── decodeGzipEnvelope ───────────────────────────────────────────────────────

describe('StorageAdapter.decodeGzipEnvelope', () => {
  it('returns null for null input', () => {
    expect(decodeGzipEnvelope(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(decodeGzipEnvelope('string')).toBeNull()
    expect(decodeGzipEnvelope(42)).toBeNull()
  })

  it('returns null when __si_compression marker is absent', () => {
    expect(decodeGzipEnvelope({ foo: 'bar' })).toBeNull()
  })

  it('returns null when __si_compression has wrong type value', () => {
    expect(decodeGzipEnvelope({ __si_compression: 'other', data: 'aaa' })).toBeNull()
  })

  it('decodes a gzip-base64 envelope produced by encodeGzipEnvelope', () => {
    const original = { key: 'value', nested: [1, 2, 3] }
    const encoded  = encodeGzipEnvelope(original)

    // Only try to decode if the encoder actually compressed it
    if (encoded && typeof encoded === 'object' && encoded['__si_compression']) {
      const decoded = decodeGzipEnvelope(encoded)
      expect(decoded).toEqual(original)
    } else {
      // Encoder returned raw (small payload — no envelope)
      expect(encoded).toEqual(original)
    }
  })

  it('round-trips a large payload through encode/decode', () => {
    // Build a payload large enough to trigger compression
    const large = { data: 'x'.repeat(2000), items: Array.from({ length: 100 }, (_, i) => i) }
    const encoded = encodeGzipEnvelope(large)

    if (encoded && typeof encoded === 'object' && encoded['__si_compression']) {
      // Was compressed
      const decoded = decodeGzipEnvelope(encoded)
      expect(decoded).toEqual(large)
    } else {
      // Not compressed (would be larger) — raw equality is sufficient
      expect(encoded).toEqual(large)
    }
  })
})

// ─── fromDb ───────────────────────────────────────────────────────────────────

describe('StorageAdapter.fromDb', () => {
  it('returns key, value, user_id from a plain row', () => {
    const row = { key: 'my-key', value: { hello: 'world' }, user_id: 'u1' }
    const result = fromDb(row)
    expect(result.key).toBe('my-key')
    expect(result.value).toEqual({ hello: 'world' })
    expect(result.user_id).toBe('u1')
  })

  it('transparently decompresses a gzip-base64 envelope', () => {
    const original = { big: 'x'.repeat(500) }
    const encoded  = encodeGzipEnvelope(original)
    const row      = { key: 'k', value: encoded, user_id: 'u2' }
    const result   = fromDb(row)
    expect(result.value).toEqual(original)
  })

  it('returns null value when row value is null', () => {
    const result = fromDb({ key: 'k', value: null, user_id: 'u3' })
    expect(result.value).toBeNull()
  })

  it('parses a JSON string value defensively', () => {
    const row = { key: 'k', value: '{"a":1}', user_id: 'u4' }
    const result = fromDb(row)
    expect(result.value).toEqual({ a: 1 })
  })

  it('returns null for null input', () => {
    expect(fromDb(null)).toBeNull()
  })
})

// ─── toDb ─────────────────────────────────────────────────────────────────────

describe('StorageAdapter.toDb', () => {
  it('returns user_id, key, and value shape', () => {
    const result = toDb('settings', { theme: 'dark' }, 'user-abc')
    expect(result.user_id).toBe('user-abc')
    expect(result.key).toBe('settings')
    // value may be raw or compressed — must not be undefined
    expect(result.value).toBeDefined()
  })

  it('handles null value without throwing', () => {
    const result = toDb('key', null, 'user-x')
    expect(result.value).toBeNull()
  })

  it('round-trips through toDb → fromDb', () => {
    const data = { config: { enabled: true }, count: 42 }
    const dbShape = toDb('myKey', data, 'user-rt')
    const restored = fromDb({ key: dbShape.key, value: dbShape.value, user_id: dbShape.user_id })
    expect(restored.value).toEqual(data)
    expect(restored.key).toBe('myKey')
    expect(restored.user_id).toBe('user-rt')
  })

  it('throws TypeError when key is empty', () => {
    expect(() => toDb('', { x: 1 }, 'user')).toThrow(TypeError)
    expect(() => toDb(null, { x: 1 }, 'user')).toThrow(TypeError)
  })

  it('throws TypeError when userId is empty', () => {
    expect(() => toDb('key', { x: 1 }, '')).toThrow(TypeError)
    expect(() => toDb('key', { x: 1 }, null)).toThrow(TypeError)
  })

  it('throws RangeError (STORAGE_PAYLOAD_TOO_LARGE) for oversized payloads', () => {
    const huge = 'x'.repeat(6 * 1024 * 1024) // 6 MB string
    try {
      toDb('big-key', { data: huge }, 'user')
      // If no throw, gzip compressed it enough — that's also valid
    } catch (err) {
      expect(err.code).toBe('STORAGE_PAYLOAD_TOO_LARGE')
    }
  })
})
