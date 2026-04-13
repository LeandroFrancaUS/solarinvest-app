import { getNeonDatabaseConfig, getRoleAdminConnectionString } from './neonConfig.js'

let neonFactory
let neonConfiguration
let importError
let dependencyWarningLogged = false

try {
  const neonModule = await import('@neondatabase/serverless')
  neonFactory = neonModule.neon ?? neonModule.default
  neonConfiguration = neonModule.neonConfig ?? null
  if (neonConfiguration) {
    neonConfiguration.fetchConnectionCache = true
  }
} catch (error) {
  importError = error
}

let clientSingleton

export function getDatabaseClient() {
  if (clientSingleton) {
    return clientSingleton
  }

  if (!neonFactory) {
    if (!dependencyWarningLogged) {
      dependencyWarningLogged = true
      console.error('[database] Dependência "@neondatabase/serverless" ausente ou incompatível.', importError)
    }
    return null
  }

  const config = getNeonDatabaseConfig()
  if (!config.connectionString) {
    return null
  }

  // Prefer the direct (unpooled) connection for the main client so that
  // sql.transaction() works reliably.  The pooler endpoint can interfere
  // with HTTP transaction batching in some Neon configurations.
  const connectionStr = config.directConnectionString || config.connectionString

  clientSingleton = {
    sql: neonFactory(connectionStr),
    config,
  }

  return clientSingleton
}

// ── Role-specific clients ─────────────────────────────────────────────────────
// When DATABASE_URL_ROLE_ADMIN is configured the backend can connect directly
// as the role_admin PostgreSQL role.  Queries via this client satisfy the
// can_access_owner() / can_write_owner() RLS policies through the
// `current_user = 'role_admin'` fast-path (migration 0023) without needing the
// sql.transaction() set_config wrapper.

let roleAdminClientSingleton

/**
 * Returns the Neon SQL client for the role_admin PostgreSQL role, or null
 * when DATABASE_URL_ROLE_ADMIN / ADMIN_DATABASE_URL is not configured.
 */
export function getRoleAdminClient() {
  if (roleAdminClientSingleton !== undefined) {
    return roleAdminClientSingleton
  }

  if (!neonFactory) {
    roleAdminClientSingleton = null
    return null
  }

  const connStr = getRoleAdminConnectionString()
  if (!connStr) {
    roleAdminClientSingleton = null
    return null
  }

  roleAdminClientSingleton = { sql: neonFactory(connStr) }
  return roleAdminClientSingleton
}

/**
 * Returns the raw Neon SQL function for the given canonical role string, or
 * null when no role-specific connection is configured.
 *
 * @param {string|null} role - 'role_admin' | 'role_comercial' | ...
 * @returns {{ sql: Function }|null}
 */
export function getRoleSpecificClient(role) {
  if (role === 'role_admin') {
    return getRoleAdminClient()
  }
  // Future: add role_comercial, role_office, role_financeiro clients here.
  return null
}
