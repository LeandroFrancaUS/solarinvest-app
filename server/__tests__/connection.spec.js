import { afterEach, describe, expect, it } from 'vitest'
import {
  getCanonicalDatabaseConnection,
  getCanonicalDatabaseDiagnostics,
  getCanonicalDirectDatabaseConnection,
} from '../database/connection.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('canonical database connection resolution', () => {
  it('prioritizes DATABASE_URL over legacy keys', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db-primary.neon.tech/main'
    process.env.NEON_DATABASE_URL = 'postgres://user:pass@db-legacy.neon.tech/legacy'

    const result = getCanonicalDatabaseConnection()
    expect(result.source).toBe('DATABASE_URL')
    expect(result.connectionString).toContain('db-primary.neon.tech')
  })

  it('falls back to unpooled env for direct connection', () => {
    process.env.DATABASE_URL_UNPOOLED = 'postgres://user:pass@db-direct.neon.tech/main'

    const result = getCanonicalDirectDatabaseConnection()
    expect(result.source).toBe('DATABASE_URL_UNPOOLED')
    expect(result.connectionString).toContain('db-direct.neon.tech')
  })

  it('returns safe diagnostics without exposing credentials', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db-observability.neon.tech/appdb'
    process.env.NEON_DEFAULT_SCHEMA = 'crm'

    const diagnostics = getCanonicalDatabaseDiagnostics()
    expect(diagnostics.host).toBe('db-observability.neon.tech')
    expect(diagnostics.database).toBe('appdb')
    expect(diagnostics.schema).toBe('crm')
    expect(diagnostics.source).toBe('DATABASE_URL')
  })
})
