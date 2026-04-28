// server/project-charges/repository.js
// Database queries for the project_monthly_charges table.
// Reads/writes: project_monthly_charges.
// Does NOT touch: client_invoices, financial_receivable_plan_items,
//                 client_billing_profile, or any billing engine.

// ─────────────────────────────────────────────────────────────────────────────
// Allowed statuses (mirrors the CHECK constraint in migration 0059)
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_STATUSES = Object.freeze(['prevista', 'emitida', 'paga', 'vencida', 'cancelada'])

const DEFAULT_VALOR_PAGO = 0
const DEFAULT_STATUS = 'prevista'

// ─────────────────────────────────────────────────────────────────────────────
// Row mapper
// ─────────────────────────────────────────────────────────────────────────────

function mapChargeRow(row) {
  if (!row) return null
  return {
    id: row.id,
    project_id: row.project_id,
    client_id: row.client_id == null ? null : Number(row.client_id),
    installment_num: Number(row.installment_num),
    reference_month: row.reference_month,
    due_date: row.due_date,
    valor_previsto: row.valor_previsto == null ? null : Number(row.valor_previsto),
    valor_cobrado: row.valor_cobrado == null ? null : Number(row.valor_cobrado),
    valor_pago: row.valor_pago == null ? null : Number(row.valor_pago),
    status: row.status,
    paid_at: row.paid_at ?? null,
    receipt_number: row.receipt_number ?? null,
    confirmed_by: row.confirmed_by ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — list all charges for a project, ordered by installment_num ASC
// ─────────────────────────────────────────────────────────────────────────────

export async function listChargesByProjectId(sql, projectId) {
  const rows = await sql`
    SELECT
      id::text,
      project_id::text,
      client_id,
      installment_num,
      reference_month,
      due_date,
      valor_previsto,
      valor_cobrado,
      valor_pago,
      status,
      paid_at,
      receipt_number,
      confirmed_by,
      notes,
      created_at,
      updated_at
    FROM project_monthly_charges
    WHERE project_id = ${String(projectId)}::uuid
    ORDER BY installment_num ASC
  `
  return rows.map(mapChargeRow)
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — batch-insert installments (idempotent via ON CONFLICT DO NOTHING)
//
// params:
//   projectId    — UUID string
//   clientId     — number or null
//   installments — array of { installment_num, reference_month, due_date,
//                              valor_previsto, valor_cobrado }
// ─────────────────────────────────────────────────────────────────────────────

export async function batchInsertCharges(sql, projectId, clientId, installments) {
  if (!installments || installments.length === 0) return []

  // Build a single multi-row VALUES insert for efficiency.
  // Neon tagged-template sql`` does not support dynamic array expansion, so
  // we fall back to the parameterised sql(text, params) form — same technique
  // used in server/projects/repository.js (listProjects).

  const params = []
  const valueClauses = installments.map((inst) => {
    params.push(String(projectId))            // project_id
    params.push(clientId ?? null)             // client_id
    params.push(Number(inst.installment_num)) // installment_num
    params.push(String(inst.reference_month)) // reference_month
    params.push(String(inst.due_date))        // due_date
    params.push(Number(inst.valor_previsto))  // valor_previsto
    params.push(Number(inst.valor_cobrado))   // valor_cobrado

    const base = params.length - 7
    return (
      `($${base + 1}::uuid, $${base + 2}, $${base + 3}, $${base + 4}::date, ` +
      `$${base + 5}::date, $${base + 6}, $${base + 7}, ${DEFAULT_VALOR_PAGO}, '${DEFAULT_STATUS}')`
    )
  })

  const queryText = `
    INSERT INTO project_monthly_charges
      (project_id, client_id, installment_num, reference_month, due_date,
       valor_previsto, valor_cobrado, valor_pago, status)
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (project_id, installment_num) DO NOTHING
    RETURNING
      id::text,
      project_id::text,
      client_id,
      installment_num,
      reference_month,
      due_date,
      valor_previsto,
      valor_cobrado,
      valor_pago,
      status,
      paid_at,
      receipt_number,
      confirmed_by,
      notes,
      created_at,
      updated_at
  `

  const rows = await sql(queryText, params)
  return rows.map(mapChargeRow)
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — update a single charge (payment info only)
//
// Allowed fields: status, valor_pago, paid_at, receipt_number,
//                 confirmed_by, notes
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCharge(sql, chargeId, fields) {
  // Build the SET clause from provided (non-undefined) fields only.
  const params = []
  const setClauses = []

  if (fields.status !== undefined) {
    params.push(fields.status)
    setClauses.push(`status = $${params.length}`)
  }

  if (fields.valor_pago !== undefined) {
    params.push(Number(fields.valor_pago))
    setClauses.push(`valor_pago = $${params.length}`)
  }

  if (fields.paid_at !== undefined) {
    // null is valid (clear the timestamp)
    params.push(fields.paid_at ?? null)
    setClauses.push(`paid_at = $${params.length}`)
  } else if (fields.status === 'paga') {
    // Auto-fill paid_at when marking as paid and caller didn't supply it.
    setClauses.push(`paid_at = COALESCE(paid_at, now())`)
  }

  if (fields.receipt_number !== undefined) {
    params.push(fields.receipt_number ?? null)
    setClauses.push(`receipt_number = $${params.length}`)
  }

  if (fields.confirmed_by !== undefined) {
    params.push(fields.confirmed_by ?? null)
    setClauses.push(`confirmed_by = $${params.length}`)
  }

  if (fields.notes !== undefined) {
    params.push(fields.notes ?? null)
    setClauses.push(`notes = $${params.length}`)
  }

  if (setClauses.length === 0) return null

  params.push(String(chargeId))
  const idIdx = params.length

  const queryText = `
    UPDATE project_monthly_charges
    SET ${setClauses.join(', ')}
    WHERE id = $${idIdx}::uuid
    RETURNING
      id::text,
      project_id::text,
      client_id,
      installment_num,
      reference_month,
      due_date,
      valor_previsto,
      valor_cobrado,
      valor_pago,
      status,
      paid_at,
      receipt_number,
      confirmed_by,
      notes,
      created_at,
      updated_at
  `

  const rows = await sql(queryText, params)
  return mapChargeRow(rows[0])
}
