// server/operational-tasks/repository.js
// Data access layer for operational dashboard tasks.

/**
 * List operational tasks with optional filters
 */
export async function listOperationalTasks(sql, filters = {}) {
  const {
    clientId,
    type,
    status,
    priority,
    responsibleUserId,
    scheduledBefore,
    scheduledAfter,
    limit = 1000,
  } = filters

  const conditions = []
  const params = []

  if (clientId) {
    conditions.push(`client_id = $${params.length + 1}`)
    params.push(clientId)
  }

  if (type) {
    conditions.push(`type = $${params.length + 1}`)
    params.push(type)
  }

  if (status) {
    conditions.push(`status = $${params.length + 1}`)
    params.push(status)
  }

  if (priority) {
    conditions.push(`priority = $${params.length + 1}`)
    params.push(priority)
  }

  if (responsibleUserId) {
    conditions.push(`responsible_user_id = $${params.length + 1}`)
    params.push(responsibleUserId)
  }

  if (scheduledBefore) {
    conditions.push(`scheduled_for < $${params.length + 1}`)
    params.push(scheduledBefore)
  }

  if (scheduledAfter) {
    conditions.push(`scheduled_for > $${params.length + 1}`)
    params.push(scheduledAfter)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  params.push(limit)

  const queryText = `
    SELECT
      id,
      type,
      title,
      priority,
      client_id,
      client_name,
      proposal_id,
      project_id,
      status,
      scheduled_for,
      completed_at,
      blocked_reason,
      responsible_user_id,
      notes,
      metadata,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    FROM public.dashboard_operational_tasks
    ${whereClause}
    ORDER BY
      CASE priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      scheduled_for ASC NULLS LAST,
      created_at DESC
    LIMIT $${params.length}
  `

  const rows = await sql(queryText, params)
  return rows
}

/**
 * Get a single task by ID
 */
export async function getTaskById(sql, taskId) {
  const rows = await sql`
    SELECT
      id,
      type,
      title,
      priority,
      client_id,
      client_name,
      proposal_id,
      project_id,
      status,
      scheduled_for,
      completed_at,
      blocked_reason,
      responsible_user_id,
      notes,
      metadata,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    FROM public.dashboard_operational_tasks
    WHERE id = ${taskId}
  `
  return rows[0] || null
}

/**
 * Create a new operational task
 */
export async function createTask(sql, data, userId) {
  const {
    type,
    title,
    priority = 'MEDIUM',
    client_id = null,
    client_name = null,
    proposal_id = null,
    project_id = null,
    status = 'NOT_SCHEDULED',
    scheduled_for = null,
    responsible_user_id = null,
    notes = null,
    metadata = null,
  } = data

  const rows = await sql`
    INSERT INTO public.dashboard_operational_tasks (
      type,
      title,
      priority,
      client_id,
      client_name,
      proposal_id,
      project_id,
      status,
      scheduled_for,
      responsible_user_id,
      notes,
      metadata,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (
      ${type},
      ${title},
      ${priority},
      ${client_id},
      ${client_name},
      ${proposal_id},
      ${project_id},
      ${status},
      ${scheduled_for},
      ${responsible_user_id},
      ${notes},
      ${metadata ? sql.json(metadata) : null},
      ${userId},
      ${userId},
      NOW(),
      NOW()
    )
    RETURNING *
  `
  return rows[0]
}

/**
 * Update an operational task
 */
export async function updateTask(sql, taskId, patch, userId) {
  const allowedFields = [
    'title',
    'priority',
    'status',
    'scheduled_for',
    'completed_at',
    'blocked_reason',
    'responsible_user_id',
    'notes',
    'metadata',
  ]

  const updates = {}
  for (const key of allowedFields) {
    if (key in patch) {
      updates[key] = patch[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return getTaskById(sql, taskId)
  }

  const setClauses = []
  const values = []

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'metadata' && value !== null) {
      setClauses.push(`${key} = $${values.length + 1}::jsonb`)
      values.push(JSON.stringify(value))
    } else {
      setClauses.push(`${key} = $${values.length + 1}`)
      values.push(value)
    }
  }

  setClauses.push(`updated_by_user_id = $${values.length + 1}`)
  values.push(userId)
  setClauses.push(`updated_at = NOW()`)

  values.push(taskId)

  const setClause = setClauses.join(', ')
  const queryText = `
    UPDATE public.dashboard_operational_tasks
    SET ${setClause}
    WHERE id = $${values.length}
    RETURNING *
  `

  const rows = await sql(queryText, values)
  return rows[0] || null
}

/**
 * Delete a task
 */
export async function deleteTask(sql, taskId) {
  const rows = await sql`
    DELETE FROM public.dashboard_operational_tasks
    WHERE id = ${taskId}
    RETURNING id
  `
  return rows.length > 0
}

/**
 * Log activity for audit trail
 */
export async function logActivity(sql, data) {
  const {
    entity_type,
    entity_id,
    action,
    performed_by,
    performed_by_name = null,
    metadata = null,
  } = data

  await sql`
    INSERT INTO public.dashboard_activity_log (
      entity_type,
      entity_id,
      action,
      performed_by,
      performed_by_name,
      metadata,
      created_at
    ) VALUES (
      ${entity_type},
      ${entity_id},
      ${action},
      ${performed_by},
      ${performed_by_name},
      ${metadata ? sql.json(metadata) : null},
      NOW()
    )
  `
}

/**
 * Get activity history for an entity
 */
export async function getActivityHistory(sql, entityType, entityId, limit = 50) {
  const rows = await sql`
    SELECT
      id,
      entity_type,
      entity_id,
      action,
      performed_by,
      performed_by_name,
      metadata,
      created_at
    FROM public.dashboard_activity_log
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(sql, userId) {
  const rows = await sql`
    SELECT
      id,
      user_id,
      visual_enabled,
      sound_enabled,
      push_enabled,
      overdue_invoices,
      due_soon_invoices,
      kit_delivery_updates,
      installation_updates,
      support_updates,
      critical_only,
      quiet_hours_start,
      quiet_hours_end,
      created_at,
      updated_at
    FROM public.dashboard_notification_preferences
    WHERE user_id = ${userId}
  `

  if (rows.length === 0) {
    // Return default preferences
    return {
      visual_enabled: true,
      sound_enabled: true,
      push_enabled: false,
      overdue_invoices: true,
      due_soon_invoices: true,
      kit_delivery_updates: true,
      installation_updates: true,
      support_updates: true,
      critical_only: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
    }
  }

  return rows[0]
}

/**
 * Upsert notification preferences
 */
export async function upsertNotificationPreferences(sql, userId, prefs) {
  const {
    visual_enabled = true,
    sound_enabled = true,
    push_enabled = false,
    overdue_invoices = true,
    due_soon_invoices = true,
    kit_delivery_updates = true,
    installation_updates = true,
    support_updates = true,
    critical_only = false,
    quiet_hours_start = null,
    quiet_hours_end = null,
  } = prefs

  const rows = await sql`
    INSERT INTO public.dashboard_notification_preferences (
      user_id,
      visual_enabled,
      sound_enabled,
      push_enabled,
      overdue_invoices,
      due_soon_invoices,
      kit_delivery_updates,
      installation_updates,
      support_updates,
      critical_only,
      quiet_hours_start,
      quiet_hours_end,
      created_at,
      updated_at
    ) VALUES (
      ${userId},
      ${visual_enabled},
      ${sound_enabled},
      ${push_enabled},
      ${overdue_invoices},
      ${due_soon_invoices},
      ${kit_delivery_updates},
      ${installation_updates},
      ${support_updates},
      ${critical_only},
      ${quiet_hours_start},
      ${quiet_hours_end},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      visual_enabled = EXCLUDED.visual_enabled,
      sound_enabled = EXCLUDED.sound_enabled,
      push_enabled = EXCLUDED.push_enabled,
      overdue_invoices = EXCLUDED.overdue_invoices,
      due_soon_invoices = EXCLUDED.due_soon_invoices,
      kit_delivery_updates = EXCLUDED.kit_delivery_updates,
      installation_updates = EXCLUDED.installation_updates,
      support_updates = EXCLUDED.support_updates,
      critical_only = EXCLUDED.critical_only,
      quiet_hours_start = EXCLUDED.quiet_hours_start,
      quiet_hours_end = EXCLUDED.quiet_hours_end,
      updated_at = NOW()
    RETURNING *
  `
  return rows[0]
}
