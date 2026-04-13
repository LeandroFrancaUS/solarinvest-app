import { afterEach, describe, expect, it } from 'vitest'
import { getDatabaseConfig, getDirectDatabaseUrl } from '../database/getDatabaseConfig.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('getDatabaseConfig', () => {
  it('uses DATABASE_URL as the primary app connection', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db-primary.neon.tech/app'
    process.env.DATABASE_URL_UNPOOLED = 'postgres://user:pass@db-direct.neon.tech/app'

    const config = getDatabaseConfig()
    expect(config.connectionString).toContain('db-primary.neon.tech')
    expect(config.isPooled).toBe(false)
    expect(config.hasPrimaryUrl).toBe(true)
    expect(config.hasDirectUrl).toBe(true)
  })

  it('falls back to legacy PG* vars only when primary URL is absent', () => {
    delete process.env.DATABASE_URL
    delete process.env.NEON_DATABASE_URL
    delete process.env.NEON_POSTGRESQL_URL
    delete process.env.PGURI
    process.env.PGHOST = 'legacy-host.neon.tech'
    process.env.PGDATABASE = 'legacydb'
    process.env.PGUSER = 'legacy_user'
    process.env.PGPASSWORD = 'legacy_pass'
    process.env.PGPORT = '5432'

    const config = getDatabaseConfig()
    expect(config.source).toContain('legacy-fallback')
    expect(config.connectionString).toContain('legacy-host.neon.tech')
    expect(config.hasPrimaryUrl).toBe(false)
    expect(config.hasLegacyParts).toBe(true)
  })

  it('returns direct url only for explicit direct usage', () => {
    process.env.DATABASE_URL_UNPOOLED = 'postgres://user:pass@db-direct.neon.tech/app'

    expect(getDirectDatabaseUrl()).toContain('db-direct.neon.tech')
  })
})
