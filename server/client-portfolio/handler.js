// server/client-portfolio/handler.js
// Handles /api/client-portfolio and /api/clients/:id/portfolio-export routes.
// RBAC: read → admin|office|financeiro; write → admin|office; comercial → denied.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { appendClientAuditLog } from '../clients/repository.js'
import {
  listPortfolioClients,
  getPortfolioClient,
  exportClientToPortfolio,
  updateClientLifecycle,
  upsertClientContract,
  upsertClientProjectStatus,
  upsertClientBillingProfile,
  getClientNotes,
  addClientNote,
  getPortfolioSummary,
} from './repository.js'

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireReadAccess(actor, sendJson) {
  if (!actor) { sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.'); return false }
  const role = actorRole(actor)
  if (!['role_admin', 'role_office', 'role_financeiro'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso à Carteira de Clientes não permitido para este perfil.')
    return false
  }
  return true
}

function requireWriteAccess(actor, sendJson) {
  if (!actor) { sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.'); return false }
  const role = actorRole(actor)
  if (!['role_admin', 'role_office'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Operação de escrita na Carteira requer perfil admin ou office.')
    return false
  }
  return true
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  const role = actorRole(actor)
  return createUserScopedSql(db.sql, { userId: actor.userId, role })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/client-portfolio
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioListRequest(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  const search = url.searchParams.get('search') ?? undefined

  try {
    const sql = await getScopedSql(actor)
    const clients = await listPortfolioClients(sql, { search })
    sendJson(200, { data: clients })
  } catch (err) {
    console.error('[portfolio] list error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar carteira.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/client-portfolio/:clientId
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioGetRequest(req, res, { method, clientId, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const client = await getPortfolioClient(sql, clientId)
    if (!client) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado na carteira.' } })
      return
    }
    sendJson(200, { data: client })
  } catch (err) {
    console.error('[portfolio] get error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar cliente da carteira.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/clients/:clientId/portfolio-export
// Marks a client as exported/converted to Carteira de Clientes (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioExportRequest(req, res, { method, clientId, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const db = getDatabaseClient()
    // Use service-bypass sql for the lifecycle upsert (no owner check — admin/office already verified)
    const lifecycle = await exportClientToPortfolio(db.sql, clientId, actor.userId)

    // Audit log the operation
    const role = actorRole(actor)
    const scopedSql = createUserScopedSql(db.sql, { userId: actor.userId, role })
    try {
      await appendClientAuditLog(
        scopedSql,
        clientId,
        actor.userId,
        actor.email ?? null,
        'portfolio_export',
        null,
        { lifecycle_status: lifecycle.lifecycle_status, exported_to_portfolio_at: lifecycle.exported_to_portfolio_at },
      )
    } catch (auditErr) {
      console.warn('[portfolio] audit log failed (non-fatal)', auditErr?.message)
    }

    sendJson(200, { data: lifecycle })
  } catch (err) {
    console.error('[portfolio] export error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao exportar cliente para a carteira.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/client-portfolio/:clientId/profile
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioProfilePatch(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, {}); return }

  const body = await readJsonBody()
  try {
    const sql = await getScopedSql(actor)
    const result = await updateClientLifecycle(sql, clientId, body)
    if (!result) { sendJson(404, { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado na carteira.' } }); return }
    sendJson(200, { data: result })
  } catch (err) {
    console.error('[portfolio] profile patch error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar perfil.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/client-portfolio/:clientId/contract
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioContractPatch(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, {}); return }

  const body = await readJsonBody()
  try {
    const sql = await getScopedSql(actor)
    const result = await upsertClientContract(sql, clientId, body)
    sendJson(200, { data: result })
  } catch (err) {
    console.error('[portfolio] contract patch error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar contrato.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/client-portfolio/:clientId/project
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioProjectPatch(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, {}); return }

  const body = await readJsonBody()
  try {
    const sql = await getScopedSql(actor)
    const result = await upsertClientProjectStatus(sql, clientId, body)
    sendJson(200, { data: result })
  } catch (err) {
    console.error('[portfolio] project patch error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar projeto.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/client-portfolio/:clientId/billing
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioBillingPatch(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return
  if (method !== 'PATCH') { sendJson(405, {}); return }

  const body = await readJsonBody()
  try {
    const sql = await getScopedSql(actor)
    const result = await upsertClientBillingProfile(sql, clientId, body)
    sendJson(200, { data: result })
  } catch (err) {
    console.error('[portfolio] billing patch error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar cobrança.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/client-portfolio/:clientId/notes
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioNotesRequest(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method === 'GET') {
    try {
      const sql = await getScopedSql(actor)
      const notes = await getClientNotes(sql, clientId)
      sendJson(200, { data: notes })
    } catch (err) {
      console.error('[portfolio] notes get error', err)
      sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar notas.' } })
    }
    return
  }

  if (method === 'POST') {
    if (!requireWriteAccess(actor, sendJson)) return
    const body = await readJsonBody()
    if (!body?.content) { sendJson(400, { error: { code: 'INVALID_INPUT', message: 'content é obrigatório.' } }); return }
    try {
      const sql = await getScopedSql(actor)
      const note = await addClientNote(sql, clientId, { ...body, created_by_user_id: actor.userId })
      sendJson(201, { data: note })
    } catch (err) {
      console.error('[portfolio] notes post error', err)
      sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao salvar nota.' } })
    }
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/portfolio/summary
// ─────────────────────────────────────────────────────────────────────────────
export async function handleDashboardPortfolioSummary(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return
  if (method !== 'GET') { sendJson(405, {}); return }

  try {
    const db = getDatabaseClient()
    // Summary uses service-bypass for aggregation (caller role already verified)
    const summary = await getPortfolioSummary(db.sql)
    sendJson(200, { data: summary })
  } catch (err) {
    console.error('[portfolio] dashboard summary error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar resumo da carteira.' } })
  }
}
