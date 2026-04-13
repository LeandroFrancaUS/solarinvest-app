import { getCanonicalDatabaseConnection, getCanonicalDirectDatabaseConnection } from './connection.js'

function parseInteger(value, fallback) {
  if (value == null) {
    return fallback
  }

  const parsed = Number.parseInt(String(value).trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Derives the direct (unpooled) Neon connection string from a pooler URL by
 * removing the "-pooler" suffix from the hostname.
 *
 * Neon pooler endpoint: ep-xxx-pooler.region.aws.neon.tech
 * Neon direct endpoint: ep-xxx.region.aws.neon.tech
 *
 * The Neon HTTP driver's sql.transaction() is more reliable on the direct
 * endpoint.  When DATABASE_URL_UNPOOLED is not configured, this derivation
 * provides an automatic fallback.
 *
 * @param {string} connStr  - pooler or direct connection string
 * @returns {string}        - direct connection string (connStr unchanged if not a pooler URL)
 */
export function deriveDirectConnectionString(connStr) {
  if (!connStr) return connStr
  try {
    const url = new URL(connStr)
    if (url.hostname.includes('-pooler.')) {
      url.hostname = url.hostname.replace('-pooler.', '.')
      return url.toString()
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return connStr
}

/**
 * Returns the connection string to use for role_admin database connections.
 * Priority:
 *   1. DATABASE_URL_ROLE_ADMIN      — unpooled/direct (preferred; more reliable)
 *   2. DATABASE_URL_ROLE_ADMIN_POOL — pooler (also fine; role_admin path never
 *                                     uses sql.transaction(), so pooler works)
 *   3. ADMIN_DATABASE_URL           — legacy alias
 */
export function getRoleAdminConnectionString() {
  return sanitizeString(
    process.env.DATABASE_URL_ROLE_ADMIN ||
    process.env.DATABASE_URL_ROLE_ADMIN_POOL ||
    process.env.ADMIN_DATABASE_URL
  )
}

export function getNeonDatabaseConfig() {
  const { connectionString, source } = getCanonicalDatabaseConnection()
  const { connectionString: directConnectionString, source: directSource } = getCanonicalDirectDatabaseConnection()

  // Prefer the unpooled (direct) connection for transaction batching.
  // If not explicitly configured, derive it automatically from the pooler URL.
  const resolvedDirectConnection = directConnectionString || deriveDirectConnectionString(connectionString)

  return {
    connectionString,
    directConnectionString: resolvedDirectConnection,
    source,
    directSource: directConnectionString ? directSource : (resolvedDirectConnection !== connectionString ? 'derived' : null),
    schema: sanitizeString(process.env.NEON_DEFAULT_SCHEMA) || 'public',
    sslMode: sanitizeString(process.env.NEON_SSL_MODE) || 'require',
    maxConnections: parseInteger(process.env.NEON_MAX_CONNECTIONS, 5),
  }
}
