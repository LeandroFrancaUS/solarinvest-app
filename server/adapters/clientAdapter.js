// server/adapters/clientAdapter.js
// Pure mapping adapter for client field compatibility.
//
// The clients table has evolved from legacy field names (name, document,
// email, phone, city, state, address, uc) toward canonical prefixed names
// (client_name, client_document, client_email, client_phone, client_city,
// client_state, client_address, uc_geradora).
//
// These functions are intentionally pure:
//   - No DB access
//   - No SQL execution
//   - No RLS manipulation
//   - No side effects
//
// Use them to safely bridge old and new shapes when reading/writing client
// records without touching live route handlers.

/**
 * Normalize a raw client row (DB or API shape) to the canonical form that
 * uses prefixed column names.  Legacy fields are accepted as fallbacks when
 * canonical fields are absent or null.
 *
 * @param {object} raw - Client row or partial object with any field shape.
 * @returns {object}   - Object with canonical client_* keys populated.
 */
export function toCanonicalClient(raw) {
  if (!raw || typeof raw !== 'object') return {}

  return {
    ...raw,
    client_name:     raw.client_name     ?? raw.name     ?? null,
    client_document: raw.client_document ?? raw.document  ?? null,
    client_email:    raw.client_email    ?? raw.email    ?? null,
    client_phone:    raw.client_phone    ?? raw.phone    ?? null,
    client_city:     raw.client_city     ?? raw.city     ?? null,
    client_state:    raw.client_state    ?? raw.state    ?? null,
    client_address: raw.client_address ?? raw.address ?? null,
    uc_geradora:    raw.uc_geradora    ?? raw.uc      ?? null,
  }
}

/**
 * Normalize a canonical client object back to a legacy-compatible shape.
 * Useful when downstream code still reads the un-prefixed field names.
 *
 * @param {object} canonical - Client row with canonical client_* keys.
 * @returns {object}         - Object with legacy field names populated.
 */
export function toLegacyClient(canonical) {
  if (!canonical || typeof canonical !== 'object') return {}

  return {
    ...canonical,
    name:     canonical.client_name    ?? canonical.name    ?? null,
    document: canonical.client_document ?? canonical.document ?? null,
    email:    canonical.client_email   ?? canonical.email   ?? null,
    phone:    canonical.client_phone   ?? canonical.phone   ?? null,
    city:     canonical.client_city    ?? canonical.city    ?? null,
    state:    canonical.client_state   ?? canonical.state   ?? null,
    address:  canonical.client_address ?? canonical.address ?? null,
    uc:       canonical.uc_geradora    ?? canonical.uc      ?? null,
  }
}

/**
 * Build a safe write payload from arbitrary inbound data, resolving
 * legacy/canonical aliases and returning only the canonical field names
 * suitable for INSERT / UPDATE statements.
 *
 * Returns null for each field that is not present in the input (i.e. it
 * never invents values).
 *
 * @param {object} input - Inbound data from a request or form.
 * @returns {object}     - Write-safe object with canonical client_* keys.
 */
export function toClientWritePayload(input) {
  if (!input || typeof input !== 'object') return {}

  return {
    client_name:     input.client_name    ?? input.name    ?? undefined,
    client_document: input.client_document ?? input.document ?? undefined,
    client_email:    input.client_email   ?? input.email   ?? undefined,
    client_phone:    input.client_phone   ?? input.phone   ?? undefined,
    client_city:     input.client_city    ?? input.city    ?? undefined,
    client_state:    input.client_state   ?? input.state   ?? undefined,
    client_address:  input.client_address ?? input.address ?? undefined,
    uc_geradora:     input.uc_geradora    ?? input.uc      ?? undefined,
  }
}
