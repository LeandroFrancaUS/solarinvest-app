const DEFAULT_USER_ID = 'default'

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
      CREATE TABLE IF NOT EXISTS app_storage (
        user_id text NOT NULL DEFAULT 'default',
        storage_key text NOT NULL,
        storage_value text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, storage_key)
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
      SELECT storage_key, storage_value
        FROM app_storage
       WHERE user_id = ${this.resolveUserId(userId)}
       ORDER BY storage_key ASC
    `

    return rows.map((row) => ({ key: row.storage_key, value: row.storage_value }))
  }

  async setEntry(userId, key, value) {
    if (!key) {
      throw new Error('Storage key ausente')
    }

    await this.ensureInitialized()
    await this.sql`
      INSERT INTO app_storage (user_id, storage_key, storage_value, updated_at)
      VALUES (${this.resolveUserId(userId)}, ${key}, ${value}, now())
      ON CONFLICT (user_id, storage_key)
      DO UPDATE SET storage_value = EXCLUDED.storage_value, updated_at = now()
    `
  }

  async removeEntry(userId, key) {
    if (!key) {
      throw new Error('Storage key ausente')
    }

    await this.ensureInitialized()
    await this.sql`
      DELETE FROM app_storage
      WHERE user_id = ${this.resolveUserId(userId)}
        AND storage_key = ${key}
    `
  }

  async clear(userId) {
    await this.ensureInitialized()
    await this.sql`
      DELETE FROM app_storage
      WHERE user_id = ${this.resolveUserId(userId)}
    `
  }
}
