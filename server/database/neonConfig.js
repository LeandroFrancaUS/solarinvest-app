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

export function getNeonDatabaseConfig() {
  const { connectionString, source } = getCanonicalDatabaseConnection()
  const { connectionString: directConnectionString, source: directSource } = getCanonicalDirectDatabaseConnection()
  return {
    connectionString,
    directConnectionString,
    source,
    directSource,
    schema: sanitizeString(process.env.NEON_DEFAULT_SCHEMA) || 'public',
    sslMode: sanitizeString(process.env.NEON_SSL_MODE) || 'require',
    maxConnections: parseInteger(process.env.NEON_MAX_CONNECTIONS, 5),
  }
}
