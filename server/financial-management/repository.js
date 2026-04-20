// server/financial-management/repository.js
// Database queries for the Financial Management area.
// Reads from: financial_entries, financial_categories, proposals, clients,
//             client_portfolio (project_financial_snapshots).
// Writes to:  financial_entries, project_financial_snapshots, financial_categories.
//
// IMPORTANT: The Neon @neondatabase/serverless client does NOT support nested
// sql-template fragments inside a parent sql`` template (e.g. `${cond ? sql`AND ...` : sql``}`).
// Doing so serialises the inner object as `{}` and causes "syntax error at or near $1" / AND.
// All dynamic-filter queries therefore use the two-argument form: sql(text, params)
// with an array-based conditions builder, exactly as proposals/repository.js does.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a value to a float, returning null for null/undefined/NaN.
 */
function toFloat(value) {
  if (value == null) return null
  const n = parseFloat(String(value))
  return isNaN(n) ? null : n
}

/**
 * Parses an ISO date string into a Date (or returns null).
 */
function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Categories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all active financial categories sorted by sort_order.
 * No dynamic filters — tagged template is safe here.
 */
export async function listFinancialCategories(sql) {
  console.info('[financial][categories] listing active categories')
  const rows = await sql`
    SELECT
      id::text,
      name,
      type,
      scope,
      is_active,
      sort_order,
      created_at,
      updated_at
    FROM financial_categories
    WHERE is_active = TRUE
    ORDER BY sort_order, name
  `
  console.info('[financial][categories] rows', { count: rows.length })
  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Entries — CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists financial entries with optional date range filter (by competence_date).
 * Uses sql(text, params) to avoid broken nested-sql-in-ternary pattern on Neon.
 */
export async function listFinancialEntries(sql, { from, to } = {}) {
  const fromDate = parseDate(from)
  const toDate = parseDate(to)

  console.info('[financial][entries] list', { from, to, fromDate: fromDate?.toISOString(), toDate: toDate?.toISOString() })

  const conditions = ['deleted_at IS NULL']
  const params = []

  if (fromDate) {
    params.push(fromDate)
    conditions.push(`competence_date >= $${params.length}`)
  }
  if (toDate) {
    params.push(toDate)
    conditions.push(`competence_date <= $${params.length}`)
  }

  const whereClause = conditions.join(' AND ')
  const queryText = `
    SELECT
      id::text,
      entry_type,
      scope_type,
      category,
      subcategory,
      description,
      amount::float,
      currency,
      competence_date::text,
      payment_date::text,
      status,
      is_recurring,
      recurrence_frequency,
      project_kind,
      project_id::text,
      proposal_id::text,
      client_id::text,
      consultant_id::text,
      notes,
      created_by_user_id,
      created_at,
      updated_at
    FROM financial_entries
    WHERE ${whereClause}
    ORDER BY competence_date DESC NULLS LAST, created_at DESC
  `

  console.info('[financial][entries] sql', { whereClause, paramCount: params.length })

  try {
    const rows = await sql(queryText, params)
    console.info('[financial][entries] rows', { count: rows.length })
    return rows
  } catch (err) {
    console.error('[financial][entries] query error', {
      code: err?.code,
      position: err?.position,
      routine: err?.routine,
      message: err instanceof Error ? err.message : String(err),
      whereClause,
      paramCount: params.length,
    })
    throw err
  }
}

/**
 * Gets a single financial entry by id.
 * No dynamic filters — tagged template is safe here.
 */
export async function getFinancialEntryById(sql, id) {
  const rows = await sql`
    SELECT
      id::text,
      entry_type,
      scope_type,
      category,
      subcategory,
      description,
      amount::float,
      currency,
      competence_date::text,
      payment_date::text,
      status,
      is_recurring,
      recurrence_frequency,
      project_kind,
      project_id::text,
      proposal_id::text,
      client_id::text,
      consultant_id::text,
      notes,
      created_by_user_id,
      created_at,
      updated_at
    FROM financial_entries
    WHERE id = ${id}::uuid
      AND deleted_at IS NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * Creates a new financial entry.
 * No dynamic filters — tagged template is safe here.
 */
export async function createFinancialEntry(sql, data, userId) {
  const {
    entry_type,
    scope_type = 'company',
    category = null,
    subcategory = null,
    description = null,
    amount = 0,
    currency = 'BRL',
    competence_date = null,
    payment_date = null,
    status = 'planned',
    is_recurring = false,
    recurrence_frequency = null,
    project_kind = null,
    project_id = null,
    proposal_id = null,
    client_id = null,
    consultant_id = null,
    notes = null,
  } = data

  const rows = await sql`
    INSERT INTO financial_entries (
      entry_type, scope_type, category, subcategory, description,
      amount, currency, competence_date, payment_date, status,
      is_recurring, recurrence_frequency, project_kind,
      project_id, proposal_id, client_id, consultant_id,
      notes, created_by_user_id, updated_by_user_id
    ) VALUES (
      ${entry_type}, ${scope_type}, ${category}, ${subcategory}, ${description},
      ${amount}, ${currency},
      ${competence_date ? new Date(competence_date) : null},
      ${payment_date ? new Date(payment_date) : null},
      ${status},
      ${is_recurring}, ${recurrence_frequency}, ${project_kind},
      ${project_id ?? null},
      ${proposal_id ?? null},
      ${client_id ?? null},
      ${consultant_id ?? null},
      ${notes}, ${userId ?? null}, ${userId ?? null}
    )
    RETURNING
      id::text, entry_type, scope_type, category, subcategory, description,
      amount::float, currency, competence_date::text, payment_date::text,
      status, is_recurring, recurrence_frequency, project_kind,
      project_id::text, proposal_id::text, client_id::text, consultant_id::text,
      notes, created_at, updated_at
  `
  return rows[0]
}

/**
 * Updates a financial entry by id.
 * No dynamic filters — tagged template is safe here.
 */
export async function updateFinancialEntry(sql, id, data, userId) {
  const {
    entry_type,
    scope_type,
    category = null,
    subcategory = null,
    description = null,
    amount,
    competence_date = null,
    payment_date = null,
    status,
    is_recurring = false,
    recurrence_frequency = null,
    project_kind = null,
    notes = null,
  } = data

  const rows = await sql`
    UPDATE financial_entries SET
      entry_type = ${entry_type},
      scope_type = ${scope_type},
      category = ${category},
      subcategory = ${subcategory},
      description = ${description},
      amount = ${amount},
      competence_date = ${competence_date ? new Date(competence_date) : null},
      payment_date = ${payment_date ? new Date(payment_date) : null},
      status = ${status},
      is_recurring = ${is_recurring},
      recurrence_frequency = ${recurrence_frequency},
      project_kind = ${project_kind},
      notes = ${notes},
      updated_by_user_id = ${userId ?? null},
      updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING
      id::text, entry_type, scope_type, category, subcategory, description,
      amount::float, currency, competence_date::text, payment_date::text,
      status, is_recurring, recurrence_frequency, project_kind,
      project_id::text, proposal_id::text, client_id::text, consultant_id::text,
      notes, created_at, updated_at
  `
  return rows[0] ?? null
}

/**
 * Soft-deletes a financial entry by id.
 * No dynamic filters — tagged template is safe here.
 */
export async function deleteFinancialEntry(sql, id, userId) {
  const rows = await sql`
    UPDATE financial_entries
    SET deleted_at = NOW(), updated_by_user_id = ${userId ?? null}
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING id::text
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregated KPIs.
 * Combines data from project_financial_snapshots and financial_entries.
 * Uses sql(text, params) to avoid broken nested-sql-in-ternary pattern on Neon.
 */
export async function getFinancialSummary(sql, { from, to } = {}) {
  const fromDate = parseDate(from)
  const toDate = parseDate(to)

  console.info('[financial][summary] query', { from, to })

  // Build snapshot filter
  const snapConditions = ['TRUE']
  const snapParams = []
  if (fromDate) {
    snapParams.push(fromDate)
    snapConditions.push(`created_at >= $${snapParams.length}`)
  }
  if (toDate) {
    snapParams.push(toDate)
    snapConditions.push(`created_at <= $${snapParams.length}`)
  }
  const snapWhere = snapConditions.join(' AND ')

  // Build entries filter
  const entConditions = ['deleted_at IS NULL']
  const entParams = []
  if (fromDate) {
    entParams.push(fromDate)
    entConditions.push(`competence_date >= $${entParams.length}`)
  }
  if (toDate) {
    entParams.push(toDate)
    entConditions.push(`competence_date <= $${entParams.length}`)
  }
  const entWhere = entConditions.join(' AND ')

  console.info('[financial][summary] snapWhere', { snapWhere, snapParamCount: snapParams.length })
  console.info('[financial][summary] entWhere', { entWhere, entParamCount: entParams.length })

  const snapQueryText = `
    SELECT
      COUNT(*) FILTER (WHERE project_kind = 'leasing')                    AS leasing_count,
      COUNT(*) FILTER (WHERE project_kind IN ('sale', 'buyout'))          AS sale_count,
      COALESCE(SUM(projected_revenue_total), 0)::float                    AS total_projected_revenue,
      COALESCE(SUM(contract_value), 0)::float                             AS total_realized_revenue,
      COALESCE(SUM(capex_total), 0)::float                                AS total_capex,
      COALESCE(AVG(roi_percent), 0)::float                                AS avg_roi_percent,
      COALESCE(AVG(payback_months), 0)::float                             AS avg_payback_months,
      COALESCE(SUM(monthly_revenue) FILTER (WHERE project_kind = 'leasing'), 0)::float AS mrr_leasing,
      COALESCE(SUM(contract_value) FILTER (WHERE project_kind IN ('sale', 'buyout')), 0)::float AS closed_sales_revenue,
      COALESCE(AVG(default_rate_percent), 0)::float                       AS avg_default_rate_percent
    FROM project_financial_snapshots
    WHERE ${snapWhere}
  `

  const entQueryText = `
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'expense'), 0)::float AS total_entries_expense,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'income'), 0)::float  AS total_entries_income
    FROM financial_entries
    WHERE ${entWhere}
  `

  try {
    const [snapshotRows, entryRows] = await Promise.all([
      sql(snapQueryText, snapParams),
      sql(entQueryText, entParams),
    ])

    const snap = snapshotRows[0] ?? {}
    const ent = entryRows[0] ?? {}

    const totalProjectedRevenue = toFloat(snap.total_projected_revenue) ?? 0
    const totalCapex = toFloat(snap.total_capex) ?? 0
    const totalEntriesExpense = toFloat(ent.total_entries_expense) ?? 0
    const totalEntriesIncome = toFloat(ent.total_entries_income) ?? 0
    const totalCost = totalCapex + totalEntriesExpense
    const totalRealizedRevenue = (toFloat(snap.total_realized_revenue) ?? 0) + totalEntriesIncome
    const netProfit = totalRealizedRevenue - totalCost
    const avgNetMarginPct = totalRealizedRevenue > 0 ? (netProfit / totalRealizedRevenue) * 100 : 0
    const activeProjectsCount = (snap.leasing_count ?? 0) + (snap.sale_count ?? 0)

    return {
      total_projected_revenue: totalProjectedRevenue,
      total_realized_revenue: totalRealizedRevenue,
      total_cost: totalCost,
      net_profit: netProfit,
      avg_roi_percent: toFloat(snap.avg_roi_percent) ?? 0,
      avg_payback_months: toFloat(snap.avg_payback_months) ?? 0,
      active_projects_count: activeProjectsCount,
      mrr_leasing: toFloat(snap.mrr_leasing) ?? 0,
      closed_sales_revenue: toFloat(snap.closed_sales_revenue) ?? 0,
      avg_default_rate_percent: toFloat(snap.avg_default_rate_percent) ?? 0,
      avg_net_margin_percent: avgNetMarginPct,
    }
  } catch (err) {
    console.error('[financial][summary] query error', {
      code: err?.code,
      position: err?.position,
      routine: err?.routine,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Projects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns project-level financial data from project_financial_snapshots
 * joined with clients for names.
 * Uses sql(text, params) to avoid broken nested-sql-in-ternary pattern on Neon.
 */
export async function listFinancialProjects(sql, { from, to } = {}) {
  const fromDate = parseDate(from)
  const toDate = parseDate(to)

  console.info('[financial][projects] list', { from, to })

  const conditions = ['TRUE']
  const params = []

  if (fromDate) {
    params.push(fromDate)
    conditions.push(`pfs.created_at >= $${params.length}`)
  }
  if (toDate) {
    params.push(toDate)
    conditions.push(`pfs.created_at <= $${params.length}`)
  }

  const whereClause = conditions.join(' AND ')
  const queryText = `
    SELECT
      pfs.id::text,
      pfs.project_kind,
      pfs.status,
      pfs.uf,
      pfs.capex_total::float,
      pfs.contract_value::float               AS realized_revenue,
      pfs.projected_revenue_total::float      AS projected_revenue,
      pfs.projected_profit::float,
      pfs.roi_percent::float,
      pfs.payback_months::float,
      pfs.irr_annual::float,
      pfs.monthly_revenue::float,
      pfs.default_rate_percent::float,
      pfs.commission_amount::float,
      pfs.created_at,
      c.client_name AS client_name,
      con.full_name AS consultant_name
    FROM project_financial_snapshots pfs
    LEFT JOIN clients c ON c.id = pfs.client_id
    LEFT JOIN consultants con ON con.id = pfs.consultant_id
    WHERE ${whereClause}
    ORDER BY pfs.created_at DESC
  `

  console.info('[financial][projects] sql', { whereClause, paramCount: params.length })

  try {
    const rows = await sql(queryText, params)
    console.info('[financial][projects] rows', { count: rows.length })
    return rows
  } catch (err) {
    console.error('[financial][projects] query error', {
      code: err?.code,
      position: err?.position,
      routine: err?.routine,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash Flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns monthly cash flow aggregated from financial_entries.
 * Each row has period_label, total_income, total_expense, net, cumulative.
 * Uses sql(text, params) to avoid broken nested-sql-in-ternary pattern on Neon.
 */
export async function getFinancialCashflow(sql, { from, to } = {}) {
  const fromDate = parseDate(from)
  const toDate = parseDate(to)

  console.info('[financial][cashflow] query', { from, to })

  const conditions = ['deleted_at IS NULL', 'competence_date IS NOT NULL']
  const params = []

  if (fromDate) {
    params.push(fromDate)
    conditions.push(`competence_date >= $${params.length}`)
  }
  if (toDate) {
    params.push(toDate)
    conditions.push(`competence_date <= $${params.length}`)
  }

  const whereClause = conditions.join(' AND ')
  const queryText = `
    SELECT
      TO_CHAR(DATE_TRUNC('month', competence_date), 'MM/YYYY') AS period_label,
      DATE_TRUNC('month', competence_date)                      AS period_date,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'income'),  0)::float AS total_income,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'expense'), 0)::float AS total_expense
    FROM financial_entries
    WHERE ${whereClause}
    GROUP BY DATE_TRUNC('month', competence_date)
    ORDER BY period_date ASC
  `

  console.info('[financial][cashflow] sql', { whereClause, paramCount: params.length })

  try {
    const rows = await sql(queryText, params)
    console.info('[financial][cashflow] rows', { count: rows.length })

    let cumulative = 0
    return rows.map((row) => {
      const net = (toFloat(row.total_income) ?? 0) - (toFloat(row.total_expense) ?? 0)
      cumulative += net
      return {
        period_label: row.period_label,
        total_income: toFloat(row.total_income) ?? 0,
        total_expense: toFloat(row.total_expense) ?? 0,
        net,
        cumulative,
      }
    })
  } catch (err) {
    console.error('[financial][cashflow] query error', {
      code: err?.code,
      position: err?.position,
      routine: err?.routine,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

