function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const CANONICAL_DB_ENV_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'NEON_POSTGRESQL_URL',
  'PGURI',
]

const CANONICAL_DIRECT_DB_ENV_KEYS = [
  'DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL_UNPOOLED',
]

export function getCanonicalDatabaseConnection() {
  for (const key of CANONICAL_DB_ENV_KEYS) {
    const value = sanitizeString(process.env[key])
    if (value) {
      return { connectionString: value, source: key }
    }
  }

  const host = sanitizeString(process.env.PGHOST ?? process.env.PGHOST_UNPOOLED)
  const database = sanitizeString(process.env.PGDATABASE)
  const user = sanitizeString(process.env.PGUSER)
  const password = sanitizeString(process.env.PGPASSWORD)
  const portValue = sanitizeString(process.env.PGPORT)
  const port = portValue ? Number.parseInt(portValue, 10) : NaN

  if (host && database && user && password) {
    const encodedUser = encodeURIComponent(user)
    const encodedPassword = encodeURIComponent(password)
    const portSuffix = Number.isFinite(port) ? `:${port}` : ''
    return {
      connectionString: `postgresql://${encodedUser}:${encodedPassword}@${host}${portSuffix}/${database}`,
      source: 'PGHOST/PGDATABASE/PGUSER/PGPASSWORD',
    }
  }

  return { connectionString: '', source: null }
}

export function getCanonicalDirectDatabaseConnection() {
  for (const key of CANONICAL_DIRECT_DB_ENV_KEYS) {
    const value = sanitizeString(process.env[key])
    if (value) {
      return { connectionString: value, source: key }
    }
  }

  return { connectionString: '', source: null }
}

export function getCanonicalDatabaseUrl() {
  return getCanonicalDatabaseConnection().connectionString
}

export function getCanonicalDatabaseDiagnostics() {
  const { connectionString, source } = getCanonicalDatabaseConnection()
  const schema = sanitizeString(process.env.NEON_DEFAULT_SCHEMA) || 'public'

  if (!connectionString) {
    return {
      source,
      schema,
      host: null,
      database: null,
    }
  }

  try {
    const parsed = new URL(connectionString)
    const database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : null
    return {
      source,
      schema,
      host: parsed.hostname || null,
      database: database || null,
    }
  } catch {
    return {
      source,
      schema,
      host: null,
      database: null,
    }
  }
}
