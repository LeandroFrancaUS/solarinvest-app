// server/financial-import/repository.js
// Database access layer for the financial import feature.
// All queries are parameterized; no raw string interpolation.

// ── Client lookups ───────────────────────────────────────────────────────────

/** Find clients by partial name match (case-insensitive, max 10). */
export async function findClientsByName(sql, name) {
  if (!name?.trim()) return []
  const rows = await sql`
    SELECT id, name, state, city, document
    FROM clients
    WHERE deleted_at IS NULL
      AND LOWER(TRIM(name)) LIKE LOWER(${`%${name.trim()}%`})
    ORDER BY name
    LIMIT 10
  `
  return rows
}

/** Find a single client by exact name + optional state match. */
export async function findClientByNameAndState(sql, name, state) {
  if (!name?.trim()) return null
  const rows = await sql`
    SELECT id, name, state, city, document
    FROM clients
    WHERE deleted_at IS NULL
      AND LOWER(TRIM(name)) = LOWER(TRIM(${name.trim()}))
      AND (${state ?? null}::TEXT IS NULL OR UPPER(TRIM(COALESCE(state,''))) = UPPER(TRIM(${state ?? ''})))
    LIMIT 1
  `
  return rows[0] ?? null
}

/** Create a new client. Returns the created row. */
export async function insertClient(sql, { name, state, city, userId }) {
  const rows = await sql`
    INSERT INTO clients (name, state, city, user_id, created_at, updated_at)
    VALUES (
      ${name.trim()},
      ${state?.trim() ?? null},
      ${city?.trim() ?? null},
      ${userId ?? null},
      NOW(), NOW()
    )
    RETURNING id, name, state, city
  `
  return rows[0]
}

// ── Proposal lookups ─────────────────────────────────────────────────────────

/** Find proposals already linked to a client via client_id FK. */
export async function findProposalsByClientId(sql, clientId) {
  const rows = await sql`
    SELECT id, proposal_type, proposal_code, status, client_name,
           consumption_kwh_month, system_kwp, capex_total, contract_value
    FROM proposals
    WHERE client_id = ${clientId}
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 5
  `
  return rows
}

/** Find proposals by matching client_name snapshot. */
export async function findProposalsByClientName(sql, clientName) {
  if (!clientName?.trim()) return []
  const rows = await sql`
    SELECT id, proposal_type, proposal_code, status, client_name,
           consumption_kwh_month, system_kwp, capex_total, contract_value
    FROM proposals
    WHERE deleted_at IS NULL
      AND LOWER(TRIM(client_name)) = LOWER(TRIM(${clientName.trim()}))
    ORDER BY updated_at DESC
    LIMIT 5
  `
  return rows
}

/** Create a new proposal linked to a client. */
export async function insertProposal(sql, { clientId, proposalType, clientName, state, userId, payload }) {
  const rows = await sql`
    INSERT INTO proposals (
      proposal_type, status,
      owner_user_id, created_by_user_id,
      client_id, client_name, client_state,
      payload_json, created_at, updated_at
    )
    VALUES (
      ${proposalType}, 'draft',
      ${userId ?? 'system'}, ${userId ?? 'system'},
      ${clientId ?? null}, ${clientName?.trim() ?? null}, ${state?.trim() ?? null},
      ${JSON.stringify(payload ?? {})}::jsonb,
      NOW(), NOW()
    )
    RETURNING id, proposal_type, status, client_id, client_name
  `
  return rows[0]
}

// ── Financial project lookups ─────────────────────────────────────────────────

/** Find financial_projects by client_id. */
export async function findFinancialProjectsByClientId(sql, clientId) {
  const rows = await sql`
    SELECT id, project_type, status, title, proposal_id, state, created_at
    FROM financial_projects
    WHERE client_id = ${clientId}
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 5
  `
  return rows
}

/** Create a new financial_project. */
export async function insertFinancialProject(sql, {
  clientId, proposalId, projectType, title, state, city,
  batchId, itemId, userId,
}) {
  const rows = await sql`
    INSERT INTO financial_projects (
      client_id, proposal_id, project_type, status, title,
      state, city,
      source_import_batch_id, source_import_item_id,
      is_generated_from_proposal,
      created_by_user_id, updated_by_user_id,
      created_at, updated_at
    )
    VALUES (
      ${clientId}, ${proposalId ?? null}, ${projectType}, 'draft', ${title ?? ''},
      ${state ?? null}, ${city ?? null},
      ${batchId ?? null}, ${itemId ?? null},
      ${proposalId != null},
      ${userId ?? null}, ${userId ?? null},
      NOW(), NOW()
    )
    RETURNING id, client_id, proposal_id, project_type, status, title
  `
  return rows[0]
}

/** Upsert power plant data (1:1 with financial_projects). */
export async function upsertPowerPlant(sql, projectId, clientId, proposalId, data) {
  const payload = data.technical_payload ?? {}
  const rows = await sql`
    INSERT INTO project_power_plants (
      project_id, client_id, proposal_id,
      consumo_kwh_mes, kwh_contratado, geracao_estimada_kwh_mes,
      potencia_instalada_kwp, potencia_modulo_wp, quantidade_modulos,
      modelo_modulo, modelo_inversor, irradiacao, performance_ratio,
      tarifa_cheia_r_kwh, technical_payload,
      created_at, updated_at
    )
    VALUES (
      ${projectId}, ${clientId}, ${proposalId ?? null},
      ${data.consumo_kwh_mes ?? null}, ${data.kwh_contratado ?? null},
      ${data.geracao_estimada_kwh_mes ?? null},
      ${data.potencia_instalada_kwp ?? null}, ${data.potencia_modulo_wp ?? null},
      ${data.quantidade_modulos ?? null},
      ${data.modelo_modulo ?? null}, ${data.modelo_inversor ?? null},
      ${data.irradiacao ?? null}, ${data.performance_ratio ?? null},
      ${data.tarifa_cheia_r_kwh ?? null},
      ${JSON.stringify(payload)}::jsonb,
      NOW(), NOW()
    )
    ON CONFLICT (project_id) DO UPDATE SET
      consumo_kwh_mes          = EXCLUDED.consumo_kwh_mes,
      kwh_contratado           = EXCLUDED.kwh_contratado,
      geracao_estimada_kwh_mes = EXCLUDED.geracao_estimada_kwh_mes,
      potencia_instalada_kwp   = EXCLUDED.potencia_instalada_kwp,
      potencia_modulo_wp       = EXCLUDED.potencia_modulo_wp,
      quantidade_modulos        = EXCLUDED.quantidade_modulos,
      modelo_modulo            = EXCLUDED.modelo_modulo,
      modelo_inversor          = EXCLUDED.modelo_inversor,
      irradiacao               = EXCLUDED.irradiacao,
      performance_ratio        = EXCLUDED.performance_ratio,
      tarifa_cheia_r_kwh       = EXCLUDED.tarifa_cheia_r_kwh,
      technical_payload        = EXCLUDED.technical_payload,
      updated_at               = NOW()
    RETURNING project_id
  `
  return rows[0]
}

/** Upsert financial summary data (1:1 with financial_projects). */
export async function upsertFinancialSummary(sql, projectId, clientId, proposalId, data) {
  const rows = await sql`
    INSERT INTO project_financial_summaries (
      project_id, client_id, proposal_id,
      capex_total, custo_kit, frete,
      engineering_cost, installation_cost, insurance_amount,
      taxes_amount, commission_amount, monthly_revenue,
      expected_total_revenue, expected_profit,
      roi_percent, payback_months, irr_annual, irr_monthly,
      npv_amount, default_rate_percent, healthy_minimum_price,
      summary_payload, calculated_at, created_at, updated_at
    )
    VALUES (
      ${projectId}, ${clientId}, ${proposalId ?? null},
      ${data.capex_total ?? null}, ${data.custo_kit ?? null}, ${data.frete ?? null},
      ${data.engineering_cost ?? null}, ${data.installation_cost ?? null},
      ${data.insurance_amount ?? null},
      ${data.taxes_amount ?? null}, ${data.commission_amount ?? null},
      ${data.monthly_revenue ?? null},
      ${data.expected_total_revenue ?? null}, ${data.expected_profit ?? null},
      ${data.roi_percent ?? null}, ${data.payback_months ?? null},
      ${data.irr_annual ?? null}, ${data.irr_monthly ?? null},
      ${data.npv_amount ?? null}, ${data.default_rate_percent ?? null},
      ${data.healthy_minimum_price ?? null},
      ${JSON.stringify(data.summary_payload ?? {})}::jsonb,
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (project_id) DO UPDATE SET
      capex_total            = EXCLUDED.capex_total,
      custo_kit              = EXCLUDED.custo_kit,
      frete                  = EXCLUDED.frete,
      monthly_revenue        = EXCLUDED.monthly_revenue,
      expected_total_revenue = EXCLUDED.expected_total_revenue,
      expected_profit        = EXCLUDED.expected_profit,
      roi_percent            = EXCLUDED.roi_percent,
      payback_months         = EXCLUDED.payback_months,
      irr_annual             = EXCLUDED.irr_annual,
      irr_monthly            = EXCLUDED.irr_monthly,
      npv_amount             = EXCLUDED.npv_amount,
      summary_payload        = EXCLUDED.summary_payload,
      calculated_at          = NOW(),
      updated_at             = NOW()
    RETURNING project_id
  `
  return rows[0]
}

// ── Import batch / item ──────────────────────────────────────────────────────

/** Create an import batch record. Returns the batch row. */
export async function insertImportBatch(sql, {
  fileName, mimeType, fileSizeBytes, fileHash, importType, previewOnly, mergeMode, userId,
}) {
  const rows = await sql`
    INSERT INTO financial_import_batches (
      source_file_name, source_mime_type, source_file_size_bytes, source_file_hash,
      import_type, status, preview_only, merge_mode,
      created_by_user_id, created_at, updated_at
    )
    VALUES (
      ${fileName}, ${mimeType ?? null}, ${fileSizeBytes ?? null}, ${fileHash ?? null},
      ${importType ?? 'financial_management'}, 'uploaded',
      ${previewOnly === true}, ${mergeMode === true},
      ${userId ?? null}, NOW(), NOW()
    )
    RETURNING id, status, created_at
  `
  return rows[0]
}

/** Update batch status and counters after processing. */
export async function updateImportBatch(sql, batchId, updates) {
  const rows = await sql`
    UPDATE financial_import_batches SET
      status                = ${updates.status ?? 'completed'},
      total_worksheets      = ${updates.total_worksheets ?? 0},
      total_detected_items  = ${updates.total_detected_items ?? 0},
      total_created_clients = ${updates.total_created_clients ?? 0},
      total_updated_clients = ${updates.total_updated_clients ?? 0},
      total_created_proposals = ${updates.total_created_proposals ?? 0},
      total_updated_proposals = ${updates.total_updated_proposals ?? 0},
      total_created_projects  = ${updates.total_created_projects ?? 0},
      total_updated_projects  = ${updates.total_updated_projects ?? 0},
      total_created_entries   = ${updates.total_created_entries ?? 0},
      total_ignored_items   = ${updates.total_ignored_items ?? 0},
      total_conflicts       = ${updates.total_conflicts ?? 0},
      warnings_json         = ${JSON.stringify(updates.warnings ?? [])}::jsonb,
      summary_json          = ${JSON.stringify(updates.summary ?? {})}::jsonb,
      started_at            = COALESCE(started_at, NOW()),
      completed_at          = NOW(),
      updated_at            = NOW()
    WHERE id = ${batchId}
    RETURNING id, status
  `
  return rows[0]
}

/** Insert an import item (one per detected project/sheet). */
export async function insertImportItem(sql, batchId, item) {
  const rows = await sql`
    INSERT INTO financial_import_items (
      batch_id, source_sheet_name, worksheet_type,
      source_row_start, source_row_end,
      detected_client_name, detected_uf, detected_project_type,
      match_type, match_confidence,
      linked_client_id, linked_proposal_id, linked_project_id,
      created_client_id, created_proposal_id, created_project_id,
      status, raw_json, normalized_json, warnings_json, errors_json,
      created_at, updated_at
    )
    VALUES (
      ${batchId},
      ${item.source_sheet_name},
      ${item.worksheet_type ?? 'unknown'},
      ${item.source_row_start ?? null},
      ${item.source_row_end ?? null},
      ${item.detected_client_name ?? null},
      ${item.detected_uf ?? null},
      ${item.detected_project_type ?? null},
      ${item.match_type ?? 'none'},
      ${item.match_confidence ?? 0},
      ${item.linked_client_id ?? null},
      ${item.linked_proposal_id ?? null},
      ${item.linked_project_id ?? null},
      ${item.created_client_id ?? null},
      ${item.created_proposal_id ?? null},
      ${item.created_project_id ?? null},
      ${item.status ?? 'detected'},
      ${JSON.stringify(item.raw_json ?? {})}::jsonb,
      ${JSON.stringify(item.normalized_json ?? {})}::jsonb,
      ${JSON.stringify(item.warnings ?? [])}::jsonb,
      ${JSON.stringify(item.errors ?? [])}::jsonb,
      NOW(), NOW()
    )
    RETURNING id
  `
  return rows[0]
}

/** List recent import batches (for the UI history). */
export async function listImportBatches(sql, { limit = 20, userId } = {}) {
  const rows = await sql`
    SELECT
      id, source_file_name, status, preview_only, merge_mode,
      total_detected_items, total_created_clients, total_created_projects,
      total_conflicts, created_by_user_id, created_at, completed_at
    FROM financial_import_batches
    WHERE (${userId ?? null}::TEXT IS NULL OR created_by_user_id = ${userId ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows
}
