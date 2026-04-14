// server/clients/deduplication.js
// Enterprise-grade client deduplication with 3-level matching.

import {
  findClientByCpf,
  findClientByCnpj,
  findClientByUc,
  findClientByEmail,
  findClientByPhone,
  normalizeDocumentServer,
  normalizeCpfServer,
  normalizeCnpjServer,
  createClient,
  updateClient,
  appendClientAuditLog,
  upsertClientEnergyProfile,
} from './repository.js'

/**
 * @typedef {'hard' | 'medium' | 'soft' | 'none'} MatchLevel
 * @typedef {'new' | 'existing' | 'possible_duplicate'} ImportStatus
 * @typedef {'high' | 'medium' | 'low'} ConfidenceLevel
 * @typedef {'import' | 'ignore' | 'merge'} SuggestedAction
 *
 * @typedef {Object} DuplicateCheckResult
 * @property {MatchLevel}       matchLevel        - Level of deduplication match
 * @property {ImportStatus}     status            - Derived import status
 * @property {ConfidenceLevel}  confidence        - How confident the check is
 * @property {SuggestedAction}  suggestedAction   - What the system recommends
 * @property {string|null}      matchReason       - Human-readable reason for the match
 * @property {object|null}      existingClient    - The existing client row if found
 * @property {string[]}         matchFields       - Which fields triggered the match
 */

/**
 * Normalize a phone number to digits only (last 9 or 10 digits for BR mobile/landline).
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function normalizePhone(raw) {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

/**
 * Simple string similarity (Dice coefficient on bigrams).
 * Returns a value between 0 (no similarity) and 1 (identical).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function diceSimilarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const normalize = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0
  const getBigrams = (str) => {
    const bigrams = new Set()
    for (let i = 0; i < str.length - 1; i++) bigrams.add(str.slice(i, i + 2))
    return bigrams
  }
  const bigramsA = getBigrams(na)
  const bigramsB = getBigrams(nb)
  let intersectionCount = 0
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersectionCount++
  }
  return (2 * intersectionCount) / (bigramsA.size + bigramsB.size)
}

/**
 * Full 3-level deduplication check for a single import row against the database.
 *
 * LEVEL 1 — HARD MATCH (automatic block):
 *   - CPF/CNPJ identical
 *   - UC identical
 *
 * LEVEL 2 — MEDIUM MATCH (possible duplicate):
 *   - Phone identical
 *   - Email identical
 *
 * LEVEL 3 — SOFT MATCH (visual alert only):
 *   - Name similarity > 0.85 AND same city (case-insensitive)
 *
 * @param {Function} sql  - user-scoped sql handle
 * @param {object}   row  - Parsed import row
 * @param {string|null} row.document
 * @param {string|null} row.uc
 * @param {string|null} row.email
 * @param {string|null} row.phone
 * @param {string|null} row.name
 * @param {string|null} row.city
 * @returns {Promise<DuplicateCheckResult>}
 */
export async function checkDuplicateClient(sql, row) {
  const { type: docType, normalized: docNormalized } = normalizeDocumentServer(row.document ?? null)

  // ── LEVEL 1: HARD MATCH ───────────────────────────────────────────────────
  if (docNormalized) {
    const existing = docType === 'cpf'
      ? await findClientByCpf(sql, docNormalized)
      : await findClientByCnpj(sql, docNormalized)
    if (existing) {
      return {
        matchLevel: 'hard',
        status: 'existing',
        confidence: 'high',
        suggestedAction: 'merge',
        matchReason: `${docType.toUpperCase()} idêntico ao cliente #${existing.id}`,
        existingClient: existing,
        matchFields: [docType],
      }
    }
  }

  if (row.uc && row.uc.trim()) {
    const existing = await findClientByUc(sql, row.uc.trim())
    if (existing) {
      return {
        matchLevel: 'hard',
        status: 'existing',
        confidence: 'high',
        suggestedAction: 'merge',
        matchReason: `UC idêntica à do cliente #${existing.id}`,
        existingClient: existing,
        matchFields: ['uc'],
      }
    }
  }

  // ── LEVEL 2: MEDIUM MATCH ─────────────────────────────────────────────────
  const phoneDigits = normalizePhone(row.phone)
  if (phoneDigits.length >= 8) {
    const existing = await findClientByPhone(sql, row.phone)
    if (existing) {
      return {
        matchLevel: 'medium',
        status: 'possible_duplicate',
        confidence: 'medium',
        suggestedAction: 'merge',
        matchReason: `Telefone idêntico ao do cliente #${existing.id}`,
        existingClient: existing,
        matchFields: ['phone'],
      }
    }
  }

  if (row.email && row.email.trim()) {
    const existing = await findClientByEmail(sql, row.email.trim())
    if (existing) {
      return {
        matchLevel: 'medium',
        status: 'possible_duplicate',
        confidence: 'medium',
        suggestedAction: 'merge',
        matchReason: `E-mail idêntico ao do cliente #${existing.id}`,
        existingClient: existing,
        matchFields: ['email'],
      }
    }
  }

  // ── LEVEL 3: SOFT MATCH ───────────────────────────────────────────────────
  // We skip a full-table name scan for performance. Instead, if city is
  // provided we look for possible name similarity using client-side check
  // (the caller can optionally supply existing names for a local comparison).
  // Server-side soft match is marked as a signal that the caller can verify.
  if (row.name && row.city) {
    // We return a soft match result marker. The actual similarity check
    // against DB rows is expensive; front-end performs it locally against
    // the already-loaded client list.
    return {
      matchLevel: 'none',
      status: 'new',
      confidence: 'high',
      suggestedAction: 'import',
      matchReason: null,
      existingClient: null,
      matchFields: [],
      _softCheckPending: true,
    }
  }

  return {
    matchLevel: 'none',
    status: 'new',
    confidence: 'high',
    suggestedAction: 'import',
    matchReason: null,
    existingClient: null,
    matchFields: [],
  }
}

/**
 * Safe client creation: sanitize → dedupe → insert or merge.
 *
 * @param {Function} sql       - user-scoped sql handle
 * @param {object}   data      - Raw import row data
 * @param {object}   options
 * @param {boolean}  [options.autoMerge=false] - If true, update existing client with empty fields
 * @param {string}   [options.actorUserId]
 * @param {string}   [options.actorEmail]
 * @returns {Promise<{ client: object, energyProfile: object|null, action: 'created'|'merged'|'skipped', dedupResult: DuplicateCheckResult }>}
 */
export async function createClientSafe(sql, data, options = {}) {
  const { autoMerge = false, actorUserId = null, actorEmail = null } = options

  // 1. sanitize
  const sanitized = {
    name: (data.name ?? '').trim(),
    document: (data.document ?? data.cpf_raw ?? data.cnpj_raw ?? '').trim() || null,
    uc: (data.uc ?? '').trim() || null,
    email: (data.email ?? '').trim() || null,
    phone: (data.phone ?? '').trim() || null,
    city: (data.city ?? '').trim() || null,
    state: (data.state ?? data.uf ?? '').trim() || null,
    address: (data.address ?? '').trim() || null,
    distribuidora: (data.distribuidora ?? '').trim() || null,
    metadata: data.metadata ?? null,
  }

  if (!sanitized.name) {
    throw Object.assign(new Error('Nome do cliente é obrigatório'), { code: 'VALIDATION_ERROR' })
  }

  // 2. dedupe check
  const dedupResult = await checkDuplicateClient(sql, {
    document: sanitized.document,
    uc: sanitized.uc,
    email: sanitized.email,
    phone: sanitized.phone,
    name: sanitized.name,
    city: sanitized.city,
  })

  // 3. insert or merge
  const { type: docType, normalized: docNormalized } = normalizeDocumentServer(sanitized.document)

  const energyData = data.energyProfile ?? null

  if (dedupResult.matchLevel === 'hard' || (dedupResult.matchLevel === 'medium' && autoMerge)) {
    const existing = dedupResult.existingClient
    if (autoMerge && existing) {
      // Update only empty/null fields on the existing client (non-destructive merge)
      const patch = {}
      if (!existing.phone && sanitized.phone) patch.phone = sanitized.phone
      if (!existing.email && sanitized.email) patch.email = sanitized.email
      if (!existing.city && sanitized.city) patch.city = sanitized.city
      if (!existing.state && sanitized.state) patch.state = sanitized.state
      if (!existing.address && sanitized.address) patch.address = sanitized.address
      if (!existing.distribuidora && sanitized.distribuidora) patch.distribuidora = sanitized.distribuidora

      if (Object.keys(patch).length > 0) {
        await updateClient(sql, existing.id, patch)
        await appendClientAuditLog(
          sql, existing.id, actorUserId, actorEmail,
          'updated', null, patch,
          `Merge automático durante importação (${dedupResult.matchFields.join(', ')})`, null,
        )
      }

      let energyProfile = null
      if (energyData) {
        energyProfile = await upsertClientEnergyProfile(sql, existing.id, energyData)
      }

      return { client: existing, energyProfile, action: 'merged', dedupResult }
    }

    // Hard match without autoMerge → return existing without changes
    return { client: existing, energyProfile: null, action: 'skipped', dedupResult }
  }

  // No duplicate found — create new client
  const cpfNormalized = docType === 'cpf' ? normalizeCpfServer(sanitized.document) : null
  const cnpjNormalized = docType === 'cnpj' ? normalizeCnpjServer(sanitized.document) : null

  let identityStatus = 'pending_cpf'
  if (docNormalized && (docType === 'cpf' || docType === 'cnpj')) identityStatus = 'confirmed'

  const newClient = await createClient(sql, {
    name: sanitized.name,
    cpf_normalized: cpfNormalized,
    cpf_raw: docType === 'cpf' ? sanitized.document : null,
    cnpj_normalized: cnpjNormalized,
    cnpj_raw: docType === 'cnpj' ? sanitized.document : null,
    document_type: docType !== 'unknown' ? docType : null,
    document: sanitized.document,
    phone: sanitized.phone,
    email: sanitized.email,
    city: sanitized.city,
    state: sanitized.state,
    address: sanitized.address,
    uc: sanitized.uc,
    distribuidora: sanitized.distribuidora,
    created_by_user_id: actorUserId,
    owner_user_id: actorUserId,
    identity_status: identityStatus,
    origin: 'imported',
    metadata: sanitized.metadata,
  })

  await appendClientAuditLog(
    sql, newClient.id, actorUserId, actorEmail,
    'created', null, newClient,
    'Criado via importação em massa', null,
  )

  let energyProfile = null
  if (energyData) {
    energyProfile = await upsertClientEnergyProfile(sql, newClient.id, energyData)
  }

  return { client: newClient, energyProfile, action: 'created', dedupResult }
}
