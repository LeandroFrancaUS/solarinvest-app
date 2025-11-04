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

    this.initialized = true
  }

  resolveUserId(raw) {
    const value = typeof raw === 'string' ? raw.trim() : ''
    return value || DEFAULT_USER_ID
  }

  async listEntries(userId) {
    await this.ensureInitialized()
    const rows = await this.sql`
      SELECT "key" AS key, value
        FROM storage
       WHERE user_id = ${this.resolveUserId(userId)}
       ORDER BY "key" ASC
    `

    return rows.map((row) => ({ key: row.key, value: normalizeJsonValue(row.value) }))
  }

  async setEntry(userId, key, value) {
    if (!key) {
      throw new Error('Storage key ausente')
    }

    await this.ensureInitialized()
    const normalizedValue = value === undefined ? null : value
    const serializedValue = normalizedValue === null ? null : JSON.stringify(normalizedValue)

    await this.sql`
      INSERT INTO storage (user_id, "key", value, updated_at)
      VALUES (${this.resolveUserId(userId)}, ${key}, ${serializedValue}::jsonb, now())
      ON CONFLICT (user_id, "key")
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `
  }

  async removeEntry(userId, key) {
    if (!key) {
      throw new Error('Storage key ausente')
    }

    await this.ensureInitialized()
    await this.sql`
      DELETE FROM storage
      WHERE user_id = ${this.resolveUserId(userId)}
        AND "key" = ${key}
    `
  }

  async clear(userId) {
    await this.ensureInitialized()
    await this.sql`
      DELETE FROM storage
      WHERE user_id = ${this.resolveUserId(userId)}
    `
  }
}
