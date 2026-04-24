// server/operational-dashboard/repository.js
// Data access layer for operational dashboard tasks.

/**
 * List operational tasks with optional filters, ordered by priority then scheduled date.
 * @param {import('postgres').Sql} sql
 * @param {{ status?: string, type?: string, priority?: string, clientId?: string }} filters
 */
export async function listOperationalTasks(sql, { status, type, priority, clientId } = {}) {
  const rows = await sql`
    SELECT *
    FROM public.dashboard_operational_tasks
    WHERE
      (${status ?? null} IS NULL OR status = ${status ?? null})
      AND (${type ?? null} IS NULL OR type = ${type ?? null})
      AND (${priority ?? null} IS NULL OR priority = ${priority ?? null})
      AND (${clientId ?? null} IS NULL OR client_id = ${clientId ?? null}::integer)
    ORDER BY
      CASE priority
        WHEN 'CRITICAL' THEN 0
        WHEN 'HIGH'     THEN 1
        WHEN 'MEDIUM'   THEN 2
        ELSE 3
      END,
      scheduled_for ASC NULLS LAST,
      created_at DESC
  `
  return rows
}

/**
 * Get a single task by ID.
 * @param {import('postgres').Sql} sql
 * @param {number|string} id
 */
export async function getOperationalTaskById(sql, id) {
  const rows = await sql`
    SELECT * FROM public.dashboard_operational_tasks WHERE id = ${Number(id)}
  `
  return rows[0] ?? null
}

/**
 * Create a new operational task.
 * @param {import('postgres').Sql} sql
 * @param {object} data
 */
export async function createOperationalTask(sql, data) {
  const rows = await sql`
    INSERT INTO public.dashboard_operational_tasks
      (type, title, client_id, client_name, proposal_id, status,
       scheduled_for, blocked_reason, responsible_user_id, priority, notes)
    VALUES (
      ${data.type},
      ${data.title},
      ${data.clientId ?? null},
      ${data.clientName ?? ''},
      ${data.proposalId ?? null},
      ${data.status ?? 'NOT_SCHEDULED'},
      ${data.scheduledFor ?? null},
      ${data.blockedReason ?? null},
      ${data.responsibleUserId ?? null},
      ${data.priority ?? 'MEDIUM'},
      ${data.notes ?? null}
    )
    RETURNING *
  `
  return rows[0]
}

/**
 * Update an existing operational task (partial update).
 * @param {import('postgres').Sql} sql
 * @param {number|string} id
 * @param {object} patch
 */
export async function updateOperationalTask(sql, id, patch) {
  const colMap = {
    type: 'type',
    title: 'title',
    clientId: 'client_id',
    clientName: 'client_name',
    proposalId: 'proposal_id',
    status: 'status',
    scheduledFor: 'scheduled_for',
    completedAt: 'completed_at',
    blockedReason: 'blocked_reason',
    responsibleUserId: 'responsible_user_id',
    priority: 'priority',
    notes: 'notes',
  }

  const updates = {}
  for (const [jsKey, dbCol] of Object.entries(colMap)) {
    if (Object.prototype.hasOwnProperty.call(patch, jsKey)) {
      updates[dbCol] = patch[jsKey]
    }
  }

  if (Object.keys(updates).length === 0) {
    return getOperationalTaskById(sql, id)
  }

  // Build dynamic update using postgres.js unsafe helper for column names
  const setClauses = Object.keys(updates).map((col) => `${col} = $${Object.keys(updates).indexOf(col) + 2}`)
  const values = [Number(id), ...Object.values(updates)]

  const queryText = `
    UPDATE public.dashboard_operational_tasks
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `
  const rows = await sql.unsafe(queryText, values)
  return rows[0] ?? null
}

/**
 * Delete an operational task by ID.
 * @param {import('postgres').Sql} sql
 * @param {number|string} id
 */
export async function deleteOperationalTask(sql, id) {
  const rows = await sql`
    DELETE FROM public.dashboard_operational_tasks WHERE id = ${Number(id)} RETURNING id
  `
  return rows.length > 0
}

/**
 * Get aggregate KPI summary for the operational dashboard.
 * @param {import('postgres').Sql} sql
 */
export async function getOperationalKpiSummary(sql) {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('DONE','CANCELLED'))::int AS active_tasks,
      COUNT(*) FILTER (WHERE status = 'BLOCKED')::int AS blocked_tasks,
      COUNT(*) FILTER (WHERE priority = 'CRITICAL' AND status NOT IN ('DONE','CANCELLED'))::int AS critical_tasks,
      COUNT(*) FILTER (WHERE status = 'DONE')::int AS completed_tasks,
      COUNT(*) FILTER (WHERE type = 'KIT_DELIVERY' AND status NOT IN ('DONE','CANCELLED'))::int AS pending_deliveries,
      COUNT(*) FILTER (WHERE type = 'INSTALLATION' AND status NOT IN ('DONE','CANCELLED'))::int AS pending_installations,
      COUNT(*) FILTER (WHERE type = 'TECH_SUPPORT' AND status NOT IN ('DONE','CANCELLED'))::int AS open_support_tickets
    FROM public.dashboard_operational_tasks
  `
  return rows[0]
}
