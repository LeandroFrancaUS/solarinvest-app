// server/adapters/storageAdapter.js
//
// Compatibility adapter: app key/value ↔ production storage table.
//
// Production schema (migration 0038):
//   storage (id, user_id TEXT, key TEXT, value JSONB, created_at, updated_at)
//   UNIQUE (user_id, key)
//
// Gzip-base64 envelope format (same as storageService.js — logic duplicated here
// to keep this module self-contained without modifying the existing service):
//   { "__si_compression": "gzip-base64", "data": "<base64>" }
//
// No soft-delete: storage rows use hard DELETE by design.
// This module is a PURE DATA-MAPPING layer — no DB access.

import { gunzipSync, gzipSync } from 'node:zlib'

const COMPRESSION_MARKER = '__si_compression'
const COMPRESSION_TYPE   = 'gzip-base64'
const COMPRESSION_DATA   = 'data'
const MAX_VALUE_BYTES     = 5 * 1024 * 1024

/**
 * Attempt to decode a gzip-base64 envelope stored in production.
 * Returns the decompressed value or null if the envelope is not present.
 *
 * @param {unknown} raw - Value from the DB row (JSONB parsed object or string)
 * @returns {unknown|null} Decoded value or null if not a compressed envelope
 */
export function decodeGzipEnvelope(raw) {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  if (raw[COMPRESSION_MARKER] !== COMPRESSION_TYPE) {
    return null
  }
  const data = raw[COMPRESSION_DATA]
  if (typeof data !== 'string' || data.length === 0) {
    return null
  }
  try {
    const decompressed = gunzipSync(Buffer.from(data, 'base64')).toString('utf8')
    return JSON.parse(decompressed)
  } catch {
    return null
  }
}

/**
 * Attempt to encode a value as a gzip-base64 envelope.
 * Returns the compressed envelope if it's smaller than the JSON representation;
 * otherwise returns the raw value unchanged.
 *
 * @param {unknown} raw - Value to potentially compress
 * @returns {unknown} Compressed envelope or original value
 */
export function encodeGzipEnvelope(raw) {
  const json = JSON.stringify(raw)
  if (!json) {
    return raw
  }
  try {
    const compressedBase64 = gzipSync(Buffer.from(json, 'utf8')).toString('base64')
    const envelope = {
      [COMPRESSION_MARKER]: COMPRESSION_TYPE,
      [COMPRESSION_DATA]:   compressedBase64,
    }
    return JSON.stringify(envelope).length < json.length ? envelope : raw
  } catch {
    return raw
  }
}

/**
 * Map a production storage row to the normalized app model.
 * Transparently decompresses gzip-base64 envelopes.
 *
 * @param {object} row - Raw row from the storage table
 * @returns {{ key: string, value: unknown, user_id: string }}
 */
export function fromDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  let value = row.value ?? null
  // Decompress envelope if present
  if (value && typeof value === 'object') {
    const decoded = decodeGzipEnvelope(value)
    if (decoded !== null) {
      value = decoded
    }
  }
  // Handle stringified JSON (defensive)
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      // keep raw string
    }
  }

  return {
    key:     row.key     ?? null,
    value,
    user_id: row.user_id ?? null,
  }
}

/**
 * Map app key/value to a DB INSERT/UPSERT shape.
 * Validates user_id, compresses the value, and enforces the size limit.
 *
 * @param {string} key    - Storage key (preserved exactly — production keys must not change)
 * @param {unknown} value - Value to store
 * @param {string} userId - user_id (must not be empty)
 * @returns {{ user_id: string, key: string, value: unknown }} DB upsert shape
 * @throws {TypeError} if key or userId is empty
 * @throws {RangeError} if the serialized value exceeds the 5 MB limit
 */
export function toDb(key, value, userId) {
  if (!key || typeof key !== 'string') {
    throw new TypeError('StorageAdapter.toDb: key must be a non-empty string')
  }
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('StorageAdapter.toDb: userId must be a non-empty string')
  }

  const normalizedValue = value === undefined ? null : value
  const compressedValue = normalizedValue === null ? null : encodeGzipEnvelope(normalizedValue)
  const serialized      = compressedValue === null ? null : JSON.stringify(compressedValue)

  if (serialized) {
    const bytes = Buffer.byteLength(serialized, 'utf8')
    if (bytes > MAX_VALUE_BYTES) {
      const err = new RangeError(`StorageAdapter.toDb: value for key "${key}" exceeds ${MAX_VALUE_BYTES} byte limit (${bytes} bytes)`)
      err.code = 'STORAGE_PAYLOAD_TOO_LARGE'
      throw err
    }
  }

  return {
    user_id: userId,
    key,
    value: compressedValue,
  }
}
