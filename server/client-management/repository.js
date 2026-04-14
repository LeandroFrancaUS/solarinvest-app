// server/client-management/repository.js
// Database queries for the Gestão de Clientes V2 feature.
// All queries receive a userSql context already set with RLS (createUserScopedSql).

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function getLifecycle(sql, clientId) {
  const rows = await sql`
    SELECT * FROM public.client_lifecycle
    WHERE client_id = ${clientId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function upsertLifecycle(sql, clientId, data) {
  const {
    lifecycle_status,
    is_converted_customer,
    converted_at,
    converted_from_lead_at,
    onboarding_status,
  } = data
  const rows = await sql`
    INSERT INTO public.client_lifecycle (
      client_id, lifecycle_status, is_converted_customer,
      converted_at, converted_from_lead_at, onboarding_status
    )
    VALUES (
      ${clientId},
      ${lifecycle_status ?? 'lead'},
      ${is_converted_customer ?? false},
      ${converted_at ?? null},
      ${converted_from_lead_at ?? null},
      ${onboarding_status ?? 'pending'}
    )
    ON CONFLICT (client_id) DO UPDATE SET
      lifecycle_status      = COALESCE(EXCLUDED.lifecycle_status,      client_lifecycle.lifecycle_status),
      is_converted_customer = COALESCE(EXCLUDED.is_converted_customer, client_lifecycle.is_converted_customer),
      converted_at          = COALESCE(EXCLUDED.converted_at,          client_lifecycle.converted_at),
      converted_from_lead_at= COALESCE(EXCLUDED.converted_from_lead_at,client_lifecycle.converted_from_lead_at),
      onboarding_status     = COALESCE(EXCLUDED.onboarding_status,     client_lifecycle.onboarding_status),
      updated_at            = now()
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function listContracts(sql, clientId) {
  return sql`
    SELECT * FROM public.client_contracts
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC
  `
}

export async function getContract(sql, contractId, clientId) {
  const rows = await sql`
    SELECT * FROM public.client_contracts
    WHERE id = ${contractId} AND client_id = ${clientId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function createContract(sql, clientId, data) {
  const rows = await sql`
    INSERT INTO public.client_contracts (
      client_id, contract_type, contract_status,
      contract_signed_at, contract_start_date, billing_start_date,
      expected_billing_end_date, contractual_term_months,
      buyout_eligible, buyout_status, buyout_date, buyout_amount_reference, notes
    )
    VALUES (
      ${clientId},
      ${data.contract_type ?? 'leasing'},
      ${data.contract_status ?? 'draft'},
      ${data.contract_signed_at ?? null},
      ${data.contract_start_date ?? null},
      ${data.billing_start_date ?? null},
      ${data.expected_billing_end_date ?? null},
      ${data.contractual_term_months ?? null},
      ${data.buyout_eligible ?? false},
      ${data.buyout_status ?? 'not_eligible'},
      ${data.buyout_date ?? null},
      ${data.buyout_amount_reference ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `
  return rows[0] ?? null
}

export async function updateContract(sql, contractId, clientId, data) {
  const fields = Object.entries(data).filter(([k]) =>
    [
      'contract_type','contract_status','contract_signed_at','contract_start_date',
      'billing_start_date','expected_billing_end_date','contractual_term_months',
      'buyout_eligible','buyout_status','buyout_date','buyout_amount_reference','notes',
    ].includes(k),
  )
  if (fields.length === 0) return getContract(sql, contractId, clientId)

  const rows = await sql`
    UPDATE public.client_contracts
    SET
      contract_type             = COALESCE(${data.contract_type ?? null},             contract_type),
      contract_status           = COALESCE(${data.contract_status ?? null},           contract_status),
      contract_signed_at        = COALESCE(${data.contract_signed_at ?? null},        contract_signed_at),
      contract_start_date       = COALESCE(${data.contract_start_date ?? null},       contract_start_date),
      billing_start_date        = COALESCE(${data.billing_start_date ?? null},        billing_start_date),
      expected_billing_end_date = COALESCE(${data.expected_billing_end_date ?? null}, expected_billing_end_date),
      contractual_term_months   = COALESCE(${data.contractual_term_months ?? null},   contractual_term_months),
      buyout_eligible           = COALESCE(${data.buyout_eligible ?? null},           buyout_eligible),
      buyout_status             = COALESCE(${data.buyout_status ?? null},             buyout_status),
      buyout_date               = COALESCE(${data.buyout_date ?? null},               buyout_date),
      buyout_amount_reference   = COALESCE(${data.buyout_amount_reference ?? null},   buyout_amount_reference),
      notes                     = COALESCE(${data.notes ?? null},                     notes),
      updated_at                = now()
    WHERE id = ${contractId} AND client_id = ${clientId}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Project Status ───────────────────────────────────────────────────────────

export async function getProjectStatus(sql, clientId) {
  const rows = await sql`
    SELECT * FROM public.client_project_status
    WHERE client_id = ${clientId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function upsertProjectStatus(sql, clientId, data) {
  const rows = await sql`
    INSERT INTO public.client_project_status (
      client_id, project_status, installation_status, engineering_status,
      homologation_status, commissioning_date, first_injection_date,
      first_generation_date, expected_go_live_date,
      integrator_name, engineer_name, notes
    )
    VALUES (
      ${clientId},
      ${data.project_status ?? 'pending'},
      ${data.installation_status ?? 'pending'},
      ${data.engineering_status ?? 'pending'},
      ${data.homologation_status ?? 'pending'},
      ${data.commissioning_date ?? null},
      ${data.first_injection_date ?? null},
      ${data.first_generation_date ?? null},
      ${data.expected_go_live_date ?? null},
      ${data.integrator_name ?? null},
      ${data.engineer_name ?? null},
      ${data.notes ?? null}
    )
    ON CONFLICT (client_id) DO UPDATE SET
      project_status        = COALESCE(EXCLUDED.project_status,        client_project_status.project_status),
      installation_status   = COALESCE(EXCLUDED.installation_status,   client_project_status.installation_status),
      engineering_status    = COALESCE(EXCLUDED.engineering_status,    client_project_status.engineering_status),
      homologation_status   = COALESCE(EXCLUDED.homologation_status,   client_project_status.homologation_status),
      commissioning_date    = COALESCE(EXCLUDED.commissioning_date,    client_project_status.commissioning_date),
      first_injection_date  = COALESCE(EXCLUDED.first_injection_date,  client_project_status.first_injection_date),
      first_generation_date = COALESCE(EXCLUDED.first_generation_date, client_project_status.first_generation_date),
      expected_go_live_date = COALESCE(EXCLUDED.expected_go_live_date, client_project_status.expected_go_live_date),
      integrator_name       = COALESCE(EXCLUDED.integrator_name,       client_project_status.integrator_name),
      engineer_name         = COALESCE(EXCLUDED.engineer_name,         client_project_status.engineer_name),
      notes                 = COALESCE(EXCLUDED.notes,                 client_project_status.notes),
      updated_at            = now()
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Billing Profile ─────────────────────────────────────────────────────────

export async function getBillingProfile(sql, clientId) {
  const rows = await sql`
    SELECT * FROM public.client_billing_profile
    WHERE client_id = ${clientId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function upsertBillingProfile(sql, clientId, data) {
  const rows = await sql`
    INSERT INTO public.client_billing_profile (
      client_id, due_day, reading_day, first_billing_date,
      expected_last_billing_date, recurrence_type,
      payment_status, delinquency_status, collection_stage, auto_reminder_enabled
    )
    VALUES (
      ${clientId},
      ${data.due_day ?? null},
      ${data.reading_day ?? null},
      ${data.first_billing_date ?? null},
      ${data.expected_last_billing_date ?? null},
      ${data.recurrence_type ?? 'monthly'},
      ${data.payment_status ?? 'pending'},
      ${data.delinquency_status ?? 'none'},
      ${data.collection_stage ?? null},
      ${data.auto_reminder_enabled ?? true}
    )
    ON CONFLICT (client_id) DO UPDATE SET
      due_day                    = COALESCE(EXCLUDED.due_day,                    client_billing_profile.due_day),
      reading_day                = COALESCE(EXCLUDED.reading_day,                client_billing_profile.reading_day),
      first_billing_date         = COALESCE(EXCLUDED.first_billing_date,         client_billing_profile.first_billing_date),
      expected_last_billing_date = COALESCE(EXCLUDED.expected_last_billing_date, client_billing_profile.expected_last_billing_date),
      recurrence_type            = COALESCE(EXCLUDED.recurrence_type,            client_billing_profile.recurrence_type),
      payment_status             = COALESCE(EXCLUDED.payment_status,             client_billing_profile.payment_status),
      delinquency_status         = COALESCE(EXCLUDED.delinquency_status,         client_billing_profile.delinquency_status),
      collection_stage           = COALESCE(EXCLUDED.collection_stage,           client_billing_profile.collection_stage),
      auto_reminder_enabled      = COALESCE(EXCLUDED.auto_reminder_enabled,      client_billing_profile.auto_reminder_enabled),
      updated_at                 = now()
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Billing Installments ─────────────────────────────────────────────────────

export async function listInstallments(sql, clientId, { status, limit = 60, offset = 0 } = {}) {
  if (status) {
    return sql`
      SELECT * FROM public.client_billing_installments
      WHERE client_id = ${clientId} AND payment_status = ${status}
      ORDER BY due_date ASC
      LIMIT ${limit} OFFSET ${offset}
    `
  }
  return sql`
    SELECT * FROM public.client_billing_installments
    WHERE client_id = ${clientId}
    ORDER BY due_date ASC
    LIMIT ${limit} OFFSET ${offset}
  `
}

export async function upsertInstallment(sql, clientId, data) {
  const rows = await sql`
    INSERT INTO public.client_billing_installments (
      client_id, contract_id, installment_number, competence_month,
      due_date, amount_due, amount_paid, paid_at, payment_status,
      payment_method, late_fee_amount, interest_amount, discount_amount, notes
    )
    VALUES (
      ${clientId},
      ${data.contract_id ?? null},
      ${data.installment_number},
      ${data.competence_month ?? null},
      ${data.due_date},
      ${data.amount_due},
      ${data.amount_paid ?? 0},
      ${data.paid_at ?? null},
      ${data.payment_status ?? 'pending'},
      ${data.payment_method ?? null},
      ${data.late_fee_amount ?? 0},
      ${data.interest_amount ?? 0},
      ${data.discount_amount ?? 0},
      ${data.notes ?? null}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `
  return rows[0] ?? null
}

export async function updateInstallment(sql, installmentId, clientId, data) {
  const rows = await sql`
    UPDATE public.client_billing_installments
    SET
      amount_paid    = COALESCE(${data.amount_paid ?? null},    amount_paid),
      paid_at        = COALESCE(${data.paid_at ?? null},        paid_at),
      payment_status = COALESCE(${data.payment_status ?? null}, payment_status),
      payment_method = COALESCE(${data.payment_method ?? null}, payment_method),
      late_fee_amount= COALESCE(${data.late_fee_amount ?? null},late_fee_amount),
      interest_amount= COALESCE(${data.interest_amount ?? null},interest_amount),
      discount_amount= COALESCE(${data.discount_amount ?? null},discount_amount),
      notes          = COALESCE(${data.notes ?? null},          notes),
      updated_at     = now()
    WHERE id = ${installmentId} AND client_id = ${clientId}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function listNotes(sql, clientId, { limit = 50, offset = 0 } = {}) {
  return sql`
    SELECT * FROM public.client_notes
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
}

export async function createNote(sql, clientId, data) {
  const rows = await sql`
    INSERT INTO public.client_notes (
      client_id, entry_type, title, content, created_by_user_id
    )
    VALUES (
      ${clientId},
      ${data.entry_type ?? 'note'},
      ${data.title ?? null},
      ${data.content},
      ${data.created_by_user_id ?? null}
    )
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function listReminders(sql, clientId, { status } = {}) {
  if (status) {
    return sql`
      SELECT * FROM public.client_reminders
      WHERE client_id = ${clientId} AND status = ${status}
      ORDER BY due_at ASC
    `
  }
  return sql`
    SELECT * FROM public.client_reminders
    WHERE client_id = ${clientId}
    ORDER BY due_at ASC
  `
}

export async function createReminder(sql, clientId, data) {
  const rows = await sql`
    INSERT INTO public.client_reminders (
      client_id, title, reminder_type, due_at,
      status, assigned_to_user_id, notes
    )
    VALUES (
      ${clientId},
      ${data.title},
      ${data.reminder_type ?? 'general'},
      ${data.due_at},
      'pending',
      ${data.assigned_to_user_id ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `
  return rows[0] ?? null
}

export async function updateReminder(sql, reminderId, clientId, data) {
  const rows = await sql`
    UPDATE public.client_reminders
    SET
      title               = COALESCE(${data.title ?? null},               title),
      reminder_type       = COALESCE(${data.reminder_type ?? null},       reminder_type),
      due_at              = COALESCE(${data.due_at ?? null},              due_at),
      status              = COALESCE(${data.status ?? null},              status),
      assigned_to_user_id = COALESCE(${data.assigned_to_user_id ?? null}, assigned_to_user_id),
      notes               = COALESCE(${data.notes ?? null},               notes),
      updated_at          = now()
    WHERE id = ${reminderId} AND client_id = ${clientId}
    RETURNING *
  `
  return rows[0] ?? null
}

// ─── Full Client Detail (consolidated) ───────────────────────────────────────

/**
 * Returns the full consolidated client detail payload for the management page.
 * Energy profile is from the existing client_energy_profile table (migration 0025).
 */
export async function getClientManagementDetail(sql, clientId) {
  const [clients, lifecycle, contracts, energy, project, billing] = await Promise.all([
    sql`
      SELECT
        c.*,
        p.full_name  AS owner_display_name,
        p.email      AS owner_email
      FROM public.clients c
      LEFT JOIN public.app_user_profiles p ON p.auth_provider_user_id = c.owner_user_id
      WHERE c.id = ${clientId} AND c.deleted_at IS NULL
      LIMIT 1
    `,
    getLifecycle(sql, clientId),
    listContracts(sql, clientId),
    sql`
      SELECT * FROM public.client_energy_profile
      WHERE client_id = ${clientId} LIMIT 1
    `,
    getProjectStatus(sql, clientId),
    getBillingProfile(sql, clientId),
  ])

  const client = clients[0] ?? null
  if (!client) return null

  return {
    client,
    lifecycle: lifecycle ?? null,
    contracts,
    energy: energy[0] ?? null,
    project: project ?? null,
    billing: billing ?? null,
  }
}

// ─── List converted clients ───────────────────────────────────────────────────

/**
 * List only converted/contracted clients for the management page.
 * Joins lifecycle to enforce is_converted_customer = true.
 */
export async function listManagedClients(sql, {
  search,
  lifecycleStatus,
  contractStatus,
  modalidade,
  page = 1,
  limit = 30,
} = {}) {
  const offset = (Number(page) - 1) * Number(limit)

  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.uc,
      c.distribuidora,
      c.created_at,
      c.updated_at,
      lc.lifecycle_status,
      lc.is_converted_customer,
      lc.converted_at,
      lc.onboarding_status,
      ep.modalidade,
      ep.mensalidade,
      ep.potencia_kwp,
      ep.prazo_meses,
      ep.desconto_percentual,
      ps.project_status,
      ps.installation_status,
      ps.expected_go_live_date,
      bp.payment_status      AS billing_payment_status,
      bp.delinquency_status,
      bp.due_day,
      (
        SELECT COUNT(*)::int FROM public.client_billing_installments bi
        WHERE bi.client_id = c.id AND bi.payment_status = 'overdue'
      ) AS overdue_installments_count,
      (
        SELECT bi.due_date FROM public.client_billing_installments bi
        WHERE bi.client_id = c.id AND bi.payment_status = 'pending'
        ORDER BY bi.due_date ASC LIMIT 1
      ) AS next_due_date,
      p.full_name AS owner_display_name
    FROM public.clients c
    INNER JOIN public.client_lifecycle lc ON lc.client_id = c.id
      AND lc.is_converted_customer = TRUE
    LEFT JOIN public.client_energy_profile ep ON ep.client_id = c.id
    LEFT JOIN public.client_project_status ps ON ps.client_id = c.id
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    LEFT JOIN public.app_user_profiles p ON p.auth_provider_user_id = c.owner_user_id
    WHERE c.deleted_at IS NULL
      AND (
        ${search ? sql`(
          c.name ILIKE ${'%' + search + '%'}
          OR c.email ILIKE ${'%' + search + '%'}
          OR c.uc ILIKE ${'%' + search + '%'}
          OR c.distribuidora ILIKE ${'%' + search + '%'}
        )` : sql`TRUE`}
      )
      AND (${lifecycleStatus ? sql`lc.lifecycle_status = ${lifecycleStatus}` : sql`TRUE`})
      AND (${modalidade ? sql`ep.modalidade = ${modalidade}` : sql`TRUE`})
    ORDER BY c.updated_at DESC
    LIMIT ${Number(limit)} OFFSET ${offset}
  `

  const countRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM public.clients c
    INNER JOIN public.client_lifecycle lc ON lc.client_id = c.id
      AND lc.is_converted_customer = TRUE
    WHERE c.deleted_at IS NULL
      AND (
        ${search ? sql`(
          c.name ILIKE ${'%' + search + '%'}
          OR c.email ILIKE ${'%' + search + '%'}
        )` : sql`TRUE`}
      )
      AND (${lifecycleStatus ? sql`lc.lifecycle_status = ${lifecycleStatus}` : sql`TRUE`})
      AND (${modalidade ? sql`ep.modalidade = ${modalidade}` : sql`TRUE`})
  `

  const total = countRows[0]?.total ?? 0
  return {
    data: rows,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  }
}

// ─── Dashboard portfolio aggregates ──────────────────────────────────────────

export async function getPortfolioSummary(sql) {
  const rows = await sql`
    SELECT
      COUNT(DISTINCT c.id)::int                                                        AS active_clients_count,
      COUNT(DISTINCT cc.id) FILTER (WHERE cc.contract_status = 'active')::int          AS active_contracts_count,
      COUNT(DISTINCT c.id)  FILTER (WHERE ps.project_status = 'in_progress')::int      AS projects_in_implantation,
      COUNT(DISTINCT c.id)  FILTER (WHERE bp.payment_status IS NOT NULL)::int           AS clients_with_billing,
      COALESCE(SUM(ep.mensalidade), 0)::numeric                                         AS monthly_expected_revenue,
      COALESCE(SUM(bi.amount_due) FILTER (WHERE bi.payment_status = 'overdue'), 0)::numeric AS overdue_amount,
      COALESCE(SUM(bi.amount_paid) FILTER (
        WHERE bi.payment_status = 'paid'
          AND date_trunc('month', bi.paid_at) = date_trunc('month', now())
      ), 0)::numeric                                                                    AS received_month_to_date,
      COUNT(DISTINCT c.id) FILTER (WHERE lc.lifecycle_status = 'contracted')::int       AS contracted_clients,
      COUNT(DISTINCT c.id) FILTER (WHERE lc.lifecycle_status = 'active')::int           AS active_lifecycle_clients,
      COUNT(DISTINCT cc.id) FILTER (WHERE cc.buyout_eligible = TRUE)::int               AS buyout_eligible_count,
      COUNT(DISTINCT c.id) FILTER (WHERE bp.delinquency_status != 'none')::int          AS clients_with_alerts
    FROM public.clients c
    INNER JOIN public.client_lifecycle lc ON lc.client_id = c.id
      AND lc.is_converted_customer = TRUE
    LEFT JOIN public.client_energy_profile ep ON ep.client_id = c.id
    LEFT JOIN public.client_project_status ps ON ps.client_id = c.id
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    LEFT JOIN public.client_contracts cc ON cc.client_id = c.id
    LEFT JOIN public.client_billing_installments bi ON bi.client_id = c.id
    WHERE c.deleted_at IS NULL
  `
  return rows[0] ?? {}
}

export async function getPortfolioUpcomingBillings(sql, { days = 30 } = {}) {
  return sql`
    SELECT
      bi.id,
      bi.client_id,
      c.name AS client_name,
      bi.due_date,
      bi.amount_due,
      bi.payment_status,
      bi.competence_month,
      bi.installment_number
    FROM public.client_billing_installments bi
    INNER JOIN public.clients c ON c.id = bi.client_id AND c.deleted_at IS NULL
    INNER JOIN public.client_lifecycle lc ON lc.client_id = c.id
      AND lc.is_converted_customer = TRUE
    WHERE bi.payment_status IN ('pending','overdue')
      AND bi.due_date <= CURRENT_DATE + ${days}::int
    ORDER BY bi.due_date ASC
    LIMIT 50
  `
}

export async function getPortfolioStatusBreakdown(sql) {
  return sql`
    SELECT
      lc.lifecycle_status,
      ep.modalidade,
      ps.project_status,
      bp.payment_status,
      COUNT(*)::int AS count
    FROM public.clients c
    INNER JOIN public.client_lifecycle lc ON lc.client_id = c.id
      AND lc.is_converted_customer = TRUE
    LEFT JOIN public.client_energy_profile ep ON ep.client_id = c.id
    LEFT JOIN public.client_project_status ps ON ps.client_id = c.id
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    WHERE c.deleted_at IS NULL
    GROUP BY lc.lifecycle_status, ep.modalidade, ps.project_status, bp.payment_status
    ORDER BY count DESC
  `
}

export async function getPortfolioAlerts(sql) {
  return sql`
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      bp.delinquency_status,
      bp.payment_status,
      (
        SELECT COUNT(*)::int FROM public.client_billing_installments bi
        WHERE bi.client_id = c.id AND bi.payment_status = 'overdue'
      ) AS overdue_count,
      (
        SELECT bi.due_date FROM public.client_billing_installments bi
        WHERE bi.client_id = c.id AND bi.payment_status = 'overdue'
        ORDER BY bi.due_date ASC LIMIT 1
      ) AS oldest_overdue_date,
      (
        SELECT COUNT(*)::int FROM public.client_reminders r
        WHERE r.client_id = c.id AND r.status = 'pending' AND r.due_at <= now()
      ) AS overdue_reminders_count
    FROM public.clients c
    INNER JOIN public.client_lifecycle lc ON lc.client_id = c.id
      AND lc.is_converted_customer = TRUE
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    WHERE c.deleted_at IS NULL
      AND (
        bp.delinquency_status IN ('warning','delinquent','collection')
        OR EXISTS (
          SELECT 1 FROM public.client_billing_installments bi
          WHERE bi.client_id = c.id AND bi.payment_status = 'overdue'
        )
        OR EXISTS (
          SELECT 1 FROM public.client_reminders r
          WHERE r.client_id = c.id AND r.status = 'pending' AND r.due_at <= now()
        )
      )
    ORDER BY c.name ASC
    LIMIT 100
  `
}
