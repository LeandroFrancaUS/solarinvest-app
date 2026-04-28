// server/operations/repository.js
// Data access layer for the Operação domain.
// All functions receive a user-scoped sql client (RLS context already set).

// ─────────────────────────────────────────────────────────────────────────────
// Service Tickets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} sql
 * @param {{ client_id?: number|null, project_id?: string|null, status?: string|null }} filters
 */
export async function listServiceTickets(sql, filters = {}) {
  const { client_id, project_id, status } = filters
  const rows = await sql`
    SELECT
      id, client_id, project_id, ticket_type, priority, status,
      title, description, responsible_user_id,
      scheduled_at, resolved_at, created_at, updated_at
    FROM public.service_tickets
    WHERE TRUE
      ${client_id  != null ? sql`AND client_id  = ${client_id}`  : sql``}
      ${project_id != null ? sql`AND project_id = ${project_id}` : sql``}
      ${status     != null ? sql`AND status     = ${status}`     : sql``}
    ORDER BY created_at DESC
  `
  return rows
}

/**
 * @param {Function} sql
 * @param {object} data
 */
export async function createServiceTicket(sql, data) {
  const {
    client_id,
    project_id = null,
    ticket_type = null,
    priority = null,
    status = 'aberto',
    title,
    description = null,
    responsible_user_id = null,
    scheduled_at = null,
  } = data

  const rows = await sql`
    INSERT INTO public.service_tickets
      (client_id, project_id, ticket_type, priority, status,
       title, description, responsible_user_id, scheduled_at)
    VALUES
      (${client_id}, ${project_id}, ${ticket_type}, ${priority}, ${status},
       ${title}, ${description}, ${responsible_user_id}, ${scheduled_at})
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * @param {Function} sql
 * @param {string} id
 * @param {object} patch
 */
export async function updateServiceTicket(sql, id, patch) {
  const {
    ticket_type,
    priority,
    status,
    title,
    description,
    responsible_user_id,
    scheduled_at,
    resolved_at,
  } = patch

  const rows = await sql`
    UPDATE public.service_tickets
    SET
      ticket_type         = COALESCE(${ticket_type         ?? null}, ticket_type),
      priority            = COALESCE(${priority            ?? null}, priority),
      status              = COALESCE(${status              ?? null}, status),
      title               = COALESCE(${title               ?? null}, title),
      description         = COALESCE(${description         ?? null}, description),
      responsible_user_id = COALESCE(${responsible_user_id ?? null}, responsible_user_id),
      scheduled_at        = COALESCE(${scheduled_at        ?? null}, scheduled_at),
      resolved_at         = COALESCE(${resolved_at         ?? null}, resolved_at),
      updated_at          = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance Jobs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} sql
 * @param {{ client_id?: number|null, project_id?: string|null, status?: string|null }} filters
 */
export async function listMaintenanceJobs(sql, filters = {}) {
  const { client_id, project_id, status } = filters
  const rows = await sql`
    SELECT
      id, client_id, project_id, maintenance_type, status,
      scheduled_date, completed_date, technician_name, report, cost,
      created_at, updated_at
    FROM public.maintenance_jobs
    WHERE TRUE
      ${client_id  != null ? sql`AND client_id  = ${client_id}`  : sql``}
      ${project_id != null ? sql`AND project_id = ${project_id}` : sql``}
      ${status     != null ? sql`AND status     = ${status}`     : sql``}
    ORDER BY created_at DESC
  `
  return rows
}

/**
 * @param {Function} sql
 * @param {object} data
 */
export async function createMaintenanceJob(sql, data) {
  const {
    client_id,
    project_id = null,
    maintenance_type = null,
    status = 'planejada',
    scheduled_date = null,
    completed_date = null,
    technician_name = null,
    report = null,
    cost = 0,
  } = data

  const rows = await sql`
    INSERT INTO public.maintenance_jobs
      (client_id, project_id, maintenance_type, status,
       scheduled_date, completed_date, technician_name, report, cost)
    VALUES
      (${client_id}, ${project_id}, ${maintenance_type}, ${status},
       ${scheduled_date}, ${completed_date}, ${technician_name}, ${report}, ${cost})
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * @param {Function} sql
 * @param {string} id
 * @param {object} patch
 */
export async function updateMaintenanceJob(sql, id, patch) {
  const {
    maintenance_type,
    status,
    scheduled_date,
    completed_date,
    technician_name,
    report,
    cost,
  } = patch

  const rows = await sql`
    UPDATE public.maintenance_jobs
    SET
      maintenance_type = COALESCE(${maintenance_type ?? null}, maintenance_type),
      status           = COALESCE(${status           ?? null}, status),
      scheduled_date   = COALESCE(${scheduled_date   ?? null}, scheduled_date),
      completed_date   = COALESCE(${completed_date   ?? null}, completed_date),
      technician_name  = COALESCE(${technician_name  ?? null}, technician_name),
      report           = COALESCE(${report           ?? null}, report),
      cost             = COALESCE(${cost             ?? null}, cost),
      updated_at       = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleaning Jobs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} sql
 * @param {{ client_id?: number|null, project_id?: string|null, status?: string|null }} filters
 */
export async function listCleaningJobs(sql, filters = {}) {
  const { client_id, project_id, status } = filters
  const rows = await sql`
    SELECT
      id, client_id, project_id, periodicity, status,
      scheduled_date, completed_date, responsible_name, notes,
      created_at, updated_at
    FROM public.cleaning_jobs
    WHERE TRUE
      ${client_id  != null ? sql`AND client_id  = ${client_id}`  : sql``}
      ${project_id != null ? sql`AND project_id = ${project_id}` : sql``}
      ${status     != null ? sql`AND status     = ${status}`     : sql``}
    ORDER BY created_at DESC
  `
  return rows
}

/**
 * @param {Function} sql
 * @param {object} data
 */
export async function createCleaningJob(sql, data) {
  const {
    client_id,
    project_id = null,
    periodicity = null,
    status = 'planejada',
    scheduled_date = null,
    completed_date = null,
    responsible_name = null,
    notes = null,
  } = data

  const rows = await sql`
    INSERT INTO public.cleaning_jobs
      (client_id, project_id, periodicity, status,
       scheduled_date, completed_date, responsible_name, notes)
    VALUES
      (${client_id}, ${project_id}, ${periodicity}, ${status},
       ${scheduled_date}, ${completed_date}, ${responsible_name}, ${notes})
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * @param {Function} sql
 * @param {string} id
 * @param {object} patch
 */
export async function updateCleaningJob(sql, id, patch) {
  const {
    periodicity,
    status,
    scheduled_date,
    completed_date,
    responsible_name,
    notes,
  } = patch

  const rows = await sql`
    UPDATE public.cleaning_jobs
    SET
      periodicity      = COALESCE(${periodicity      ?? null}, periodicity),
      status           = COALESCE(${status           ?? null}, status),
      scheduled_date   = COALESCE(${scheduled_date   ?? null}, scheduled_date),
      completed_date   = COALESCE(${completed_date   ?? null}, completed_date),
      responsible_name = COALESCE(${responsible_name ?? null}, responsible_name),
      notes            = COALESCE(${notes            ?? null}, notes),
      updated_at       = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance Policies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} sql
 * @param {{ client_id?: number|null, project_id?: string|null, status?: string|null }} filters
 */
export async function listInsurancePolicies(sql, filters = {}) {
  const { client_id, project_id, status } = filters
  const rows = await sql`
    SELECT
      id, client_id, project_id, insurer, policy_number, coverage,
      deductible, start_date, end_date, status, notes,
      created_at, updated_at
    FROM public.insurance_policies
    WHERE TRUE
      ${client_id  != null ? sql`AND client_id  = ${client_id}`  : sql``}
      ${project_id != null ? sql`AND project_id = ${project_id}` : sql``}
      ${status     != null ? sql`AND status     = ${status}`     : sql``}
    ORDER BY created_at DESC
  `
  return rows
}

/**
 * @param {Function} sql
 * @param {object} data
 */
export async function createInsurancePolicy(sql, data) {
  const {
    client_id,
    project_id = null,
    insurer = null,
    policy_number = null,
    coverage = null,
    deductible = null,
    start_date = null,
    end_date = null,
    status = 'pendente',
    notes = null,
  } = data

  const rows = await sql`
    INSERT INTO public.insurance_policies
      (client_id, project_id, insurer, policy_number, coverage,
       deductible, start_date, end_date, status, notes)
    VALUES
      (${client_id}, ${project_id}, ${insurer}, ${policy_number}, ${coverage},
       ${deductible}, ${start_date}, ${end_date}, ${status}, ${notes})
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * @param {Function} sql
 * @param {string} id
 * @param {object} patch
 */
export async function updateInsurancePolicy(sql, id, patch) {
  const {
    insurer,
    policy_number,
    coverage,
    deductible,
    start_date,
    end_date,
    status,
    notes,
  } = patch

  const rows = await sql`
    UPDATE public.insurance_policies
    SET
      insurer       = COALESCE(${insurer        ?? null}, insurer),
      policy_number = COALESCE(${policy_number  ?? null}, policy_number),
      coverage      = COALESCE(${coverage       ?? null}, coverage),
      deductible    = COALESCE(${deductible     ?? null}, deductible),
      start_date    = COALESCE(${start_date     ?? null}, start_date),
      end_date      = COALESCE(${end_date       ?? null}, end_date),
      status        = COALESCE(${status         ?? null}, status),
      notes         = COALESCE(${notes          ?? null}, notes),
      updated_at    = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation Events (Agenda)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} sql
 * @param {{ client_id?: number|null, project_id?: string|null, status?: string|null }} filters
 */
export async function listOperationEvents(sql, filters = {}) {
  const { client_id, project_id, status } = filters
  const rows = await sql`
    SELECT
      id, client_id, project_id, source_type, source_id,
      title, event_type, starts_at, ends_at, status, notes,
      created_at, updated_at
    FROM public.operation_events
    WHERE TRUE
      ${client_id  != null ? sql`AND client_id  = ${client_id}`  : sql``}
      ${project_id != null ? sql`AND project_id = ${project_id}` : sql``}
      ${status     != null ? sql`AND status     = ${status}`     : sql``}
    ORDER BY starts_at ASC
  `
  return rows
}

/**
 * @param {Function} sql
 * @param {object} data
 */
export async function createOperationEvent(sql, data) {
  const {
    client_id = null,
    project_id = null,
    source_type = 'manual',
    source_id = null,
    title,
    event_type = null,
    starts_at,
    ends_at = null,
    status = 'agendado',
    notes = null,
  } = data

  const rows = await sql`
    INSERT INTO public.operation_events
      (client_id, project_id, source_type, source_id,
       title, event_type, starts_at, ends_at, status, notes)
    VALUES
      (${client_id}, ${project_id}, ${source_type}, ${source_id},
       ${title}, ${event_type}, ${starts_at}, ${ends_at}, ${status}, ${notes})
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * @param {Function} sql
 * @param {string} id
 * @param {object} patch
 */
export async function updateOperationEvent(sql, id, patch) {
  const {
    source_type,
    source_id,
    title,
    event_type,
    starts_at,
    ends_at,
    status,
    notes,
  } = patch

  const rows = await sql`
    UPDATE public.operation_events
    SET
      source_type = COALESCE(${source_type ?? null}, source_type),
      source_id   = COALESCE(${source_id   ?? null}, source_id),
      title       = COALESCE(${title       ?? null}, title),
      event_type  = COALESCE(${event_type  ?? null}, event_type),
      starts_at   = COALESCE(${starts_at   ?? null}, starts_at),
      ends_at     = COALESCE(${ends_at     ?? null}, ends_at),
      status      = COALESCE(${status      ?? null}, status),
      notes       = COALESCE(${notes       ?? null}, notes),
      updated_at  = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}
