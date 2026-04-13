import {
  buildConnectionStringFromParts,
  getCanonicalDatabaseConnection,
  getCanonicalDirectDatabaseConnection,
} from './connection.js'

function safeHostFromConnectionString(connectionString) {
  if (!connectionString) return null
  try {
    return new URL(connectionString).hostname || null
  } catch {
    return null
  }
}

export function getDatabaseConfig() {
  const primary = getCanonicalDatabaseConnection()
  const direct = getCanonicalDirectDatabaseConnection()
  const legacyUrl = buildConnectionStringFromParts()
  const connectionString = primary.connectionString || legacyUrl || ''
  const primaryEnvSource = typeof primary.source === 'string' && !primary.source.includes('legacy-fallback')

  if (!connectionString) {
    throw new Error(
      'Database configuration missing. Expected DATABASE_URL (preferred) or optional legacy PG* variables.',
    )
  }

  return {
    connectionString,
    directConnectionString: direct.connectionString || null,
    source: primary.source ?? (legacyUrl ? 'PGHOST/PGDATABASE/PGUSER/PGPASSWORD (legacy-fallback)' : null),
    directSource: direct.source ?? null,
    hasPrimaryUrl: Boolean(primary.connectionString && primaryEnvSource),
    hasLegacyParts: Boolean(legacyUrl),
    hasDirectUrl: Boolean(direct.connectionString),
    isPooled: connectionString.includes('-pooler.'),
    host: safeHostFromConnectionString(connectionString),
  }
}

export function getDirectDatabaseUrl() {
  const direct = getCanonicalDirectDatabaseConnection()
  return direct.connectionString || null
}
