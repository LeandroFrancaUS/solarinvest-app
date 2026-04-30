// server/revenue-billing/repository.js
// Database queries for the Receita e Cobrança → Projetos tab.
//
// ACTIVE-CLIENT FILTER
// ────────────────────
// Only clients that are activated / in active portfolio are returned:
//   1. c.in_portfolio = true
//   OR
//   2. c.portfolio_exported_at IS NOT NULL
//   OR
//   3. EXISTS a client_contract whose status (lowercased) is one of:
//      'active', 'signed', 'completed', 'concluido', 'concluído'
//
// Clients that are only leads, only registered but never activated, deleted,
// or merged are excluded.
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
//   • active_closed_clients CTE: excludes deleted/merged rows AND applies the
//     activation filter above.
//   • ranked_clients CTE: ranks per COALESCE(cpf_normalized, cnpj_normalized,
//     stripped client_document, 'client-id-<id>').  The 'client-id-' fallback
//     ensures undocumented clients each get their own partition and are never
//     collapsed together.
//   • canonical_clients CTE: keeps only rank=1 per partition key.
//   • LATERAL contract join: picks the single most relevant contract per
//     client (active-like statuses first, then most recently updated, then
//     largest id).
//
// Result: exactly ONE row per canonical activated client.
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

// Active-like contract statuses (lowercase for comparison with lower()):
const ACTIVE_CONTRACT_STATUSES = Object.freeze([
  'active',
  'signed',
  'completed',
  'concluido',
  'concluído',
])

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
 * Returns one canonical row per activated, non-merged, non-deleted client.
 *
 * "Activated" means at least one of:
 *   • in_portfolio = true
 *   • portfolio_exported_at IS NOT NULL
 *   • has a client_contract with status in ('active','signed','completed','concluido','concluído')
 *
 * Clients are deduplicated by document (CPF or CNPJ). When two client rows
 * share the same document, the one with in_portfolio=true (or most recently
 * updated) is kept and the other is silently skipped. Clients without any
 * document are each kept as-is (not collapsed together).
 *
 * For each canonical client the most relevant contract is selected via a
 * LATERAL subquery (active-like statuses preferred, then most recent update,
 * then largest id as final tiebreaker).
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

  // Build the IN-list for active contract statuses as numbered params.
  // These come first so search/contract_type params follow them.
  const activeStatusPlaceholders = ACTIVE_CONTRACT_STATUSES.map((_, i) => `$${i + 1}`).join(', ')

  // Shift the filter params to account for the status params prepended above.
  const shiftedConditions = []
  const shiftedParams = [...ACTIVE_CONTRACT_STATUSES]

  if (filters.search) {
    shiftedParams.push(`%${filters.search}%`)
    const idx = shiftedParams.length
    shiftedConditions.push(
      `(c.client_name ILIKE $${idx} OR document_key ILIKE $${idx} OR c.client_city ILIKE $${idx} OR c.client_state ILIKE $${idx})`,
    )
  }

  if (filters.contract_type && filters.contract_type !== '') {
    shiftedParams.push(filters.contract_type)
    shiftedConditions.push(`contract_type = $${shiftedParams.length}`)
  }

  const whereClause2 = shiftedConditions.length > 0 ? `WHERE ${shiftedConditions.join(' AND ')}` : ''

  // Pagination params (must come after all filter params).
  shiftedParams.push(limit)
  const limitIdx2 = shiftedParams.length
  shiftedParams.push(offset)
  const offsetIdx2 = shiftedParams.length

  const queryText = `
    WITH active_closed_clients AS (
      -- Only clients that are activated / in active portfolio:
      --   1. in_portfolio = true
      --   2. portfolio_exported_at IS NOT NULL
      --   3. has at least one contract with an active-like status
      -- Excludes soft-deleted and merged records.
      SELECT *
      FROM public.clients
      WHERE deleted_at IS NULL
        AND merged_into_client_id IS NULL
        AND (
          in_portfolio = true
          OR portfolio_exported_at IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM public.client_contracts cc
            WHERE cc.client_id = public.clients.id
              AND lower(COALESCE(cc.contract_status, '')) IN (${activeStatusPlaceholders})
          )
        )
    ),
    ranked_clients AS (
      -- Assign a rank within each unique document key.
      -- Preference order:
      --   1. in_portfolio = true (confirmed active customers)
      --   2. most recently exported to portfolio
      --   3. most recently updated
      --   4. most recently created
      --   5. largest id (final deterministic tiebreaker)
      -- For clients without any document, use 'client-id-<id>' as partition key
      -- so each undocumented client is its own group and is never collapsed.
      SELECT
        c.*,
        NULLIF(
          COALESCE(
            NULLIF(c.cpf_normalized,  ''),
            NULLIF(c.cnpj_normalized, ''),
            NULLIF(regexp_replace(COALESCE(c.client_document, ''), '\\D', '', 'g'), '')
          ),
          ''
        ) AS document_key,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(
            NULLIF(c.cpf_normalized,  ''),
            NULLIF(c.cnpj_normalized, ''),
            NULLIF(regexp_replace(COALESCE(c.client_document, ''), '\\D', '', 'g'), ''),
            'client-id-' || c.id::text
          )
          ORDER BY
            CASE WHEN c.in_portfolio THEN 0 ELSE 1 END,
            c.portfolio_exported_at DESC NULLS LAST,
            c.updated_at            DESC NULLS LAST,
            c.created_at            DESC NULLS LAST,
            c.id                    DESC
        ) AS rn
      FROM active_closed_clients c
    ),
    canonical_clients AS (
      -- One row per document key (or per client when document is absent).
      SELECT *
      FROM ranked_clients
      WHERE rn = 1
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
    -- Priority: active-like statuses first, then most recently updated, then largest id.
    LEFT JOIN LATERAL (
      SELECT
        cc.id,
        cc.contract_type,
        cc.contract_status,
        cc.contract_start_date
      FROM public.client_contracts cc
      WHERE cc.client_id = c.id
      ORDER BY
        CASE
          WHEN lower(COALESCE(cc.contract_status, '')) IN (${activeStatusPlaceholders}) THEN 0
          ELSE 1
        END,
        cc.updated_at DESC NULLS LAST,
        cc.created_at DESC NULLS LAST,
        cc.id         DESC
      LIMIT 1
    ) contract ON TRUE
    ${whereClause2}
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT  $${limitIdx2}
    OFFSET $${offsetIdx2}
  `

  console.info('[revenue-billing][clients] query', {
    limit,
    offset,
    order: `${orderCol} ${orderDir}`,
    search: filters.search ?? null,
    contract_type: filters.contract_type ?? null,
  })

  const rows = await sql(queryText, shiftedParams)

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
