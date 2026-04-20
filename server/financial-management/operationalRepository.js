// server/financial-management/operationalRepository.js
//
// Repository for the new operational structures backing the redesigned
// "Lançamentos" (Gestão Financeira) area:
//
//   • financial_item_templates           — reusable system + user item catalog
//   • project_financial_items            — planned composition per project
//   • financial_receivable_plans         — installment / monthly schedules
//   • financial_receivable_plan_items    — individual installments
//
// All dynamic-filter queries use sql(text, params) to avoid the Neon
// nested-template gotcha (see repository.js for context).

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toFloat(value) {
  if (value == null) return null
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function toInt(value) {
  if (value == null) return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

function toBigIntOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizeName(name) {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// financial_item_templates
// ─────────────────────────────────────────────────────────────────────────────

export async function listFinancialItemTemplates(sql, { nature, projectKind, scope } = {}) {
  const conditions = ['deleted_at IS NULL', 'is_active = TRUE']
  const params = []
  if (nature) {
    params.push(nature)
    conditions.push(`nature = $${params.length}`)
  }
  if (projectKind) {
    params.push(projectKind)
    conditions.push(`(project_kind = $${params.length} OR project_kind = 'both')`)
  }
  if (scope) {
    params.push(scope)
    conditions.push(`(scope = $${params.length} OR scope = 'both')`)
  }

  const queryText = `
    SELECT
      id::text,
      name,
      normalized_name,
      nature,
      scope,
      project_kind,
      value_mode,
      default_amount::float,
      default_unit,
      formula_code,
      formula_config_json,
      category,
      is_system,
      is_active,
      can_user_edit,
      sort_order,
      created_at,
      updated_at
    FROM financial_item_templates
    WHERE ${conditions.join(' AND ')}
    ORDER BY is_system DESC, sort_order, name
  `
  return await sql(queryText, params)
}

export async function createFinancialItemTemplate(sql, data, userId) {
  const {
    name,
    nature,
    scope = 'project',
    project_kind = 'both',
    value_mode = 'manual',
    default_amount = null,
    default_unit = 'un',
    formula_code = null,
    formula_config_json = null,
    category = null,
    sort_order = 500,
  } = data

  if (!name || !nature) {
    const err = new Error('name and nature are required for a template')
    err.statusCode = 400
    throw err
  }

  const normalized = normalizeName(name)
  const rows = await sql`
    INSERT INTO financial_item_templates (
      name, normalized_name, nature, scope, project_kind, value_mode,
      default_amount, default_unit, formula_code, formula_config_json,
      category, is_system, is_active, can_user_edit, sort_order,
      created_by_user_id, updated_by_user_id
    ) VALUES (
      ${name}, ${normalized}, ${nature}, ${scope}, ${project_kind}, ${value_mode},
      ${toFloat(default_amount)}, ${default_unit}, ${formula_code}, ${formula_config_json},
      ${category}, FALSE, TRUE, TRUE, ${toInt(sort_order) ?? 500},
      ${userId ?? null}, ${userId ?? null}
    )
    ON CONFLICT (normalized_name, nature, project_kind) DO UPDATE SET
      name = EXCLUDED.name,
      scope = EXCLUDED.scope,
      value_mode = EXCLUDED.value_mode,
      default_amount = EXCLUDED.default_amount,
      default_unit = EXCLUDED.default_unit,
      formula_code = EXCLUDED.formula_code,
      formula_config_json = EXCLUDED.formula_config_json,
      category = EXCLUDED.category,
      is_active = TRUE,
      sort_order = EXCLUDED.sort_order,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = NOW()
    RETURNING
      id::text, name, normalized_name, nature, scope, project_kind, value_mode,
      default_amount::float, default_unit, formula_code, formula_config_json,
      category, is_system, is_active, can_user_edit, sort_order,
      created_at, updated_at
  `
  return rows[0]
}

export async function updateFinancialItemTemplate(sql, id, data, userId) {
  // Block edits to system items where can_user_edit = FALSE
  const guard = await sql`
    SELECT can_user_edit, is_system FROM financial_item_templates
    WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `
  const row = guard[0]
  if (!row) return null
  if (row.is_system && !row.can_user_edit) {
    const err = new Error('System template is not editable.')
    err.statusCode = 403
    throw err
  }

  const {
    name,
    scope,
    project_kind,
    value_mode,
    default_amount,
    default_unit,
    formula_code,
    formula_config_json,
    category,
    is_active,
    sort_order,
  } = data

  const normalized = name ? normalizeName(name) : null

  const rows = await sql`
    UPDATE financial_item_templates SET
      name = COALESCE(${name ?? null}, name),
      normalized_name = COALESCE(${normalized}, normalized_name),
      scope = COALESCE(${scope ?? null}, scope),
      project_kind = COALESCE(${project_kind ?? null}, project_kind),
      value_mode = COALESCE(${value_mode ?? null}, value_mode),
      default_amount = ${default_amount === undefined ? null : toFloat(default_amount)},
      default_unit = COALESCE(${default_unit ?? null}, default_unit),
      formula_code = ${formula_code ?? null},
      formula_config_json = ${formula_config_json ?? null},
      category = COALESCE(${category ?? null}, category),
      is_active = COALESCE(${typeof is_active === 'boolean' ? is_active : null}, is_active),
      sort_order = COALESCE(${toInt(sort_order)}, sort_order),
      updated_by_user_id = ${userId ?? null},
      updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING
      id::text, name, normalized_name, nature, scope, project_kind, value_mode,
      default_amount::float, default_unit, formula_code, formula_config_json,
      category, is_system, is_active, can_user_edit, sort_order,
      created_at, updated_at
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// project_financial_items
// ─────────────────────────────────────────────────────────────────────────────

export async function listProjectFinancialItems(sql, { proposalId, clientId, projectKind } = {}) {
  const conditions = ['deleted_at IS NULL']
  const params = []
  if (proposalId) {
    params.push(proposalId)
    conditions.push(`proposal_id = $${params.length}::uuid`)
  }
  const cidNum = toBigIntOrNull(clientId)
  if (cidNum != null) {
    params.push(cidNum)
    conditions.push(`client_id = $${params.length}`)
  }
  if (projectKind) {
    params.push(projectKind)
    conditions.push(`project_kind = $${params.length}`)
  }

  const queryText = `
    SELECT
      id::text,
      proposal_id::text,
      client_id,
      project_kind,
      template_id::text,
      item_name,
      item_code,
      nature,
      category,
      subcategory,
      value_mode,
      expected_amount::float,
      expected_quantity::float,
      expected_total::float,
      pricing_source,
      formula_snapshot_json,
      is_required,
      is_system_generated,
      sort_order,
      notes,
      created_at,
      updated_at
    FROM project_financial_items
    WHERE ${conditions.join(' AND ')}
    ORDER BY nature DESC, sort_order, item_name
  `
  return await sql(queryText, params)
}

export async function createProjectFinancialItem(sql, data, userId) {
  const {
    proposal_id = null,
    client_id = null,
    project_kind,
    template_id = null,
    item_name,
    item_code = null,
    nature,
    category,
    subcategory = null,
    value_mode = 'manual',
    expected_amount = null,
    expected_quantity = null,
    expected_total = null,
    pricing_source = null,
    formula_snapshot_json = null,
    is_required = false,
    is_system_generated = false,
    sort_order = 500,
    notes = null,
  } = data

  if (!project_kind || !item_name || !nature || !category) {
    const err = new Error('project_kind, item_name, nature and category are required')
    err.statusCode = 400
    throw err
  }

  const rows = await sql`
    INSERT INTO project_financial_items (
      proposal_id, client_id, project_kind, template_id,
      item_name, item_code, nature, category, subcategory,
      value_mode, expected_amount, expected_quantity, expected_total,
      pricing_source, formula_snapshot_json,
      is_required, is_system_generated, sort_order, notes,
      created_by_user_id, updated_by_user_id
    ) VALUES (
      ${proposal_id},
      ${toBigIntOrNull(client_id)},
      ${project_kind},
      ${template_id},
      ${item_name},
      ${item_code},
      ${nature},
      ${category},
      ${subcategory},
      ${value_mode},
      ${toFloat(expected_amount)},
      ${toFloat(expected_quantity)},
      ${toFloat(expected_total)},
      ${pricing_source},
      ${formula_snapshot_json},
      ${!!is_required},
      ${!!is_system_generated},
      ${toInt(sort_order) ?? 500},
      ${notes},
      ${userId ?? null},
      ${userId ?? null}
    )
    RETURNING
      id::text, proposal_id::text, client_id, project_kind, template_id::text,
      item_name, item_code, nature, category, subcategory, value_mode,
      expected_amount::float, expected_quantity::float, expected_total::float,
      pricing_source, formula_snapshot_json, is_required, is_system_generated,
      sort_order, notes, created_at, updated_at
  `
  return rows[0]
}

export async function updateProjectFinancialItem(sql, id, data, userId) {
  const {
    item_name,
    item_code,
    category,
    subcategory,
    value_mode,
    expected_amount,
    expected_quantity,
    expected_total,
    pricing_source,
    formula_snapshot_json,
    is_required,
    sort_order,
    notes,
  } = data

  const rows = await sql`
    UPDATE project_financial_items SET
      item_name = COALESCE(${item_name ?? null}, item_name),
      item_code = ${item_code ?? null},
      category = COALESCE(${category ?? null}, category),
      subcategory = ${subcategory ?? null},
      value_mode = COALESCE(${value_mode ?? null}, value_mode),
      expected_amount = ${expected_amount === undefined ? null : toFloat(expected_amount)},
      expected_quantity = ${expected_quantity === undefined ? null : toFloat(expected_quantity)},
      expected_total = ${expected_total === undefined ? null : toFloat(expected_total)},
      pricing_source = ${pricing_source ?? null},
      formula_snapshot_json = ${formula_snapshot_json ?? null},
      is_required = COALESCE(${typeof is_required === 'boolean' ? is_required : null}, is_required),
      sort_order = COALESCE(${toInt(sort_order)}, sort_order),
      notes = ${notes ?? null},
      updated_by_user_id = ${userId ?? null},
      updated_at = NOW()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING
      id::text, proposal_id::text, client_id, project_kind, template_id::text,
      item_name, item_code, nature, category, subcategory, value_mode,
      expected_amount::float, expected_quantity::float, expected_total::float,
      pricing_source, formula_snapshot_json, is_required, is_system_generated,
      sort_order, notes, created_at, updated_at
  `
  return rows[0] ?? null
}

export async function deleteProjectFinancialItem(sql, id, userId) {
  const rows = await sql`
    UPDATE project_financial_items
    SET deleted_at = NOW(), updated_by_user_id = ${userId ?? null}
    WHERE id = ${id}::uuid AND deleted_at IS NULL
    RETURNING id::text
  `
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap planned items from a proposal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a proposal and its payload_json, derives the project kind,
 * and inserts a default set of planned items into project_financial_items.
 *
 * Returns the created items. Existing items for the same proposal are kept;
 * duplicates (same template_id) are skipped.
 */
export async function bootstrapProjectFinancialStructure(sql, proposalId, userId) {
  const proposalRows = await sql`
    SELECT
      id::text,
      proposal_type,
      client_id,
      capex_total::float,
      contract_value::float,
      payload_json
    FROM proposals
    WHERE id = ${proposalId}::uuid AND deleted_at IS NULL
    LIMIT 1
  `
  const proposal = proposalRows[0]
  if (!proposal) {
    const err = new Error('Proposal not found.')
    err.statusCode = 404
    throw err
  }

  const projectKind = inferProjectKind(proposal)
  const payload = proposal.payload_json || {}

  // Pull the current set of system templates for this project kind
  const templates = await listFinancialItemTemplates(sql, { projectKind })

  // Existing items for this proposal — to avoid duplicating same template
  const existing = await sql`
    SELECT template_id::text AS template_id
    FROM project_financial_items
    WHERE proposal_id = ${proposalId}::uuid AND deleted_at IS NULL
  `
  const existingTemplateIds = new Set(existing.map((r) => r.template_id).filter(Boolean))

  const created = []
  for (const tpl of templates) {
    if (existingTemplateIds.has(tpl.id)) continue
    const expectedAmount = deriveExpectedAmountFromPayload(tpl, payload, proposal)
    const itemPayload = {
      proposal_id: proposalId,
      client_id: proposal.client_id,
      project_kind: projectKind,
      template_id: tpl.id,
      item_name: tpl.name,
      item_code: tpl.normalized_name,
      nature: tpl.nature,
      category: tpl.category || tpl.name,
      value_mode: tpl.value_mode,
      expected_amount: expectedAmount,
      expected_quantity: 1,
      expected_total: expectedAmount,
      pricing_source: expectedAmount != null ? 'proposal_payload' : 'template_default',
      is_required: tpl.value_mode === 'fixed' || tpl.nature === 'income',
      is_system_generated: true,
      sort_order: tpl.sort_order,
    }
    const inserted = await createProjectFinancialItem(sql, itemPayload, userId)
    created.push(inserted)
  }

  return { project_kind: projectKind, created_count: created.length, items: created }
}

function inferProjectKind(proposal) {
  const t = String(proposal.proposal_type || '').toLowerCase()
  if (t.includes('lease') || t.includes('leasing')) return 'leasing'
  if (t.includes('venda') || t.includes('sale')) return 'sale'
  if (t.includes('buyout')) return 'buyout'
  // Default to sale when ambiguous — operator can change later.
  return 'sale'
}

/**
 * Derives a sensible expected_amount for a given template using the
 * proposal payload. Returns null when the payload doesn't carry that info,
 * letting the user fill it in manually.
 */
function deriveExpectedAmountFromPayload(template, payload, proposal) {
  const code = template.normalized_name
  const pickNumber = (...candidates) => {
    for (const v of candidates) {
      const n = toFloat(v)
      if (n != null && n > 0) return n
    }
    return null
  }

  switch (code) {
    case 'kit':
      return pickNumber(payload.autoKitValor, payload.kitValor, payload.precoKit)
    case 'frete':
      return pickNumber(payload.freteValor, payload.frete)
    case 'projeto':
      return pickNumber(payload.projetoValor, payload.valorProjeto)
    case 'instalacao':
      return pickNumber(payload.instalacaoValor, payload.valorInstalacao)
    case 'comissao':
      return pickNumber(payload.comissaoValor, payload.valorComissao)
    case 'seguro':
      return pickNumber(payload.seguroValorA, payload.seguroValor)
    case 'mensalidade_leasing':
      return pickNumber(payload.mensal, payload.mensalidade, payload.parcelaInicial)
    case 'venda_de_sistema':
      return pickNumber(proposal.contract_value, payload.valorVenda, payload.precoVenda)
    case 'entrada':
      return pickNumber(payload.entradaValor, payload.valorEntrada)
    case 'parcela':
      return pickNumber(payload.parcelaValor, payload.valorParcela)
    case 'crea_art':
      return pickNumber(payload.creaValor)
    case 'placa':
      return toFloat(template.default_amount)
    case 'impostos':
      return pickNumber(payload.impostosValor)
    default:
      return toFloat(template.default_amount)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// financial_receivable_plans
// ─────────────────────────────────────────────────────────────────────────────

export async function listReceivablePlans(sql, { proposalId, clientId } = {}) {
  const conditions = ['deleted_at IS NULL']
  const params = []
  if (proposalId) {
    params.push(proposalId)
    conditions.push(`proposal_id = $${params.length}::uuid`)
  }
  const cidNum = toBigIntOrNull(clientId)
  if (cidNum != null) {
    params.push(cidNum)
    conditions.push(`client_id = $${params.length}`)
  }
  const queryText = `
    SELECT
      id::text, proposal_id::text, client_id, project_kind, plan_name,
      total_contract_value::float, installment_count, first_due_date::text,
      recurrence_type, status, created_at, updated_at
    FROM financial_receivable_plans
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
  `
  return await sql(queryText, params)
}

export async function createReceivablePlan(sql, data, userId) {
  const {
    proposal_id = null,
    client_id = null,
    project_kind,
    plan_name,
    total_contract_value = 0,
    installment_count = 0,
    first_due_date = null,
    recurrence_type = null,
    status = 'active',
  } = data

  if (!project_kind || !plan_name) {
    const err = new Error('project_kind and plan_name are required')
    err.statusCode = 400
    throw err
  }

  const rows = await sql`
    INSERT INTO financial_receivable_plans (
      proposal_id, client_id, project_kind, plan_name,
      total_contract_value, installment_count, first_due_date,
      recurrence_type, status,
      created_by_user_id, updated_by_user_id
    ) VALUES (
      ${proposal_id}, ${toBigIntOrNull(client_id)}, ${project_kind}, ${plan_name},
      ${toFloat(total_contract_value) ?? 0},
      ${toInt(installment_count) ?? 0},
      ${parseDate(first_due_date)},
      ${recurrence_type}, ${status},
      ${userId ?? null}, ${userId ?? null}
    )
    RETURNING
      id::text, proposal_id::text, client_id, project_kind, plan_name,
      total_contract_value::float, installment_count, first_due_date::text,
      recurrence_type, status, created_at, updated_at
  `
  return rows[0]
}

export { normalizeName as _normalizeName }
