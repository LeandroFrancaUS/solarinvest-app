import { createUserScopedSql } from './withRLSContext.js'
import { gunzipSync, gzipSync } from 'node:zlib'

const DEFAULT_USER_ID = 'default'
const MAX_STORAGE_VALUE_BYTES = 5 * 1024 * 1024
const STORAGE_COMPRESSION_MARKER = '__si_compression'
const STORAGE_COMPRESSION_TYPE = 'gzip-base64'
const STORAGE_COMPRESSION_DATA_KEY = 'data'

function getUtf8Bytes(value) {
  return Buffer.byteLength(value, 'utf8')
}

function decodeCompressedEnvelope(raw) {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  if (raw[STORAGE_COMPRESSION_MARKER] !== STORAGE_COMPRESSION_TYPE) {
    return null
  }
  const data = raw[STORAGE_COMPRESSION_DATA_KEY]
  if (typeof data !== 'string' || data.length === 0) {
    return null
  }

  try {
    const gunzipped = gunzipSync(Buffer.from(data, 'base64')).toString('utf8')
    return JSON.parse(gunzipped)
  } catch {
    return null
  }
}

function encodeCompressedEnvelope(raw) {
  const json = JSON.stringify(raw)
  if (!json) {
    return raw
  }

  try {
    const compressedBase64 = gzipSync(Buffer.from(json, 'utf8')).toString('base64')
    const envelope = {
      [STORAGE_COMPRESSION_MARKER]: STORAGE_COMPRESSION_TYPE,
      [STORAGE_COMPRESSION_DATA_KEY]: compressedBase64,
    }
    return JSON.stringify(envelope).length < json.length ? envelope : raw
  } catch {
    return raw
  }
}

function normalizeJsonValue(raw) {
  if (raw === null || raw === undefined) {
    return null
  }
  if (typeof raw === 'object') {
    const decoded = decodeCompressedEnvelope(raw)
    if (decoded !== null) {
      return decoded
    }
    return raw
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (error) {
      return raw
    }
  }
  return raw
}

export class StorageService {
  constructor(sql) {
    this.sql = sql
    this.initialized = false
  }

  async ensureInitialized() {
    if (this.initialized) {
      return
    }

    try {
      // Check whether the storage table already exists before attempting DDL.
      // In production the DB role typically lacks CREATE TABLE privilege (DDL is
      // handled by migrations), so issuing CREATE TABLE would throw 42501 and used
      // to permanently disable storage even though the table already existed.
      const [tableCheck] = await this.sql`
        SELECT to_regclass('public.storage') AS table_name
      `
      const tableExists = Boolean(tableCheck?.table_name)

      if (!tableExists) {
        // Table absent — try to create it (succeeds in dev / environments where
        // the DB role has DDL rights; the table should be created by migration
        // 0038 before this code path is needed in production).
        await this.sql`
          CREATE TABLE IF NOT EXISTS storage (
            id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            user_id TEXT NOT NULL,
            "key" TEXT NOT NULL,
            value JSONB,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            UNIQUE (user_id, "key")
          )
        `
      }

      await this.migrateLegacyStorage()

      this.initialized = true
    } catch (err) {
      // Log and rethrow — the next request will retry initialization.
      // Do NOT set a permanent failure flag; the service must self-heal once the
      // database is reachable / the table is available.
      const code = err?.code ?? null
      const message = err instanceof Error ? err.message : String(err)
      if (code === '42501' || message.includes('permission denied')) {
        console.warn('[storage] init warning — permission denied during initialization; will retry on next request', {
          code,
          message,
        })
      }
      throw err
    }
  }

  async migrateLegacyStorage() {
    const [legacyTable] = await this.sql`
      SELECT to_regclass('public.app_storage') AS table_name
    `

    if (!legacyTable || !legacyTable.table_name) {
      return
    }

    const legacyRows = await this.sql`
      SELECT user_id, storage_key AS "key", storage_value AS value
        FROM app_storage
    `

    if (legacyRows.length === 0) {
      return
    }

    for (const row of legacyRows) {
      const normalizedValue = normalizeJsonValue(row.value)
      const serializedValue =
        normalizedValue === null ? null : JSON.stringify(normalizedValue)

      await this.sql`
        INSERT INTO storage (user_id, "key", value, created_at, updated_at)
        VALUES (
          ${this.resolveUserId(row.user_id)},
          ${row.key},
          ${serializedValue}::jsonb,
          now(),
          now()
        )
        ON CONFLICT (user_id, "key")
        DO NOTHING
      `
    }
  }

  resolveUserId(raw) {
    const value = typeof raw === 'string' ? raw.trim() : ''
    return value || DEFAULT_USER_ID
  }

  resolveRlsContext(context) {
    const userId = typeof context?.userId === 'string' ? context.userId.trim() : ''
    const userRole = typeof context?.userRole === 'string' ? context.userRole.trim() : ''
    if (!userId) {
      const error = new Error('RLS_CONTEXT_MISSING_USER_ID')
      error.code = 'RLS_CONTEXT_MISSING_USER_ID'
      throw error
    }
    if (!userRole) {
      const error = new Error('RLS_CONTEXT_MISSING_INTERNAL_ROLE')
      error.code = 'RLS_CONTEXT_MISSING_INTERNAL_ROLE'
      throw error
    }
    return { userId, userRole }
  }

  async listEntries(context) {
    await this.ensureInitialized()
    const { userId, userRole } = this.resolveRlsContext(context)
    const scopedSql = createUserScopedSql(this.sql, { userId, role: userRole })

    const rows = await scopedSql`
      SELECT "key" AS key, value
        FROM storage
       WHERE user_id = ${userId}
       ORDER BY "key" ASC
    `

    if (rows.length > 0) {
      return rows.map((row) => ({ key: row.key, value: normalizeJsonValue(row.value) }))
    }

    const legacyRows = await this.loadLegacyEntries(userId, scopedSql)

    return legacyRows.map((row) => ({ key: row.key, value: normalizeJsonValue(row.value) }))
  }

  async loadLegacyEntries(userId, scopedSql) {
    const sql = scopedSql ?? this.sql
    // The `to_regclass` check is a DDL / catalog query; it carries no user data
    // and is intentionally run with the raw (non-scoped) sql to avoid RLS
    // interfering with the metadata lookup.
    const [legacyTable] = await this.sql`
      SELECT to_regclass('public.app_storage') AS table_name
    `

    if (!legacyTable || !legacyTable.table_name) {
      return []
    }

    const rows = await sql`
      SELECT "key" AS key, value
        FROM app_storage
       WHERE user_id = ${userId}
       ORDER BY "key" ASC
    `

    return rows
  }

  async setEntry(context, key, value) {
    if (!key) {
      throw new Error('Storage key ausente')
    }

    await this.ensureInitialized()
    const { userId, userRole } = this.resolveRlsContext(context)
    const normalizedValue = value === undefined ? null : value
    const compressedValue = normalizedValue === null ? null : encodeCompressedEnvelope(normalizedValue)
    const serializedValue = compressedValue === null ? null : JSON.stringify(compressedValue)
    if (serializedValue && getUtf8Bytes(serializedValue) > MAX_STORAGE_VALUE_BYTES) {
      const error = new Error('STORAGE_PAYLOAD_TOO_LARGE')
      error.code = 'STORAGE_PAYLOAD_TOO_LARGE'
      throw error
    }
    const scopedSql = createUserScopedSql(this.sql, { userId, role: userRole })

    await scopedSql`
      INSERT INTO storage (user_id, "key", value, updated_at)
      VALUES (${userId}, ${key}, ${serializedValue}::jsonb, now())
      ON CONFLICT (user_id, "key")
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `
  }

  async removeEntry(context, key) {
    if (!key) {
      throw new Error('Storage key ausente')
    }

    await this.ensureInitialized()
    const { userId, userRole } = this.resolveRlsContext(context)
    const scopedSql = createUserScopedSql(this.sql, { userId, role: userRole })

    await scopedSql`
      DELETE FROM storage
      WHERE user_id = ${userId}
        AND "key" = ${key}
    `
  }

  async clear(context) {
    await this.ensureInitialized()
    const { userId, userRole } = this.resolveRlsContext(context)
    const scopedSql = createUserScopedSql(this.sql, { userId, role: userRole })

    await scopedSql`
      DELETE FROM storage
      WHERE user_id = ${userId}
    `
  }
}
