// server/client-portfolio/repository.js
// Database queries for the Carteira de Clientes feature.
// All queries use createUserScopedSql to enforce RLS.

/**
 * Fetch all portfolio clients (clients.in_portfolio = true).
 * Source of truth: clients.in_portfolio — does NOT require client_lifecycle table.
 * Uses only the clients table to avoid failures from optional auxiliary tables
 * (client_project_status, client_contracts, client_billing_profile) that may not
 * exist when migration 0029 has not been applied.
 *
 * Two explicit code paths to avoid the broken nested-sql-in-boolean pattern that
 * causes "invalid input syntax for type boolean: {}" on Neon serverless.
 */
export async function listPortfolioClients(sql, { search } = {}) {
  const searchTerm = (typeof search === 'string' && search.trim()) ? search.trim() : null
  const mode = searchTerm ? 'with_search' : 'without_search'

  console.info('[portfolio][list] query-mode', { mode, search, searchTerm })

  let rows
  if (!searchTerm) {
    rows = await sql`
      SELECT
        c.id,
        c.client_name                          AS name,
        c.client_email                         AS email,
        c.client_phone                         AS phone,
        c.client_city                          AS city,
        c.client_state                         AS state,
        c.client_document                      AS document,
        c.document_type,
        c.consumption_kwh_month,
        c.system_kwp,
        c.term_months,
        c.distribuidora,
        c.uc_geradora                          AS uc,
        c.uc_beneficiaria,
        c.owner_user_id,
        c.created_by_user_id,
        c.created_at                           AS client_created_at,
        c.updated_at                           AS client_updated_at,
        c.in_portfolio                         AS is_converted_customer,
        c.portfolio_exported_at                AS exported_to_portfolio_at,
        c.portfolio_exported_by_user_id        AS exported_by_user_id
      FROM public.clients c
      WHERE c.in_portfolio = true
        AND c.deleted_at IS NULL
      ORDER BY c.portfolio_exported_at DESC NULLS LAST, c.client_name ASC
    `
  } else {
    const like = `%${searchTerm}%`
    rows = await sql`
      SELECT
        c.id,
        c.client_name                          AS name,
        c.client_email                         AS email,
        c.client_phone                         AS phone,
        c.client_city                          AS city,
        c.client_state                         AS state,
        c.client_document                      AS document,
        c.document_type,
        c.consumption_kwh_month,
        c.system_kwp,
        c.term_months,
        c.distribuidora,
        c.uc_geradora                          AS uc,
        c.uc_beneficiaria,
        c.owner_user_id,
        c.created_by_user_id,
        c.created_at                           AS client_created_at,
        c.updated_at                           AS client_updated_at,
        c.in_portfolio                         AS is_converted_customer,
        c.portfolio_exported_at                AS exported_to_portfolio_at,
        c.portfolio_exported_by_user_id        AS exported_by_user_id
      FROM public.clients c
      WHERE c.in_portfolio = true
        AND c.deleted_at IS NULL
        AND (
          c.client_name       ILIKE ${like}
          OR c.client_email   ILIKE ${like}
          OR c.client_city    ILIKE ${like}
          OR c.client_document ILIKE ${like}
          OR c.client_phone   ILIKE ${like}
          OR c.uc_geradora    ILIKE ${like}
          OR c.uc_beneficiaria ILIKE ${like}
        )
      ORDER BY c.portfolio_exported_at DESC NULLS LAST, c.client_name ASC
    `
  }

  console.info('[portfolio][list] rows', { count: rows.length })
  return rows
}

function enrichPortfolioClientRow(row) {
  if (!row) return null

  const meta = row.metadata ?? {}

  row.potencia_modulo_wp = row.usina_potencia_modulo_wp ?? meta.potencia_modulo_wp ?? null
  row.numero_modulos = row.usina_numero_modulos ?? meta.numero_modulos ?? null
  row.modelo_modulo = row.usina_modelo_modulo ?? meta.modelo_modulo ?? null
  row.modelo_inversor = row.usina_modelo_inversor ?? meta.modelo_inversor ?? row.marca_inversor ?? null
  row.tipo_instalacao = row.usina_tipo_instalacao ?? meta.tipo_instalacao ?? null
  row.area_instalacao_m2 = row.usina_area_instalacao_m2 ?? meta.area_instalacao_m2 ?? null
  row.geracao_estimada_kwh = row.usina_geracao_estimada_kwh ?? meta.geracao_estimada_kwh ?? null

  // Expose plano fields from energy profile when available
  row.kwh_mes_contratado = row.kwh_contratado ?? null

  return row
}

function isCompatibilityError(err) {
  const code = err?.code ?? null
  return code === '42P01' || code === '42703'
}

function isEnergyProfileDependencyError(err) {
  const message = err instanceof Error ? err.message : String(err)
  const code = err?.code ?? null
  if (code !== '42P01' && code !== '42703') return false

  return (
    message.includes('client_energy_profile') ||
    message.includes('energy_profile_id') ||
    message.includes('modalidade') ||
    message.includes('tarifa_atual') ||
    message.includes('desconto_percentual') ||
    message.includes('mensalidade') ||
    message.includes('prazo_meses') ||
    message.includes('kwh_contratado') ||
    message.includes('potencia_kwp') ||
    message.includes('tipo_rede') ||
    message.includes('marca_inversor') ||
    message.includes('indicacao')
  )
}

/**
 * Detects errors caused by missing migration 0031 columns in client_contracts.
 * These columns (consultant_id, consultant_name, contract_file_*) were added
 * later and may be absent in environments where migration 0031 has not been applied.
 */
function isContractExtensionColumnError(err) {
  const message = err instanceof Error ? err.message : String(err)
  const code = err?.code ?? null
  if (code !== '42703') return false

  return (
    message.includes('consultant_id') ||
    message.includes('consultant_name') ||
    message.includes('contract_file_name') ||
    message.includes('contract_file_url') ||
    message.includes('contract_file_type')
  )
}

/**
 * Get a single portfolio client by client_id.
 * Source of truth: clients.in_portfolio.
 *
 * Strategy:
 *   1. Try the full query with all auxiliary joins, including client_energy_profile
 *      and client_contracts extension columns (migration 0031).
 *   2. If client_energy_profile or migration-0031 contract columns are missing,
 *      retry with a reduced query: drops client_energy_profile join and replaces
 *      the 5 optional contract columns (consultant_id, consultant_name,
 *      contract_file_*) with NULLs. This ensures contractual_term_months and
 *      all core contract fields are always returned.
 *   3. If other auxiliary tables/columns are missing, fall back to a clients-only query.
 */
export async function getPortfolioClient(sql, clientId) {
  const fullQuery = sql`
    SELECT
      c.id,
      c.client_name                          AS name,
      c.client_email                         AS email,
      c.client_phone                         AS phone,
      c.client_city                          AS city,
      c.client_state                         AS state,
      c.client_address                       AS address,
      c.client_document                      AS document,
      c.document_type,
      c.consumption_kwh_month,
      c.system_kwp,
      c.term_months,
      c.distribuidora,
      c.uc_geradora                          AS uc,
      c.uc_beneficiaria,
      c.owner_user_id,
      c.created_by_user_id,
      c.created_at                           AS client_created_at,
      c.updated_at                           AS client_updated_at,
      c.in_portfolio                         AS is_converted_customer,
      c.portfolio_exported_at                AS exported_to_portfolio_at,
      c.portfolio_exported_by_user_id        AS exported_by_user_id,
      c.metadata,

      -- client_contracts
      cc.id                                  AS contract_id,
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
      cc.notes                               AS contract_notes,
      cc.consultant_id,
      cc.consultant_name,
      cc.contract_file_name,
      cc.contract_file_url,
      cc.contract_file_type,

      -- client_project_status
      cp.id                                  AS project_id,
      cp.project_status,
      cp.installation_status,
      cp.engineering_status,
      cp.homologation_status,
      cp.commissioning_status,
      cp.commissioning_date,
      cp.first_injection_date,
      cp.first_generation_date,
      cp.expected_go_live_date,
      cp.integrator_name,
      cp.engineer_name,
      cp.timeline_velocity_score,
      cp.notes                               AS project_notes,

      -- client_billing_profile
      cb.id                                  AS billing_id,
      cb.due_day,
      cb.reading_day,
      cb.first_billing_date,
      cb.expected_last_billing_date,
      cb.recurrence_type,
      cb.payment_status                      AS billing_payment_status,
      cb.delinquency_status,
      cb.collection_stage,
      cb.auto_reminder_enabled,
      cb.valor_mensalidade,
      cb.commissioning_date                  AS commissioning_date_billing,
      cb.installments_json,

      -- client_energy_profile
      ep.id                                  AS energy_profile_id,
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

      -- client_usina_config
      cu.id                                  AS usina_id,
      cu.potencia_modulo_wp                  AS usina_potencia_modulo_wp,
      cu.numero_modulos                      AS usina_numero_modulos,
      cu.modelo_modulo                       AS usina_modelo_modulo,
      cu.modelo_inversor                     AS usina_modelo_inversor,
      cu.tipo_instalacao                     AS usina_tipo_instalacao,
      cu.area_instalacao_m2                  AS usina_area_instalacao_m2,
      cu.geracao_estimada_kwh                AS usina_geracao_estimada_kwh

    FROM public.clients c
    LEFT JOIN public.client_contracts cc
      ON cc.client_id = c.id
    LEFT JOIN public.client_project_status cp
      ON cp.client_id = c.id
    LEFT JOIN public.client_billing_profile cb
      ON cb.client_id = c.id
    LEFT JOIN public.client_energy_profile ep
      ON ep.client_id = c.id
    LEFT JOIN public.client_usina_config cu
      ON cu.client_id = c.id
    WHERE c.id = ${clientId}
      AND c.in_portfolio = true
      AND c.deleted_at IS NULL
    ORDER BY cc.updated_at DESC NULLS LAST
    LIMIT 1
  `

  const withoutEnergyProfileQuery = sql`
    SELECT
      c.id,
      c.client_name                          AS name,
      c.client_email                         AS email,
      c.client_phone                         AS phone,
      c.client_city                          AS city,
      c.client_state                         AS state,
      c.client_address                       AS address,
      c.client_document                      AS document,
      c.document_type,
      c.consumption_kwh_month,
      c.system_kwp,
      c.term_months,
      c.distribuidora,
      c.uc_geradora                          AS uc,
      c.uc_beneficiaria,
      c.owner_user_id,
      c.created_by_user_id,
      c.created_at                           AS client_created_at,
      c.updated_at                           AS client_updated_at,
      c.in_portfolio                         AS is_converted_customer,
      c.portfolio_exported_at                AS exported_to_portfolio_at,
      c.portfolio_exported_by_user_id        AS exported_by_user_id,
      c.metadata,

      -- client_contracts (core — always from migration 0029)
      cc.id                                  AS contract_id,
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
      cc.notes                               AS contract_notes,
      -- migration 0031 extension columns — replaced with NULL so this query
      -- succeeds even when migration 0031 has not been applied in this environment
      NULL::text                             AS consultant_id,
      NULL::text                             AS consultant_name,
      NULL::text                             AS contract_file_name,
      NULL::text                             AS contract_file_url,
      NULL::text                             AS contract_file_type,

      -- client_project_status
      cp.id                                  AS project_id,
      cp.project_status,
      cp.installation_status,
      cp.engineering_status,
      cp.homologation_status,
      cp.commissioning_status,
      cp.commissioning_date,
      cp.first_injection_date,
      cp.first_generation_date,
      cp.expected_go_live_date,
      cp.integrator_name,
      cp.engineer_name,
      cp.timeline_velocity_score,
      cp.notes                               AS project_notes,

      -- client_billing_profile
      cb.id                                  AS billing_id,
      cb.due_day,
      cb.reading_day,
      cb.first_billing_date,
      cb.expected_last_billing_date,
      cb.recurrence_type,
      cb.payment_status                      AS billing_payment_status,
      cb.delinquency_status,
      cb.collection_stage,
      cb.auto_reminder_enabled,
      cb.valor_mensalidade,
      cb.commissioning_date                  AS commissioning_date_billing,
      cb.installments_json,

      -- fake client_energy_profile aliases for compatibility
      NULL::bigint                           AS energy_profile_id,
      NULL::text                             AS modalidade,
      NULL::numeric                          AS tarifa_atual,
      NULL::numeric                          AS desconto_percentual,
      NULL::numeric                          AS mensalidade,
      NULL::integer                          AS prazo_meses,
      NULL::numeric                          AS kwh_contratado,
      NULL::numeric                          AS potencia_kwp,
      NULL::text                             AS tipo_rede,
      NULL::text                             AS marca_inversor,
      NULL::text                             AS indicacao,

      -- client_usina_config
      cu.id                                  AS usina_id,
      cu.potencia_modulo_wp                  AS usina_potencia_modulo_wp,
      cu.numero_modulos                      AS usina_numero_modulos,
      cu.modelo_modulo                       AS usina_modelo_modulo,
      cu.modelo_inversor                     AS usina_modelo_inversor,
      cu.tipo_instalacao                     AS usina_tipo_instalacao,
      cu.area_instalacao_m2                  AS usina_area_instalacao_m2,
      cu.geracao_estimada_kwh                AS usina_geracao_estimada_kwh

    FROM public.clients c
    LEFT JOIN public.client_contracts cc
      ON cc.client_id = c.id
    LEFT JOIN public.client_project_status cp
      ON cp.client_id = c.id
    LEFT JOIN public.client_billing_profile cb
      ON cb.client_id = c.id
    LEFT JOIN public.client_usina_config cu
      ON cu.client_id = c.id
    WHERE c.id = ${clientId}
      AND c.in_portfolio = true
      AND c.deleted_at IS NULL
    ORDER BY cc.updated_at DESC NULLS LAST
    LIMIT 1
  `

  try {
    const rows = await fullQuery
    const row = rows[0] ?? null
    return enrichPortfolioClientRow(row)
  } catch (err) {
    // Trigger the reduced query for known-optional column/table errors:
    //   - client_energy_profile unavailable (42P01 / 42703 on ep.* columns)
    //   - migration 0031 contract extension columns missing (42703 on consultant_id etc.)
    // The withoutEnergyProfileQuery uses NULLs for both energy profile fields and
    // the 5 contract extension columns, so it succeeds in either case.
    if (isEnergyProfileDependencyError(err) || isContractExtensionColumnError(err)) {
      console.warn('[portfolio][get] optional columns unavailable — retrying without energy profile and contract extensions', {
        clientId,
        code: err?.code ?? null,
        message: err instanceof Error ? err.message : String(err),
      })

      try {
        const rows = await withoutEnergyProfileQuery
        const row = rows[0] ?? null
        return enrichPortfolioClientRow(row)
      } catch (retryErr) {
        if (!isCompatibilityError(retryErr)) throw retryErr

        console.warn('[portfolio][get] auxiliary tables still incompatible after reduced-column retry — falling back to clients-only query', {
          clientId,
          code: retryErr?.code ?? null,
          message: retryErr instanceof Error ? retryErr.message : String(retryErr),
        })
      }
    } else if (!isCompatibilityError(err)) {
      throw err
    } else {
      console.warn('[portfolio][get] auxiliary tables not provisioned — falling back to clients-only query', {
        clientId,
        code: err?.code ?? null,
        message: err instanceof Error ? err.message : String(err),
      })
    }

    const rows = await sql`
      SELECT
        c.id,
        c.client_name                          AS name,
        c.client_email                         AS email,
        c.client_phone                         AS phone,
        c.client_city                          AS city,
        c.client_state                         AS state,
        c.client_address                       AS address,
        c.client_document                      AS document,
        c.document_type,
        c.consumption_kwh_month,
        c.system_kwp,
        c.term_months,
        c.distribuidora,
        c.uc_geradora                          AS uc,
        c.uc_beneficiaria,
        c.owner_user_id,
        c.created_by_user_id,
        c.created_at                           AS client_created_at,
        c.updated_at                           AS client_updated_at,
        c.in_portfolio                         AS is_converted_customer,
        c.portfolio_exported_at                AS exported_to_portfolio_at,
        c.portfolio_exported_by_user_id        AS exported_by_user_id,
        c.metadata
      FROM public.clients c
      WHERE c.id = ${clientId}
        AND c.in_portfolio = true
        AND c.deleted_at IS NULL
      LIMIT 1
    `
    const row = rows[0] ?? null
    return enrichPortfolioClientRow(row)
  }
}

/**
 * Remove a client from the portfolio by setting in_portfolio = false.
 * Does NOT delete the client from the system; only reverts the portfolio flag.
 * Historical export timestamps are preserved for audit purposes.
 */
export async function removeClientFromPortfolio(sql, clientId) {
  const rows = await sql`
    UPDATE public.clients
    SET
      in_portfolio = false,
      updated_at   = NOW()
    WHERE id = ${clientId}
      AND deleted_at IS NULL
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * Export a client to the portfolio.
 * Updates clients.in_portfolio directly — idempotent, does NOT depend on client_lifecycle.
 * COALESCE ensures that repeated calls preserve the original export timestamp and actor.
 *
 * Compatibility retry: if the DB is running an older schema that doesn't yet have the
 * portfolio_exported_at / portfolio_exported_by_user_id columns (error 42703), the function
 * automatically retries with a minimal UPDATE that only sets in_portfolio = true.
 * This allows the export to succeed on preview environments where migration 0030 has not
 * been applied yet, matching the same pattern used by deleteClient() for updated_by_user_id.
 */
export async function exportClientToPortfolio(sql, clientId, actorUserId) {
  try {
    const rows = await sql`
      UPDATE public.clients
      SET
        in_portfolio                  = true,
        portfolio_exported_at         = COALESCE(portfolio_exported_at, NOW()),
        portfolio_exported_by_user_id = COALESCE(portfolio_exported_by_user_id, ${actorUserId}),
        updated_at                    = NOW()
      WHERE id = ${clientId}
        AND deleted_at IS NULL
      RETURNING *
    `
    return rows[0] ?? null
  } catch (err) {
    const code = err?.code ?? null
    const message = err instanceof Error ? err.message : String(err)
    const isPortfolioColumnMissing =
      code === '42703' &&
      (message.includes('portfolio_exported_at') || message.includes('portfolio_exported_by_user_id'))

    if (!isPortfolioColumnMissing) throw err

    console.warn('[portfolio-export] portfolio columns absent — retrying with minimal UPDATE', {
      clientId,
      code,
      message,
    })

    const rows = await sql`
      UPDATE public.clients
      SET
        in_portfolio = true,
        updated_at   = NOW()
      WHERE id = ${clientId}
        AND deleted_at IS NULL
      RETURNING *
    `
    return rows[0] ?? null
  }
}

/**
 * Update the core clients-table fields that are editable from the portfolio "Cliente" tab.
 * Only non-null values in fields overwrite existing data (COALESCE pattern).
 * Returns the updated row, or null if the client does not exist.
 */
export async function updatePortfolioClientProfile(sql, clientId, fields) {
  const rows = await sql`
    UPDATE public.clients
    SET
      client_name           = COALESCE(${fields.client_name ?? null}, client_name),
      client_email          = COALESCE(${fields.client_email ?? null}, client_email),
      client_phone          = COALESCE(${fields.client_phone ?? null}, client_phone),
      client_city           = COALESCE(${fields.client_city ?? null}, client_city),
      client_state          = COALESCE(${fields.client_state ?? null}, client_state),
      client_address        = COALESCE(${fields.client_address ?? null}, client_address),
      client_document       = COALESCE(${fields.client_document ?? null}, client_document),
      distribuidora         = COALESCE(${fields.distribuidora ?? null}, distribuidora),
      uc_geradora           = COALESCE(${fields.uc_geradora ?? null}, uc_geradora),
      uc_beneficiaria       = COALESCE(${fields.uc_beneficiaria ?? null}, uc_beneficiaria),
      consumption_kwh_month = COALESCE(${fields.consumption_kwh_month ?? null}, consumption_kwh_month),
      system_kwp            = COALESCE(${fields.system_kwp ?? null}, system_kwp),
      term_months           = COALESCE(${fields.term_months ?? null}, term_months),
      updated_at            = NOW()
    WHERE id = ${clientId}
      AND deleted_at IS NULL
    RETURNING id
  `
  return rows[0] ?? null
}

/**
 * Update client lifecycle fields.
 * Returns null (silently) if no client_lifecycle row exists for the given clientId.
 * This table is optional (created by migration 0029); callers should handle null gracefully.
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
    const rows = await (async () => {
      try {
        return await sql`
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
            consultant_id              = COALESCE(${fields.consultant_id ?? null}, consultant_id),
            consultant_name            = COALESCE(${fields.consultant_name ?? null}, consultant_name),
            contract_file_name         = COALESCE(${fields.contract_file_name ?? null}, contract_file_name),
            contract_file_url          = COALESCE(${fields.contract_file_url ?? null}, contract_file_url),
            contract_file_type         = COALESCE(${fields.contract_file_type ?? null}, contract_file_type),
            updated_at                 = ${now}
          WHERE id = ${fields.id}
            AND client_id = ${clientId}
          RETURNING *
        `
      } catch (err) {
        if (!isContractExtensionColumnError(err)) throw err
        console.warn('[portfolio][contract] migration 0031 columns missing — retrying UPDATE without extension columns', {
          clientId,
          contractId: fields.id,
          message: err instanceof Error ? err.message : String(err),
        })
        return await sql`
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
          WHERE id = ${fields.id}
            AND client_id = ${clientId}
          RETURNING *
        `
      }
    })()
    return rows[0] ?? null
  }

  const rows = await (async () => {
    try {
      return await sql`
        INSERT INTO public.client_contracts (
          client_id, source_proposal_id, contract_type, contract_status,
          contract_signed_at, contract_start_date, billing_start_date,
          expected_billing_end_date, contractual_term_months, buyout_eligible,
          buyout_status, buyout_date, buyout_amount_reference, notes,
          consultant_id, consultant_name,
          contract_file_name, contract_file_url, contract_file_type,
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
          ${fields.consultant_id ?? null},
          ${fields.consultant_name ?? null},
          ${fields.contract_file_name ?? null},
          ${fields.contract_file_url ?? null},
          ${fields.contract_file_type ?? null},
          ${now},
          ${now}
        )
        RETURNING *
      `
    } catch (err) {
      if (!isContractExtensionColumnError(err)) throw err
      console.warn('[portfolio][contract] migration 0031 columns missing — retrying INSERT without extension columns', {
        clientId,
        message: err instanceof Error ? err.message : String(err),
      })
      return await sql`
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
    }
  })()
  return rows[0] ?? null
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
  return rows[0] ?? null
}

/**
 * Upsert client_billing_profile (one row per client).
 * Accepts both `commissioning_date` (DB column name) and
 * `commissioning_date_billing` (frontend form field name) for the same column.
 *
 * installments_json handling:
 *  - When fields.installments_json is provided (array), it is written as-is.
 *  - When fields.installments_json is null/undefined (not provided), the UPDATE
 *    clause uses COALESCE(NULL, existing) so the stored array is PRESERVED.
 *    The INSERT clause still seeds an empty array for brand-new rows.
 */
export async function upsertClientBillingProfile(sql, clientId, fields) {
  const now = new Date().toISOString()
  // null means "not provided → preserve existing in UPDATE, seed [] for INSERT"
  const installmentsJsonStr = fields.installments_json != null
    ? JSON.stringify(fields.installments_json)
    : null
  // INSERT fallback: use provided value or default to empty array for new rows
  const installmentsJsonInsert = installmentsJsonStr ?? '[]'
  try {
    const rows = await sql`
      INSERT INTO public.client_billing_profile (
        client_id, contract_id, due_day, reading_day, first_billing_date,
        expected_last_billing_date, recurrence_type, payment_status,
        delinquency_status, collection_stage, auto_reminder_enabled,
        valor_mensalidade, commissioning_date, installments_json,
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
        ${fields.valor_mensalidade ?? null},
        ${fields.commissioning_date ?? fields.commissioning_date_billing ?? null},
        ${installmentsJsonInsert}::jsonb,
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
        valor_mensalidade          = COALESCE(${fields.valor_mensalidade ?? null}, client_billing_profile.valor_mensalidade),
        commissioning_date         = COALESCE(${fields.commissioning_date ?? fields.commissioning_date_billing ?? null}, client_billing_profile.commissioning_date),
        installments_json          = COALESCE(${installmentsJsonStr}::jsonb, client_billing_profile.installments_json),
        updated_at                 = ${now}
      RETURNING *
    `
    return rows[0] ?? null
  } catch (err) {
    // Graceful fallback: if installments_json column doesn't exist yet (migration not applied)
    if (err?.code === '42703' && String(err?.message ?? '').includes('installments_json')) {
      console.warn('[portfolio][billing] installments_json column absent — persisting without it (run migration 0036)', {
        clientId,
        code: err.code,
        message: err.message,
      })
      const rows = await sql`
        INSERT INTO public.client_billing_profile (
          client_id, contract_id, due_day, reading_day, first_billing_date,
          expected_last_billing_date, recurrence_type, payment_status,
          delinquency_status, collection_stage, auto_reminder_enabled,
          valor_mensalidade, commissioning_date,
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
          ${fields.valor_mensalidade ?? null},
          ${fields.commissioning_date ?? fields.commissioning_date_billing ?? null},
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
          valor_mensalidade          = COALESCE(${fields.valor_mensalidade ?? null}, client_billing_profile.valor_mensalidade),
          commissioning_date         = COALESCE(${fields.commissioning_date ?? fields.commissioning_date_billing ?? null}, client_billing_profile.commissioning_date),
          updated_at                 = ${now}
        RETURNING *
      `
      return rows[0] ?? null
    }
    throw err
  }
}

/**
 * Read only the installments_json array from client_billing_profile.
 * Returns an empty array if no row exists or the column is null.
 * Used by handlePortfolioBillingPatch to merge a single installment_payment
 * into the existing array before calling upsertClientBillingProfile.
 */
export async function getBillingInstallmentsJson(sql, clientId) {
  try {
    const rows = await sql`
      SELECT COALESCE(installments_json, '[]'::jsonb) AS installments_json
      FROM public.client_billing_profile
      WHERE client_id = ${clientId}
      LIMIT 1
    `
    if (rows.length === 0) return []
    const raw = rows[0].installments_json
    return Array.isArray(raw) ? raw : []
  } catch (err) {
    // Column may not exist in older schema — return empty array so the caller
    // can still proceed (the subsequent upsert will use the fallback path).
    if (err?.code === '42703') return []
    throw err
  }
}

/**
 * Get notes for a portfolio client.
 */
export async function getClientNotes(sql, clientId) {
  const rows = await sql`
    SELECT *
    FROM public.client_notes
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC
    LIMIT 100
  `
  return rows
}

/**
 * Add a note for a portfolio client.
 */
export async function addClientNote(sql, clientId, { entry_type, title, content, created_by_user_id, created_by_name }) {
  try {
    const rows = await sql`
      INSERT INTO public.client_notes (
        client_id, entry_type, title, content, created_by_user_id, created_by_name, created_at
      )
      VALUES (
        ${clientId},
        ${entry_type ?? 'note'},
        ${title ?? null},
        ${content},
        ${created_by_user_id ?? null},
        ${created_by_name ?? null},
        now()
      )
      RETURNING *
    `
    return rows[0]
  } catch (err) {
    // Graceful fallback if created_by_name column does not exist yet
    // PostgreSQL error 42703 = undefined_column (schema not yet migrated)
    if (err?.code === '42703' && String(err?.message ?? '').includes('created_by_name')) {
      const rows = await sql`
        INSERT INTO public.client_notes (
          client_id, entry_type, title, content, created_by_user_id, created_at
        )
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
    throw err
  }
}

/**
 * Dashboard portfolio summary aggregates.
 * Returns high-level KPIs for the portfolio dashboard.
 * Source of truth: clients.in_portfolio — does NOT require client_lifecycle table.
 * Uses only the clients table to avoid failures from optional auxiliary tables
 * (client_project_status, client_contracts, client_billing_profile) that may not
 * exist when migration 0029 has not been applied.
 */
export async function getPortfolioSummary(sql) {
  const rows = await sql`
    SELECT
      COUNT(*) AS total_portfolio_clients,
      COUNT(*) AS active_portfolio_clients
    FROM public.clients c
    WHERE c.in_portfolio = true
      AND c.deleted_at IS NULL
  `
  return rows[0] ?? {}
}
