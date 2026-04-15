import { createUserScopedSql } from './withRLSContext.js'

const DEFAULT_USER_ID = 'default'

function normalizeJsonValue(raw) {
  if (raw === null || raw === undefined) {
    return null
  }
  if (typeof raw === 'object') {
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

    await this.migrateLegacyStorage()

    this.initialized = true
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
    const serializedValue = normalizedValue === null ? null : JSON.stringify(normalizedValue)
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
