// server/revenue-billing/repository.js
// Database queries for the Receita e Cobrança → Projetos tab.
//
// DEDUPLICATION STRATEGY
// ──────────────────────
// The clients table may contain:
//   1. Multiple rows with the same CPF/CNPJ (duplicates created over time).
//   2. Soft-deleted rows (deleted_at IS NOT NULL).
//   3. Merged rows (merged_into_client_id IS NOT NULL).
//   4. A single client may own multiple client_contracts rows (1:N).
//
// The canonical client selection resolves this:
//   • active_clients CTE: excludes deleted and merged rows.
//   • ranked_clients CTE: ranks per document_key (CPF or CNPJ), preferring
//     in_portfolio=true, then most recently updated/created, then largest id.
//   • canonical_clients CTE: keeps only rank=1 per document_key.
//   • LATERAL contract join: picks the single most relevant contract per
//     client (active first, then most recently updated, then largest id).
//
// Result: exactly ONE row per canonical active client.
//
// IMPORTANT: Uses the two-argument form sql(text, params) throughout to avoid
// the broken nested-sql-in-boolean pattern that causes "invalid input syntax
// for type boolean: {}" on Neon serverless.

// ─────────────────────────────────────────────────────────────────────────────
// Types (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RevenueClientRow
 * @property {number}      client_id
 * @property {string}      client_name
 * @property {string|null} document_key        — normalised digits (no formatting)
 * @property {string|null} document_type       — 'cpf' | 'cnpj' | null
 * @property {string|null} city
 * @property {string|null} state
 * @property {string|null} contract_id
 * @property {string|null} contract_type       — 'leasing' | 'sale' | 'buyout' | null
 * @property {string|null} contract_status     — 'draft' | 'active' | 'suspended' | 'completed' | 'cancelled' | null
 * @property {string|null} contract_start_date — ISO date string
 * @property {string|null} client_updated_at   — ISO datetime string
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and returns a safe ORDER BY column expression.
 * Only whitelisted keys are accepted; falls back to 'client_name'.
 *
 * @param {string|undefined} key
 * @param {'asc'|'desc'|undefined} dir
 * @returns {{ orderCol: string; orderDir: string }}
 */
function resolveOrder(key, dir) {
  const ORDER_MAP = Object.freeze({
    client:         'c.client_name',
    document:       'document_key',
    city:           'c.client_city',
    state:          'c.client_state',
    contract_type:  'contract_type',
    contract_status:'contract_status',
    updated_at:     'c.updated_at',
  })
  const orderCol = ORDER_MAP[key] ?? 'c.client_name'
  const orderDir = dir === 'desc' ? 'DESC' : 'ASC'
  return { orderCol, orderDir }
}

// ─────────────────────────────────────────────────────────────────────────────
// listRevenueClients
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns one canonical row per active, non-merged, non-deleted client.
 *
 * Clients are deduplicated by document (CPF or CNPJ). When two client rows
 * share the same document, the one with in_portfolio=true (or most recently
 * updated) is kept and the other is silently skipped.
 *
 * For each canonical client the most relevant contract is selected via a
 * LATERAL subquery (active status preferred, then most recent update, then
 * largest id as final tiebreaker).
 *
 * Accepts the following optional filters:
 *   search        — ILIKE match on name, document, city, state
 *   contract_type — exact match on contract.contract_type
 *   order_by      — one of: client | document | city | state | contract_type | contract_status | updated_at
 *   order_dir     — 'asc' | 'desc'
 *   limit         — max rows (default 200, max 500)
 *   offset        — pagination offset (default 0)
 *
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any,any>} sql
 * @param {Record<string,unknown>} [filters]
 * @returns {Promise<RevenueClientRow[]>}
 */
export async function listRevenueClients(sql, filters = {}) {
  const limit  = Math.min(Math.max(Number(filters.limit)  || 200, 1), 500)
  const offset = Math.max(Number(filters.offset) || 0, 0)

  const { orderCol, orderDir } = resolveOrder(filters.order_by, filters.order_dir)

  // Dynamic WHERE conditions applied to the canonical_clients alias (c).
  const conditions = []
  const params = []

  if (filters.search) {
    params.push(`%${filters.search}%`)
    const idx = params.length
    conditions.push(
      `(c.client_name ILIKE $${idx} OR document_key ILIKE $${idx} OR c.client_city ILIKE $${idx} OR c.client_state ILIKE $${idx})`,
    )
  }

  if (filters.contract_type && filters.contract_type !== '') {
    params.push(filters.contract_type)
    conditions.push(`contract_type = $${params.length}`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Pagination params (must come after all filter params).
  params.push(limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

  const queryText = `
    WITH active_clients AS (
      -- Exclude soft-deleted and merged client records.
      SELECT *
      FROM public.clients
      WHERE deleted_at IS NULL
        AND merged_into_client_id IS NULL
    ),
    ranked_clients AS (
      -- Assign a rank within each unique document key.
      -- Preference order:
      --   1. in_portfolio = true (these are confirmed active customers)
      --   2. most recently updated
      --   3. most recently created
      --   4. largest id (final deterministic tiebreaker)
      SELECT
        c.*,
        COALESCE(
          NULLIF(c.cpf_normalized,  ''),
          NULLIF(c.cnpj_normalized, ''),
          NULLIF(regexp_replace(c.client_document, '\\D', '', 'g'), '')
        ) AS document_key,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(
            NULLIF(c.cpf_normalized,  ''),
            NULLIF(c.cnpj_normalized, ''),
            NULLIF(regexp_replace(c.client_document, '\\D', '', 'g'), '')
          )
          ORDER BY
            c.in_portfolio DESC NULLS LAST,
            c.updated_at   DESC NULLS LAST,
            c.created_at   DESC NULLS LAST,
            c.id           DESC
        ) AS rn
      FROM active_clients c
    ),
    canonical_clients AS (
      -- One row per document key (or per client when document is absent).
      -- Clients without any document key (all columns NULL / empty) are kept
      -- as individual rows because they cannot be grouped.
      SELECT *
      FROM ranked_clients
      WHERE rn = 1
        OR document_key IS NULL
    )
    SELECT
      c.id                                        AS client_id,
      c.client_name,
      c.document_key,
      c.document_type,
      c.client_city                               AS city,
      c.client_state                              AS state,
      contract.id::text                           AS contract_id,
      contract.contract_type,
      contract.contract_status,
      contract.contract_start_date::text          AS contract_start_date,
      c.updated_at                                AS client_updated_at,
      COUNT(*) OVER()                             AS total_count
    FROM canonical_clients c
    -- LATERAL join: pick the single most-relevant contract per canonical client.
    -- Priority: active status first, then most recently updated, then largest id.
    LEFT JOIN LATERAL (
      SELECT
        cc.id,
        cc.contract_type,
        cc.contract_status,
        cc.contract_start_date
      FROM public.client_contracts cc
      WHERE cc.client_id = c.id
      ORDER BY
        CASE WHEN cc.contract_status = 'active' THEN 0 ELSE 1 END,
        cc.updated_at DESC NULLS LAST,
        cc.created_at DESC NULLS LAST,
        cc.id         DESC
      LIMIT 1
    ) contract ON TRUE
    ${whereClause}
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT  $${limitIdx}
    OFFSET $${offsetIdx}
  `

  console.info('[revenue-billing][clients] query', {
    limit,
    offset,
    order: `${orderCol} ${orderDir}`,
    search: filters.search ?? null,
    contract_type: filters.contract_type ?? null,
  })

  const rows = await sql(queryText, params)

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  console.info('[revenue-billing][clients] rows', { count: rows.length, total })

  return {
    data: rows.map((r) => ({
      client_id:          Number(r.client_id),
      client_name:        r.client_name ?? null,
      document_key:       r.document_key ?? null,
      document_type:      r.document_type ?? null,
      city:               r.city ?? null,
      state:              r.state ?? null,
      contract_id:        r.contract_id ?? null,
      contract_type:      r.contract_type ?? null,
      contract_status:    r.contract_status ?? null,
      contract_start_date:r.contract_start_date ?? null,
      client_updated_at:  r.client_updated_at ? String(r.client_updated_at) : null,
    })),
    total,
    limit,
    offset,
  }
}
