// src/domain/clients/consultant-resolution.ts
// Centralized, pure consultant-resolution logic.
//
// PRIORITY ORDER:
//   1. clients.consultant_id  (canonical relational FK, highest trust)
//   2. metadata.consultor_id  (legacy metadata field, for older records)
//   3. linked_user_id / email match against current user (default for new clients only)
//   4. none → "sem consultor"
//
// Rule: priority 3 (user-match default) only applies to NEW / unsaved clients.
// Existing persisted clients NEVER fall back to a user-match default.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConsultantRef {
  id: string | number | null
  nickname: string | null
  fullName: string | null
  email?: string | null
}

export type ConsultantResolutionSource =
  | 'canonical'
  | 'legacy-metadata'
  | 'user-match-default'
  | 'none'

export interface ClientConsultantResolution {
  consultantId: string | null
  consultantNickname: string | null
  consultantFullName: string | null
  source: ConsultantResolutionSource
}

// ─── Minimal client shape required by resolution ─────────────────────────────

export interface ClientForConsultantResolution {
  /** Canonical FK column (clients.consultant_id). May be BIGINT number or string. */
  consultant_id?: string | number | null
  metadata?: Record<string, unknown> | null
}

// ─── Minimal consultant shape required ───────────────────────────────────────

export interface ConsultantForResolution {
  id: string | number
  full_name?: string | null
  apelido?: string | null
  email?: string | null
  linked_user_id?: string | null
}

// ─── Minimal current-user shape ───────────────────────────────────────────────

export interface CurrentUserForResolution {
  id?: string | null
  email?: string | null
}

// ─── Helper: normalize nullable ID to string or null ─────────────────────────

export function normalizeConsultantId(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const str = String(raw).trim()
  return str || null
}

// ─── Helper: derive nickname for display ─────────────────────────────────────

export function deriveConsultantNickname(c: ConsultantForResolution | null | undefined): string | null {
  if (!c) return null
  const apelido = c.apelido?.trim() ?? ''
  if (apelido) return apelido
  const fullName = c.full_name?.trim() ?? ''
  const first = fullName.split(' ')[0] ?? ''
  if (first) return first
  if (fullName) return fullName
  return c.email?.trim() ?? null
}

// ─── Core: resolve default consultant for the logged-in user ─────────────────

/**
 * Find the consultant entry that corresponds to the currently logged-in user.
 * Match order: linked_user_id → email (normalized, null-safe).
 *
 * Returns null when no match is found.
 * Used ONLY for new / draft clients that have not yet been persisted.
 */
export function resolveDefaultConsultantForUser(
  currentUser: CurrentUserForResolution | null | undefined,
  consultants: ConsultantForResolution[],
): ConsultantForResolution | null {
  if (!currentUser) return null
  if (!Array.isArray(consultants) || consultants.length === 0) return null

  const userId = currentUser.id?.trim() ?? ''
  const userEmail = currentUser.email?.trim().toLowerCase() ?? ''

  // Priority 1: linked_user_id exact match
  if (userId) {
    const byLinkedId = consultants.find(
      (c) => c.linked_user_id?.trim() === userId,
    )
    if (byLinkedId) return byLinkedId
  }

  // Priority 2: email match (case-insensitive)
  if (userEmail) {
    const byEmail = consultants.find(
      (c) => (c.email?.trim().toLowerCase() ?? '') === userEmail,
    )
    if (byEmail) return byEmail
  }

  return null
}

// ─── Core: resolve consultant for a given client record ──────────────────────

/**
 * Resolve the canonical consultant for a client record.
 *
 * @param params.client       - The client row (from DB or from local cache).
 * @param params.consultants  - Full consultant list (needed to resolve nicknames).
 * @param params.currentUser  - Logged-in user (used only for new-client defaults).
 * @param params.isNewClient  - True for a client that has never been persisted.
 *                              When false, user-match default (priority 3) is skipped.
 */
export function resolveClientConsultant({
  client,
  consultants,
  currentUser,
  isNewClient = false,
}: {
  client: ClientForConsultantResolution | null | undefined
  consultants: ConsultantForResolution[]
  currentUser?: CurrentUserForResolution | null
  isNewClient?: boolean
}): ClientConsultantResolution {
  const consultantsById = new Map<string, ConsultantForResolution>()
  for (const c of consultants) {
    consultantsById.set(String(c.id), c)
  }

  const meta = client?.metadata ?? {}

  // ── Priority 1: canonical FK ──────────────────────────────────────────────
  const canonicalId = normalizeConsultantId(client?.consultant_id)
  if (canonicalId) {
    const consultant = consultantsById.get(canonicalId)
    console.debug('[consultant][resolve] source=canonical', { clientId: (client as { id?: unknown })?.id, consultantId: canonicalId })
    return {
      consultantId: canonicalId,
      consultantNickname: deriveConsultantNickname(consultant ?? null),
      consultantFullName: consultant?.full_name?.trim() ?? null,
      source: 'canonical',
    }
  }

  // ── Priority 2: legacy metadata.consultor_id ──────────────────────────────
  const legacyId = normalizeConsultantId(meta.consultor_id as string | number | undefined)
  if (legacyId) {
    const consultant = consultantsById.get(legacyId)
    const legacyNome = (meta.consultor_nome as string | undefined)?.trim() ?? null
    console.debug('[consultant][resolve] source=legacy-metadata', { clientId: (client as { id?: unknown })?.id, consultantId: legacyId })
    return {
      consultantId: legacyId,
      consultantNickname: deriveConsultantNickname(consultant ?? null) ?? legacyNome,
      consultantFullName: consultant?.full_name?.trim() ?? legacyNome,
      source: 'legacy-metadata',
    }
  }

  // ── Priority 3: user-match default (NEW clients only) ─────────────────────
  if (isNewClient && currentUser) {
    const matched = resolveDefaultConsultantForUser(currentUser, consultants)
    if (matched) {
      console.debug('[consultant][resolve] source=user-match-default', { userId: currentUser.id })
      return {
        consultantId: String(matched.id),
        consultantNickname: deriveConsultantNickname(matched),
        consultantFullName: matched.full_name?.trim() ?? null,
        source: 'user-match-default',
      }
    }
  }

  // ── Priority 4: none ──────────────────────────────────────────────────────
  console.debug('[consultant][resolve] source=none', { clientId: (client as { id?: unknown })?.id })
  return { consultantId: null, consultantNickname: null, consultantFullName: null, source: 'none' }
}

// ─── Display helper for client list ──────────────────────────────────────────

/**
 * Returns the display label for a client's consultant in the client list.
 *
 * Priority:
 *   1. consultantsById[client.consultant_id].apelido / nickname
 *   2. metadata.consultor_nome
 *   3. consultantsById[client.consultant_id].full_name
 *   4. "Sem consultor"
 */
export function getClientConsultantLabel(
  client: ClientForConsultantResolution,
  consultantsById: Map<string, ConsultantForResolution>,
): string {
  const canonicalId = normalizeConsultantId(client.consultant_id)
  const legacyId = normalizeConsultantId((client.metadata?.consultor_id) as string | number | undefined)
  const effectiveId = canonicalId ?? legacyId

  const consultant = effectiveId ? consultantsById.get(effectiveId) : null
  const legacyNome = ((client.metadata?.consultor_nome) as string | undefined)?.trim() ?? ''

  if (consultant) {
    const apelido = consultant.apelido?.trim() ?? ''
    if (apelido) return apelido
    const fullName = consultant.full_name?.trim() ?? ''
    const firstName = fullName.split(' ')[0] ?? ''
    if (firstName) return firstName
    if (fullName) return fullName
  }

  if (legacyNome) return legacyNome

  if (consultant?.full_name?.trim()) return consultant.full_name.trim()

  return 'Sem consultor'
}
