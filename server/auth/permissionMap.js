// server/auth/permissionMap.js
//
// Central RBAC permission map for the SolarInvest domain.
//
// This module defines:
//   - ROLES     : canonical domain role constants (uppercase)
//   - PERMISSION_MAP : per-area read/write role lists
//   - actorDomainRole(actor) : maps a resolved actor to its domain role
//   - hasPermission(actor, permission) : pure permission check
//   - requirePermission(permission)    : async middleware factory (throws 401/403)
//
// Permission format: '<area>:<action>'
//   Examples: 'cobrancas:read', 'operacao:write', 'indicadores:read'
//
// Role mapping (Stack Auth → Domain):
//   role_admin      → ADMIN
//   role_office     → DIRETORIA
//   role_financeiro → FINANCEIRO
//   role_comercial  → COMERCIAL
//   role_operacao   → OPERACAO
//   role_suporte    → SUPORTE
//
// Fallback: actors with no recognized Stack Auth role are treated as ADMIN
// for backward compatibility during the initial migration period. This can
// be tightened once all users have been assigned explicit roles.
//
// Usage:
//   import { requirePermission, hasPermission } from '../auth/permissionMap.js'
//
//   // In a route handler:
//   const actor = await requirePermission('cobrancas:read')(req)
//   // actor is returned when authorized; 401/403 is thrown otherwise
//
//   // As a pure check (no side effects):
//   if (hasPermission(actor, 'operacao:write')) { ... }

import { resolveActor } from '../proposals/permissions.js'

// ─── Domain role constants ────────────────────────────────────────────────────

export const ROLES = /** @type {const} */ ({
  ADMIN:      'ADMIN',
  DIRETORIA:  'DIRETORIA',
  COMERCIAL:  'COMERCIAL',
  FINANCEIRO: 'FINANCEIRO',
  OPERACAO:   'OPERACAO',
  SUPORTE:    'SUPORTE',
})

// ─── Permission map ───────────────────────────────────────────────────────────
//
// Each area defines 'read' and 'write' arrays of allowed domain roles.

export const PERMISSION_MAP = {
  dashboard: {
    read:  [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.COMERCIAL, ROLES.FINANCEIRO, ROLES.OPERACAO, ROLES.SUPORTE],
    write: [ROLES.ADMIN],
  },
  comercial: {
    read:  [ROLES.ADMIN, ROLES.COMERCIAL],
    write: [ROLES.ADMIN, ROLES.COMERCIAL],
  },
  clientes: {
    read:  [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.OPERACAO, ROLES.FINANCEIRO],
    write: [ROLES.ADMIN],
  },
  cobrancas: {
    read:  [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.FINANCEIRO],
    write: [ROLES.ADMIN, ROLES.FINANCEIRO],
  },
  operacao: {
    read:  [ROLES.ADMIN, ROLES.OPERACAO, ROLES.SUPORTE],
    write: [ROLES.ADMIN, ROLES.OPERACAO],
  },
  indicadores: {
    read:  [ROLES.ADMIN, ROLES.DIRETORIA],
    write: [ROLES.ADMIN],
  },
  relatorios: {
    read:  [ROLES.ADMIN, ROLES.DIRETORIA],
    write: [ROLES.ADMIN],
  },
  configuracoes: {
    read:  [ROLES.ADMIN],
    write: [ROLES.ADMIN],
  },
}

// ─── Actor → Domain role ──────────────────────────────────────────────────────

/**
 * Maps a resolved actor object (from resolveActor) to its canonical domain role.
 *
 * Precedence mirrors resolveActor: admin > office > financeiro > comercial > operacao > suporte.
 * Fallback: actors with no recognized role return ADMIN for backward compatibility.
 *
 * @param {object|null} actor - actor from resolveActor()
 * @returns {string|null} One of ROLES.* or null when actor is null
 */
export function actorDomainRole(actor) {
  if (!actor) return null
  if (actor.isAdmin)      return ROLES.ADMIN
  if (actor.isOffice)     return ROLES.DIRETORIA
  if (actor.isFinanceiro) return ROLES.FINANCEIRO
  if (actor.isComercial)  return ROLES.COMERCIAL
  if (actor.isOperacao)   return ROLES.OPERACAO
  if (actor.isSuporte)    return ROLES.SUPORTE
  // Fallback: ADMIN for backward compatibility when no role is assigned.
  // This preserves access for existing users during the RBAC migration period.
  return ROLES.ADMIN
}

// ─── Pure permission check ────────────────────────────────────────────────────

/**
 * Returns true when the actor holds the given permission.
 *
 * @param {object|null} actor      - actor from resolveActor()
 * @param {string}      permission - '<area>:<action>' e.g. 'cobrancas:read'
 * @returns {boolean}
 */
export function hasPermission(actor, permission) {
  if (!actor) return false

  const domainRole = actorDomainRole(actor)
  if (!domainRole) return false

  const colonIndex = permission.indexOf(':')
  if (colonIndex === -1) return false

  const area   = permission.slice(0, colonIndex)
  const action = permission.slice(colonIndex + 1)

  const areaPerms = PERMISSION_MAP[area]
  if (!areaPerms) return false

  const allowedRoles = areaPerms[action]
  if (!Array.isArray(allowedRoles)) return false

  return allowedRoles.includes(domainRole)
}

// ─── Async middleware factory ─────────────────────────────────────────────────

/**
 * Returns an async guard function that resolves the actor for the request and
 * verifies it holds the required permission.
 *
 * Throws:
 *   { statusCode: 401 } when the request is unauthenticated
 *   { statusCode: 403 } when the actor lacks the required permission
 *
 * On success returns the resolved actor so callers can reuse it without a
 * second resolveActor() call.
 *
 * @param {string} permission - '<area>:<action>' e.g. 'operacao:write'
 * @returns {(req: object) => Promise<object>}
 *
 * @example
 *   const actor = await requirePermission('cobrancas:read')(req)
 */
export function requirePermission(permission) {
  return async function permissionGuard(req) {
    const actor = await resolveActor(req)

    if (!actor) {
      const err = new Error('Authentication required')
      err.statusCode = 401
      throw err
    }

    if (!hasPermission(actor, permission)) {
      const err = new Error(`Forbidden: permission '${permission}' required`)
      err.statusCode = 403
      throw err
    }

    return actor
  }
}
