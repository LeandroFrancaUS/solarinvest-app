// server/project-charges/handler.js
// HTTP route handlers for project monthly charges.
//
// Routes registered in server/handler.js:
//   GET  /api/projects/:id/charges          → handleProjectChargesList
//   POST /api/projects/:id/charges/generate → handleProjectChargesGenerate
//   PATCH /api/charges/:id                  → handleChargeUpdate
//
// RBAC: read  → admin | office | financeiro
//       write → admin | office

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { findProjectById } from '../projects/repository.js'
import {
  ALLOWED_STATUSES,
  listChargesByProjectId,
  batchInsertCharges,
  updateCharge,
} from './repository.js'

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers (mirror server/projects/handler.js conventions)
// ─────────────────────────────────────────────────────────────────────────────

const READ_ROLES  = ['role_admin', 'role_office', 'role_financeiro']
const WRITE_ROLES = ['role_admin', 'role_office']

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireRead(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!READ_ROLES.includes(actorRole(actor))) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso a cobranças não permitido para este perfil.')
    return false
  }
  return true
}

function requireWrite(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!WRITE_ROLES.includes(actorRole(actor))) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Operação de escrita em cobranças requer perfil admin ou office.')
    return false
  }
  return true
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  if (!db?.sql) {
    const err = new Error('Database not configured')
    err.statusCode = 503
    throw err
  }
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}

function logError(scope, err, extra = {}) {
  console.error(`[project-charges][${scope}] error`, {
    ...extra,
    code: err?.code ?? null,
    detail: err?.detail ?? null,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a "YYYY-MM-01" string for the reference month of installment i
 * (0-based offset) starting from startDate.
 *
 * startDate — "YYYY-MM-DD" string
 * offset    — 0-based month offset
 */
function referenceMonth(startDate, offset) {
  const d = new Date(startDate + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + offset)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/**
 * Returns a "YYYY-MM-DD" due date for dueDay in the same month as refMonth.
 * Clamps to the last day of the month when dueDay exceeds the month length.
 *
 * refMonth — "YYYY-MM-01" string
 * dueDay   — integer 1..31
 *
 * Note: Date.UTC(y, m, 0) exploits JS day-0 wrap-around: month m with day 0
 * backs up to the last day of month m-1 (i.e. the last day of the target
 * month when m is the 1-based month number from the YYYY-MM-01 string).
 */
function dueDate(refMonth, dueDay) {
  const [y, m] = refMonth.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate() // last day of month
  const day = Math.min(dueDay, lastDay)
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id/charges
// ─────────────────────────────────────────────────────────────────────────────

export async function handleProjectChargesList(req, res, { method, projectId, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireRead(actor, sendJson)) return
  if (method !== 'GET') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  try {
    const sql = await getScopedSql(actor)

    // Ensure project exists and is visible to the actor.
    const project = await findProjectById(sql, projectId)
    if (!project) {
      sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
      return
    }

    const charges = await listChargesByProjectId(sql, projectId)
    sendJson(200, { data: charges })
  } catch (err) {
    logError('list', err, { projectId })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao listar cobranças do projeto.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects/:id/charges/generate
// Body: { startDate, months, valorMensalidade, dueDay }
// ─────────────────────────────────────────────────────────────────────────────

export async function handleProjectChargesGenerate(req, res, { method, projectId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWrite(actor, sendJson)) return
  if (method !== 'POST') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendError(sendJson, 400, 'INVALID_JSON', 'JSON inválido na requisição.')
    return
  }

  // ── Validate inputs ──────────────────────────────────────────────────────

  const { startDate, months, valorMensalidade, dueDay } = body ?? {}

  if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    sendError(sendJson, 400, 'INVALID_START_DATE', 'startDate deve estar no formato YYYY-MM-DD.')
    return
  }
  if (!Number.isInteger(months) || months < 1) {
    sendError(sendJson, 400, 'INVALID_MONTHS', 'months deve ser um inteiro positivo.')
    return
  }
  if (typeof valorMensalidade !== 'number' || !Number.isFinite(valorMensalidade) || valorMensalidade < 0) {
    sendError(sendJson, 400, 'INVALID_VALOR', 'valorMensalidade deve ser um número não negativo.')
    return
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    sendError(sendJson, 400, 'INVALID_DUE_DAY', 'dueDay deve ser um inteiro entre 1 e 31.')
    return
  }

  try {
    const sql = await getScopedSql(actor)

    // Ensure project exists and is visible to the actor.
    const project = await findProjectById(sql, projectId)
    if (!project) {
      sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
      return
    }

    // Build installment list.
    const installments = []
    for (let i = 0; i < months; i++) {
      const refMonth = referenceMonth(startDate, i)
      installments.push({
        installment_num: i + 1,
        reference_month: refMonth,
        due_date: dueDate(refMonth, dueDay),
        valor_previsto: valorMensalidade,
        valor_cobrado: valorMensalidade,
      })
    }

    const inserted = await batchInsertCharges(sql, projectId, project.client_id, installments)
    sendJson(201, { data: inserted, meta: { generated: months, inserted: inserted.length } })
  } catch (err) {
    logError('generate', err, { projectId })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao gerar cobranças do projeto.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/charges/:id
// Body: { status?, valor_pago?, paid_at?, receipt_number?, confirmed_by?, notes? }
// ─────────────────────────────────────────────────────────────────────────────

export async function handleChargeUpdate(req, res, { method, chargeId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWrite(actor, sendJson)) return
  if (method !== 'PATCH') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendError(sendJson, 400, 'INVALID_JSON', 'JSON inválido na requisição.')
    return
  }

  if (!body || typeof body !== 'object') {
    sendError(sendJson, 400, 'INVALID_BODY', 'Corpo da requisição inválido.')
    return
  }

  // ── Validate allowed fields ──────────────────────────────────────────────

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    sendError(
      sendJson,
      400,
      'INVALID_STATUS',
      `status deve ser um de: ${ALLOWED_STATUSES.join(', ')}.`,
    )
    return
  }

  if (body.valor_pago !== undefined) {
    const vp = Number(body.valor_pago)
    if (!Number.isFinite(vp) || vp < 0) {
      sendError(sendJson, 400, 'INVALID_VALOR_PAGO', 'valor_pago não pode ser negativo.')
      return
    }
  }

  // Build the fields object with only the keys the caller supplied.
  const ALLOWED_PATCH_KEYS = ['status', 'valor_pago', 'paid_at', 'receipt_number', 'confirmed_by', 'notes']
  const fields = {}
  for (const key of ALLOWED_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields[key] = body[key]
    }
  }

  if (Object.keys(fields).length === 0) {
    sendError(sendJson, 400, 'NO_FIELDS', 'Nenhum campo editável informado.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const updated = await updateCharge(sql, chargeId, fields)
    if (!updated) {
      sendError(sendJson, 404, 'NOT_FOUND', 'Cobrança não encontrada.')
      return
    }
    sendJson(200, { data: updated })
  } catch (err) {
    logError('patch', err, { chargeId })
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao atualizar cobrança.')
  }
}
