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

const FALLBACK_ENV_VARS = [
  'NEON_DATABASE_URL',
  'DATABASE_URL',
  'NEON_POSTGRESQL_URL',
  'PGURI',
]

const FALLBACK_DIRECT_ENV_VARS = [
  'DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL_UNPOOLED',
]

function resolveConnectionString() {
  for (const key of FALLBACK_ENV_VARS) {
    const value = sanitizeString(process.env[key])
    if (value) {
      return value
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
    return `postgresql://${encodedUser}:${encodedPassword}@${host}${portSuffix}/${database}`
  }

  return ''
}

function resolveDirectConnectionString() {
  for (const key of FALLBACK_DIRECT_ENV_VARS) {
    const value = sanitizeString(process.env[key])
    if (value) {
      return value
    }
  }
  return ''
}

export function getNeonDatabaseConfig() {
  const connectionString = resolveConnectionString()
  const directConnectionString = resolveDirectConnectionString()
  return {
    connectionString,
    directConnectionString,
    schema: sanitizeString(process.env.NEON_DEFAULT_SCHEMA) || 'public',
    sslMode: sanitizeString(process.env.NEON_SSL_MODE) || 'require',
    maxConnections: parseInteger(process.env.NEON_MAX_CONNECTIONS, 5),
  }
}
