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

/**
 * @typedef {Object} RevenueProjectRow
 * @property {string}      project_id          — UUID string
 * @property {number}      client_id
 * @property {string|null} client_name
 * @property {string|null} document_key        — normalised digits (no formatting)
 * @property {string|null} document_type       — 'cpf' | 'cnpj' | null
 * @property {string|null} city
 * @property {string|null} state
 * @property {string|null} project_type        — 'leasing' | 'venda'
 * @property {string|null} project_status      — 'Aguardando' | 'Em andamento' | 'Concluído'
 * @property {string|null} contract_id
 * @property {string|null} contract_type
 * @property {string|null} contract_status
 * @property {string|null} contract_start_date — ISO date string
 * @property {string|null} updated_at          — ISO datetime string
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

// ─────────────────────────────────────────────────────────────────────────────
// listRevenueProjects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns one row per active/closed project whose client is activated
 * (in_portfolio, portfolio_exported_at, or at least one active contract).
 *
 * The query starts from public.projects — never from public.clients — so the
 * result is semantically "one project per row" and duplicated client rows in
 * the clients table cannot inflate the count.
 *
 * A client with two distinct closed projects will appear twice, one row per
 * project. CPF/CNPJ deduplication across client rows is NOT applied here;
 * each project.id is already unique.
 *
 * The LATERAL contract join picks the single most-relevant contract for the
 * project's client (active-like statuses preferred, then most-recent update).
 *
 * Accepts the following optional filters (same interface as listRevenueClients):
 *   search        — ILIKE match on name, document, city, state
 *   contract_type — exact match on contract.contract_type
 *   order_by      — one of: client | document | city | state | project_type |
 *                   project_status | updated_at
 *   order_dir     — 'asc' | 'desc'
 *   limit         — max rows (default 200, max 500)
 *   offset        — pagination offset (default 0)
 *
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any,any>} sql
 * @param {Record<string,unknown>} [filters]
 * @returns {Promise<{ data: RevenueProjectRow[]; total: number; limit: number; offset: number }>}
 */
export async function listRevenueProjects(sql, filters = {}) {
  const limit  = Math.min(Math.max(Number(filters.limit)  || 200, 1), 500)
  const offset = Math.max(Number(filters.offset) || 0, 0)

  const ORDER_MAP = Object.freeze({
    client:         'client_name',
    document:       'document_key',
    city:           'city',
    state:          'state',
    project_type:   'p.project_type',
    project_status: 'p.status',
    updated_at:     'p.updated_at',
  })
  const orderCol = ORDER_MAP[filters.order_by] ?? 'p.updated_at'
  const orderDir = filters.order_dir === 'asc' ? 'ASC' : 'DESC'

  // Active-like contract statuses — prepended as $1..$5 so the same list is
  // reused in both the EXISTS subquery and the LATERAL ORDER BY CASE.
  const activeStatusPlaceholders = ACTIVE_CONTRACT_STATUSES.map((_, i) => `$${i + 1}`).join(', ')

  const params = [...ACTIVE_CONTRACT_STATUSES]

  const filterConditions = []

  if (filters.search) {
    params.push(`%${filters.search}%`)
    const idx = params.length
    filterConditions.push(
      `(client_name ILIKE $${idx} OR document_key ILIKE $${idx} OR city ILIKE $${idx} OR state ILIKE $${idx})`,
    )
  }

  if (filters.contract_type && filters.contract_type !== '') {
    params.push(filters.contract_type)
    filterConditions.push(`contract_type = $${params.length}`)
  }

  const whereClause = filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : ''

  params.push(limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

  const queryText = `
    WITH active_closed_clients AS (
      -- Clients that are activated / in active portfolio.
      -- Excludes soft-deleted and merged records.
      SELECT id, client_name, document_type, client_city, client_state,
             cpf_normalized, cnpj_normalized, client_document
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
    project_rows AS (
      SELECT
        p.id::text                                         AS project_id,
        p.client_id,
        p.project_type,
        p.status,
        p.updated_at,
        -- Client name: prefer the live client record, fall back to snapshot
        COALESCE(c.client_name, p.client_name_snapshot)   AS client_name,
        -- Normalised document key (raw digits only, no formatting)
        NULLIF(
          COALESCE(
            NULLIF(c.cpf_normalized, ''),
            NULLIF(c.cnpj_normalized, ''),
            NULLIF(regexp_replace(COALESCE(c.client_document, ''), '\\D', '', 'g'), ''),
            NULLIF(regexp_replace(COALESCE(p.cpf_cnpj_snapshot, ''), '\\D', '', 'g'), '')
          ),
          ''
        )                                                  AS document_key,
        c.document_type,
        -- Location: prefer snapshot (captured at project creation)
        COALESCE(p.city_snapshot,  c.client_city)          AS city,
        COALESCE(p.state_snapshot, c.client_state)         AS state
      FROM public.projects p
      JOIN active_closed_clients c ON c.id = p.client_id
      WHERE p.deleted_at IS NULL
    )
    SELECT
      pr.project_id,
      pr.client_id,
      pr.client_name,
      pr.document_key,
      pr.document_type,
      pr.city,
      pr.state,
      pr.project_type,
      pr.status                              AS project_status,
      pr.updated_at,
      contract.id::text                      AS contract_id,
      contract.contract_type,
      contract.contract_status,
      contract.contract_start_date::text     AS contract_start_date,
      COUNT(*) OVER()                        AS total_count
    FROM project_rows pr
    -- LATERAL: pick the single most-relevant contract for this client.
    -- Priority: active-like statuses first, then most recently updated, then
    -- largest id as deterministic tiebreaker.
    LEFT JOIN LATERAL (
      SELECT
        cc.id,
        cc.contract_type,
        cc.contract_status,
        cc.contract_start_date
      FROM public.client_contracts cc
      WHERE cc.client_id = pr.client_id
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
    ${whereClause}
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT  $${limitIdx}
    OFFSET $${offsetIdx}
  `

  console.info('[revenue-billing][projects] query', {
    limit,
    offset,
    order: `${orderCol} ${orderDir}`,
    search: filters.search ?? null,
    contract_type: filters.contract_type ?? null,
  })

  const rows = await sql(queryText, params)

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  console.info('[revenue-billing][projects] rows', { count: rows.length, total })

  return {
    data: rows.map((r) => ({
      project_id:          String(r.project_id),
      client_id:           Number(r.client_id),
      client_name:         r.client_name ?? null,
      document_key:        r.document_key ?? null,
      document_type:       r.document_type ?? null,
      city:                r.city ?? null,
      state:               r.state ?? null,
      project_type:        r.project_type ?? null,
      project_status:      r.project_status ?? null,
      contract_id:         r.contract_id ?? null,
      contract_type:       r.contract_type ?? null,
      contract_status:     r.contract_status ?? null,
      contract_start_date: r.contract_start_date ?? null,
      updated_at:          r.updated_at ? String(r.updated_at) : null,
    })),
    total,
    limit,
    offset,
  }
}
