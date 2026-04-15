// server/client-portfolio/repository.js
// Database queries for the Carteira de Clientes feature.
// All queries use createUserScopedSql to enforce RLS.

/**
 * Fetch all portfolio clients (is_converted_customer = true).
 * Joins clients + client_lifecycle + client_energy_profile + client_project_status.
 * Uses service-bypass sql for JOIN completeness; RLS is enforced at the lifecycle level
 * via the RLS helper set by createUserScopedSql in the calling handler.
 */
export async function listPortfolioClients(sql, { search } = {}) {
  const rows = await sql`
    SELECT
      c.id,
      c.client_name        AS name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.document,
      c.document_type,
      c.consumption_kwh_month,
      c.system_kwp,
      c.term_months,
      c.distribuidora,
      c.uc,
      c.uc_beneficiaria,
      c.owner_user_id,
      c.created_by_user_id,
      c.created_at          AS client_created_at,
      cl.id                 AS lifecycle_id,
      cl.lifecycle_status,
      cl.is_converted_customer,
      cl.exported_to_portfolio_at,
      cl.exported_by_user_id,
      cl.onboarding_status,
      cl.is_active_portfolio_client,
      ep.modalidade,
      ep.tarifa_atual,
      ep.desconto_percentual,
      ep.mensalidade,
      ep.prazo_meses,
      ep.kwh_contratado,
      ep.potencia_kwp,
      ep.tipo_rede,
      ep.marca_inversor,
      ps.project_status,
      ps.installation_status,
      ps.commissioning_date,
      ps.expected_go_live_date,
      ps.timeline_velocity_score,
      cc.id                 AS contract_id,
      cc.contract_type,
      cc.contract_status,
      cc.contract_signed_at,
      cc.billing_start_date,
      cc.contractual_term_months,
      cc.buyout_eligible,
      cc.buyout_status,
      bp.payment_status     AS billing_payment_status,
      bp.delinquency_status,
      bp.due_day,
      bp.first_billing_date
    FROM public.client_lifecycle cl
    JOIN public.clients c ON c.id = cl.client_id AND c.deleted_at IS NULL
    LEFT JOIN public.client_energy_profile ep ON ep.client_id = c.id
    LEFT JOIN public.client_project_status ps ON ps.client_id = c.id
    LEFT JOIN public.client_contracts cc ON cc.client_id = c.id AND cc.contract_status = 'active'
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    WHERE cl.is_converted_customer = true
      AND (
        ${search ? sql`(
          c.client_name ILIKE ${'%' + search + '%'}
          OR c.email ILIKE ${'%' + search + '%'}
          OR c.city ILIKE ${'%' + search + '%'}
          OR c.document ILIKE ${'%' + search + '%'}
        )` : sql`true`}
      )
    ORDER BY cl.exported_to_portfolio_at DESC, c.client_name ASC
  `
  return rows
}

/**
 * Get a single portfolio client by client_id.
 */
export async function getPortfolioClient(sql, clientId) {
  const rows = await sql`
    SELECT
      c.id,
      c.client_name        AS name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.address,
      c.document,
      c.document_type,
      c.consumption_kwh_month,
      c.system_kwp,
      c.term_months,
      c.distribuidora,
      c.uc,
      c.uc_beneficiaria,
      c.owner_user_id,
      c.created_by_user_id,
      c.created_at          AS client_created_at,
      c.updated_at          AS client_updated_at,
      cl.id                 AS lifecycle_id,
      cl.lifecycle_status,
      cl.is_converted_customer,
      cl.exported_to_portfolio_at,
      cl.exported_by_user_id,
      cl.onboarding_status,
      cl.is_active_portfolio_client,
      ep.id                 AS energy_profile_id,
      ep.modalidade,
      ep.tarifa_atual,
      ep.desconto_percentual,
      ep.mensalidade,
      ep.prazo_meses,
      ep.kwh_contratado,
      ep.potencia_kwp,
      ep.tipo_rede,
      ep.marca_inversor,
      ep.indicacao,
      ps.id                 AS project_id,
      ps.project_status,
      ps.installation_status,
      ps.engineering_status,
      ps.homologation_status,
      ps.commissioning_status,
      ps.commissioning_date,
      ps.first_injection_date,
      ps.first_generation_date,
      ps.expected_go_live_date,
      ps.integrator_name,
      ps.engineer_name,
      ps.timeline_velocity_score,
      ps.notes              AS project_notes,
      cc.id                 AS contract_id,
      cc.contract_type,
      cc.contract_status,
      cc.source_proposal_id,
      cc.contract_signed_at,
      cc.contract_start_date,
      cc.billing_start_date,
      cc.expected_billing_end_date,
      cc.contractual_term_months,
      cc.buyout_eligible,
      cc.buyout_status,
      cc.buyout_date,
      cc.buyout_amount_reference,
      cc.notes              AS contract_notes,
      bp.id                 AS billing_id,
      bp.due_day,
      bp.reading_day,
      bp.first_billing_date,
      bp.expected_last_billing_date,
      bp.recurrence_type,
      bp.payment_status     AS billing_payment_status,
      bp.delinquency_status,
      bp.collection_stage,
      bp.auto_reminder_enabled
    FROM public.client_lifecycle cl
    JOIN public.clients c ON c.id = cl.client_id AND c.deleted_at IS NULL
    LEFT JOIN public.client_energy_profile ep ON ep.client_id = c.id
    LEFT JOIN public.client_project_status ps ON ps.client_id = c.id
    LEFT JOIN public.client_contracts cc ON cc.client_id = c.id AND cc.contract_status = 'active'
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    WHERE cl.client_id = ${clientId}
      AND cl.is_converted_customer = true
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * Export a client to the portfolio (upsert client_lifecycle).
 * Idempotent — repeated calls do not create duplicates.
 */
export async function exportClientToPortfolio(sql, clientId, actorUserId) {
  const now = new Date().toISOString()
  const rows = await sql`
    INSERT INTO public.client_lifecycle (
      client_id,
      lifecycle_status,
      is_converted_customer,
      exported_to_portfolio_at,
      converted_from_lead_at,
      is_active_portfolio_client,
      exported_by_user_id,
      created_at,
      updated_at
    ) VALUES (
      ${clientId},
      'contracted',
      true,
      ${now},
      ${now},
      true,
      ${actorUserId},
      ${now},
      ${now}
    )
    ON CONFLICT (client_id) DO UPDATE SET
      lifecycle_status           = CASE WHEN client_lifecycle.is_converted_customer THEN client_lifecycle.lifecycle_status ELSE 'contracted' END,
      is_converted_customer      = true,
      exported_to_portfolio_at   = COALESCE(client_lifecycle.exported_to_portfolio_at, ${now}),
      converted_from_lead_at     = COALESCE(client_lifecycle.converted_from_lead_at, ${now}),
      is_active_portfolio_client = true,
      updated_at                 = ${now}
    RETURNING *
  `
  return rows[0]
}

/**
 * Update client lifecycle fields.
 */
export async function updateClientLifecycle(sql, clientId, fields) {
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE public.client_lifecycle
    SET
      lifecycle_status           = COALESCE(${fields.lifecycle_status ?? null}, lifecycle_status),
      onboarding_status          = COALESCE(${fields.onboarding_status ?? null}, onboarding_status),
      is_active_portfolio_client = COALESCE(${fields.is_active_portfolio_client ?? null}, is_active_portfolio_client),
      updated_at                 = ${now}
    WHERE client_id = ${clientId}
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * Upsert client_contracts (only one active contract per client is tracked here).
 */
export async function upsertClientContract(sql, clientId, fields) {
  const now = new Date().toISOString()
  if (fields.id) {
    // Update existing contract
    const rows = await sql`
      UPDATE public.client_contracts
      SET
        contract_type              = COALESCE(${fields.contract_type ?? null}, contract_type),
        contract_status            = COALESCE(${fields.contract_status ?? null}, contract_status),
        source_proposal_id         = COALESCE(${fields.source_proposal_id ?? null}, source_proposal_id),
        contract_signed_at         = COALESCE(${fields.contract_signed_at ?? null}, contract_signed_at),
        contract_start_date        = COALESCE(${fields.contract_start_date ?? null}, contract_start_date),
        billing_start_date         = COALESCE(${fields.billing_start_date ?? null}, billing_start_date),
        expected_billing_end_date  = COALESCE(${fields.expected_billing_end_date ?? null}, expected_billing_end_date),
        contractual_term_months    = COALESCE(${fields.contractual_term_months ?? null}, contractual_term_months),
        buyout_eligible            = COALESCE(${fields.buyout_eligible ?? null}, buyout_eligible),
        buyout_status              = COALESCE(${fields.buyout_status ?? null}, buyout_status),
        buyout_date                = COALESCE(${fields.buyout_date ?? null}, buyout_date),
        buyout_amount_reference    = COALESCE(${fields.buyout_amount_reference ?? null}, buyout_amount_reference),
        notes                      = COALESCE(${fields.notes ?? null}, notes),
        updated_at                 = ${now}
      WHERE id = ${fields.id} AND client_id = ${clientId}
      RETURNING *
    `
    return rows[0] ?? null
  }
  // Insert new contract
  const rows = await sql`
    INSERT INTO public.client_contracts (
      client_id, source_proposal_id, contract_type, contract_status,
      contract_signed_at, contract_start_date, billing_start_date,
      expected_billing_end_date, contractual_term_months, buyout_eligible,
      buyout_status, buyout_date, buyout_amount_reference, notes,
      created_at, updated_at
    ) VALUES (
      ${clientId},
      ${fields.source_proposal_id ?? null},
      ${fields.contract_type ?? 'leasing'},
      ${fields.contract_status ?? 'draft'},
      ${fields.contract_signed_at ?? null},
      ${fields.contract_start_date ?? null},
      ${fields.billing_start_date ?? null},
      ${fields.expected_billing_end_date ?? null},
      ${fields.contractual_term_months ?? null},
      ${fields.buyout_eligible ?? false},
      ${fields.buyout_status ?? null},
      ${fields.buyout_date ?? null},
      ${fields.buyout_amount_reference ?? null},
      ${fields.notes ?? null},
      ${now},
      ${now}
    )
    RETURNING *
  `
  return rows[0]
}

/**
 * Upsert client_project_status (one row per client).
 */
export async function upsertClientProjectStatus(sql, clientId, fields) {
  const now = new Date().toISOString()
  const rows = await sql`
    INSERT INTO public.client_project_status (
      client_id, project_status, installation_status, engineering_status,
      homologation_status, commissioning_status, commissioning_date,
      first_injection_date, first_generation_date, expected_go_live_date,
      integrator_name, engineer_name, timeline_velocity_score, notes,
      created_at, updated_at
    ) VALUES (
      ${clientId},
      ${fields.project_status ?? 'pending'},
      ${fields.installation_status ?? null},
      ${fields.engineering_status ?? null},
      ${fields.homologation_status ?? null},
      ${fields.commissioning_status ?? null},
      ${fields.commissioning_date ?? null},
      ${fields.first_injection_date ?? null},
      ${fields.first_generation_date ?? null},
      ${fields.expected_go_live_date ?? null},
      ${fields.integrator_name ?? null},
      ${fields.engineer_name ?? null},
      ${fields.timeline_velocity_score ?? null},
      ${fields.notes ?? null},
      ${now},
      ${now}
    )
    ON CONFLICT (client_id) DO UPDATE SET
      project_status             = COALESCE(${fields.project_status ?? null}, client_project_status.project_status),
      installation_status        = COALESCE(${fields.installation_status ?? null}, client_project_status.installation_status),
      engineering_status         = COALESCE(${fields.engineering_status ?? null}, client_project_status.engineering_status),
      homologation_status        = COALESCE(${fields.homologation_status ?? null}, client_project_status.homologation_status),
      commissioning_status       = COALESCE(${fields.commissioning_status ?? null}, client_project_status.commissioning_status),
      commissioning_date         = COALESCE(${fields.commissioning_date ?? null}, client_project_status.commissioning_date),
      first_injection_date       = COALESCE(${fields.first_injection_date ?? null}, client_project_status.first_injection_date),
      first_generation_date      = COALESCE(${fields.first_generation_date ?? null}, client_project_status.first_generation_date),
      expected_go_live_date      = COALESCE(${fields.expected_go_live_date ?? null}, client_project_status.expected_go_live_date),
      integrator_name            = COALESCE(${fields.integrator_name ?? null}, client_project_status.integrator_name),
      engineer_name              = COALESCE(${fields.engineer_name ?? null}, client_project_status.engineer_name),
      timeline_velocity_score    = COALESCE(${fields.timeline_velocity_score ?? null}, client_project_status.timeline_velocity_score),
      notes                      = COALESCE(${fields.notes ?? null}, client_project_status.notes),
      updated_at                 = ${now}
    RETURNING *
  `
  return rows[0]
}

/**
 * Upsert client_billing_profile (one row per client).
 */
export async function upsertClientBillingProfile(sql, clientId, fields) {
  const now = new Date().toISOString()
  const rows = await sql`
    INSERT INTO public.client_billing_profile (
      client_id, contract_id, due_day, reading_day, first_billing_date,
      expected_last_billing_date, recurrence_type, payment_status,
      delinquency_status, collection_stage, auto_reminder_enabled,
      created_at, updated_at
    ) VALUES (
      ${clientId},
      ${fields.contract_id ?? null},
      ${fields.due_day ?? null},
      ${fields.reading_day ?? null},
      ${fields.first_billing_date ?? null},
      ${fields.expected_last_billing_date ?? null},
      ${fields.recurrence_type ?? 'monthly'},
      ${fields.payment_status ?? 'pending'},
      ${fields.delinquency_status ?? null},
      ${fields.collection_stage ?? null},
      ${fields.auto_reminder_enabled ?? true},
      ${now},
      ${now}
    )
    ON CONFLICT (client_id) DO UPDATE SET
      contract_id                = COALESCE(${fields.contract_id ?? null}, client_billing_profile.contract_id),
      due_day                    = COALESCE(${fields.due_day ?? null}, client_billing_profile.due_day),
      reading_day                = COALESCE(${fields.reading_day ?? null}, client_billing_profile.reading_day),
      first_billing_date         = COALESCE(${fields.first_billing_date ?? null}, client_billing_profile.first_billing_date),
      expected_last_billing_date = COALESCE(${fields.expected_last_billing_date ?? null}, client_billing_profile.expected_last_billing_date),
      recurrence_type            = COALESCE(${fields.recurrence_type ?? null}, client_billing_profile.recurrence_type),
      payment_status             = COALESCE(${fields.payment_status ?? null}, client_billing_profile.payment_status),
      delinquency_status         = COALESCE(${fields.delinquency_status ?? null}, client_billing_profile.delinquency_status),
      collection_stage           = COALESCE(${fields.collection_stage ?? null}, client_billing_profile.collection_stage),
      auto_reminder_enabled      = COALESCE(${fields.auto_reminder_enabled ?? null}, client_billing_profile.auto_reminder_enabled),
      updated_at                 = ${now}
    RETURNING *
  `
  return rows[0]
}

/**
 * Get notes for a portfolio client.
 */
export async function getClientNotes(sql, clientId) {
  const rows = await sql`
    SELECT * FROM public.client_notes
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC
    LIMIT 100
  `
  return rows
}

/**
 * Add a note for a portfolio client.
 */
export async function addClientNote(sql, clientId, { entry_type, title, content, created_by_user_id }) {
  const rows = await sql`
    INSERT INTO public.client_notes (client_id, entry_type, title, content, created_by_user_id, created_at)
    VALUES (
      ${clientId},
      ${entry_type ?? 'note'},
      ${title ?? null},
      ${content},
      ${created_by_user_id ?? null},
      now()
    )
    RETURNING *
  `
  return rows[0]
}

/**
 * Dashboard portfolio summary aggregates.
 * Returns high-level KPIs for the portfolio dashboard.
 * Uses service-bypass (no RLS) for aggregation — caller must be admin/office/financeiro.
 */
export async function getPortfolioSummary(sql) {
  const rows = await sql`
    SELECT
      COUNT(*)                                                          AS total_portfolio_clients,
      COUNT(*) FILTER (WHERE cl.lifecycle_status = 'active')           AS active_clients,
      COUNT(*) FILTER (WHERE cl.lifecycle_status = 'implementation'
                          OR ps.project_status IN ('engineering','installation','homologation'))
                                                                        AS clients_in_implementation,
      COUNT(*) FILTER (WHERE cl.lifecycle_status = 'billing'
                          OR bp.payment_status IS NOT NULL)             AS clients_with_billing,
      COUNT(*) FILTER (WHERE bp.payment_status = 'overdue')            AS overdue_clients,
      COUNT(*) FILTER (WHERE cc.buyout_eligible = true)                AS buyout_eligible_clients,
      COALESCE(SUM(ep.mensalidade), 0)                                 AS projected_monthly_revenue,
      COUNT(*) FILTER (WHERE cl.is_active_portfolio_client = true)     AS active_portfolio_clients
    FROM public.client_lifecycle cl
    JOIN public.clients c ON c.id = cl.client_id AND c.deleted_at IS NULL
    LEFT JOIN public.client_energy_profile ep ON ep.client_id = c.id
    LEFT JOIN public.client_project_status ps ON ps.client_id = c.id
    LEFT JOIN public.client_contracts cc ON cc.client_id = c.id AND cc.contract_status = 'active'
    LEFT JOIN public.client_billing_profile bp ON bp.client_id = c.id
    WHERE cl.is_converted_customer = true
  `
  return rows[0] ?? {}
}
