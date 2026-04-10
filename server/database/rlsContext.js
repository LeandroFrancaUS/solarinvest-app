// server/database/rlsContext.js
//
// RLS (Row Level Security) context utilities.
//
// Provides typed role definitions and a helper to apply the RLS session settings
// required by PostgreSQL before running queries on user-owned tables:
//   app.current_user_id   → Stack Auth user ID of the requesting user
//   app.current_user_role → canonical DB role string
//
// Use with a real pg-compatible Pool client (withRls.js) rather than the Neon
// HTTP driver (withRLSContext.js) for tables where persistent session state
// is required.  The Neon HTTP driver resets session variables between HTTP
// round-trips; using a persistent connection avoids this limitation.
//
// Roles (highest → lowest privilege):
//   role_admin      → Administrador com acesso total ao sistema
//   role_comercial  → Usuário comum (próprios clientes/propostas)
//   role_gerente_comercial → Gerente comercial (leitura de todos os comerciais)
//   role_financeiro → Acesso financeiro (leitura de tudo, sem escrita)
//   role_office     → Acesso irrestrito (leitura + escrita de tudo)
//
// These strings must match the values expected by the PostgreSQL RLS policies
// (see db/migrations/0018_role_aware_rls.sql and 0019_adjust_office_scope.sql).

/**
 * @typedef {'role_admin' | 'role_comercial' | 'role_gerente_comercial' | 'role_financeiro' | 'role_office'} DatabaseRlsRole
 */

/**
 * @typedef {Object} AuthenticatedRlsActor
 * @property {string} authProviderUserId  - Stack Auth user ID (set as app.current_user_id)
 * @property {DatabaseRlsRole} role       - Canonical DB role string (set as app.current_user_role)
 */

/** @type {Record<string, DatabaseRlsRole>} */
const ROLE_MAP = {
  admin:                 'role_admin',
  role_admin:            'role_admin',
  comercial:             'role_comercial',
  role_comercial:        'role_comercial',
  gerente_comercial:     'role_gerente_comercial',
  role_gerente_comercial:'role_gerente_comercial',
  financeiro:            'role_financeiro',
  role_financeiro:       'role_financeiro',
  office:                'role_office',
  role_office:           'role_office',
}

/**
 * Maps a business / Stack Auth role string to the canonical database role string.
 *
 * @param {string | null | undefined} role
 * @returns {DatabaseRlsRole}
 * @throws {Error} when the role is not recognised
 */
export function mapBusinessRoleToDatabaseRole(role) {
  const mapped = ROLE_MAP[String(role ?? '')]
  if (!mapped) {
    throw new Error(`Unsupported database role mapping: ${String(role)}`)
  }
  return mapped
}

/**
 * Applies the RLS session context on a live pg-compatible pool client within
 * the current transaction.  Must be called after BEGIN and before the data
 * query so that the session settings are active when the RLS policies are
 * evaluated.
 *
 * Both settings use `is_local = true` so they are automatically cleared when
 * the transaction ends (COMMIT or ROLLBACK), preventing context leaks between
 * requests on the same pooled connection.
 *
 * @param {{ query(text: string, params?: unknown[]): Promise<unknown> }} client - pg-compatible PoolClient
 * @param {AuthenticatedRlsActor} actor
 * @returns {Promise<void>}
 */
export async function applyRlsContext(client, actor) {
  await client.query(
    `SELECT set_config('app.current_user_id',   $1, true),
            set_config('app.current_user_role', $2, true)`,
    [actor.authProviderUserId, actor.role],
  )
}
