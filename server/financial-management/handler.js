// server/financial-management/handler.js
// Handles /api/financial-management/* routes.
// RBAC: requires page_financial_management permission (or role_admin).

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  listFinancialCategories,
  listFinancialEntries,
  getFinancialEntryById,
  createFinancialEntry,
  updateFinancialEntry,
  deleteFinancialEntry,
  getFinancialSummary,
  listFinancialProjects,
  getFinancialCashflow,
} from './repository.js'
import {
  listFinancialItemTemplates,
  createFinancialItemTemplate,
  updateFinancialItemTemplate,
  listProjectFinancialItems,
  createProjectFinancialItem,
  updateProjectFinancialItem,
  deleteProjectFinancialItem,
  bootstrapProjectFinancialStructure,
  listReceivablePlans,
  createReceivablePlan,
  listFinancialProjectSummaries,
  getFinancialProjectDetail,
} from './operationalRepository.js'

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['role_admin']
const ALLOWED_PERMISSION = 'page_financial_management'

function requireAccess(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' } })
    return false
  }

  const role = actorRole(actor)

  // Admin always has access
  if (ALLOWED_ROLES.includes(role)) return true

  // Check page_financial_management permission
  const perms = actor.permissions ?? []
  if (perms.includes(ALLOWED_PERMISSION) || perms.includes('page:financial_management')) {
    return true
  }

  sendJson(403, {
    error: {
      code: 'FORBIDDEN',
      message: 'Acesso à Gestão Financeira requer a permissão page_financial_management.',
    },
  })
  return false
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  if (!db?.sql) {
    const err = new Error('Database not configured')
    err.statusCode = 503
    throw err
  }
  const role = actorRole(actor)
  return createUserScopedSql(db.sql, { userId: actor.userId, role })
}

function getUserId(actor) {
  return actor?.userId ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/summary
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialSummary(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await getFinancialSummary(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/projects
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialProjects(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await listFinancialProjects(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/cashflow
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialCashflow(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await getFinancialCashflow(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/financial-management/entries
// GET/PUT/DELETE /api/financial-management/entries/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialEntries(req, res, { method, sendJson, requestUrl, body }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const pathParts = url.pathname.replace('/api/financial-management/entries', '').split('/').filter(Boolean)
  const entryId = pathParts[0] ?? null

  // ── List entries ──────────────────────────────────────────────────────────
  if (method === 'GET' && !entryId) {
    const from = url.searchParams.get('from') ?? undefined
    const to = url.searchParams.get('to') ?? undefined
    const proposalId = url.searchParams.get('proposal_id') ?? undefined
    const clientId = url.searchParams.get('client_id') ?? undefined
    const entryType = url.searchParams.get('entry_type') ?? undefined
    const projectKind = url.searchParams.get('project_kind') ?? undefined
    const data = await listFinancialEntries(sql, {
      from,
      to,
      proposalId,
      clientId,
      entryType,
      projectKind,
    })
    sendJson(200, { data })
    return
  }

  // ── Get single entry ──────────────────────────────────────────────────────
  if (method === 'GET' && entryId) {
    const row = await getFinancialEntryById(sql, entryId)
    if (!row) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } })
      return
    }
    sendJson(200, { data: row })
    return
  }

  // ── Create entry ──────────────────────────────────────────────────────────
  if (method === 'POST' && !entryId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    if (!body.entry_type || !['income', 'expense'].includes(body.entry_type)) {
      sendJson(400, { error: { code: 'INVALID_ENTRY_TYPE', message: 'entry_type deve ser "income" ou "expense".' } })
      return
    }
    if (body.amount == null || isNaN(parseFloat(String(body.amount)))) {
      sendJson(400, { error: { code: 'INVALID_AMOUNT', message: 'amount deve ser um número válido.' } })
      return
    }
    const data = await createFinancialEntry(sql, body, getUserId(actor))
    sendJson(201, { data })
    return
  }

  // ── Update entry ──────────────────────────────────────────────────────────
  if (method === 'PUT' && entryId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    const updated = await updateFinancialEntry(sql, entryId, body, getUserId(actor))
    if (!updated) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } })
      return
    }
    sendJson(200, { data: updated })
    return
  }

  // ── Delete entry ──────────────────────────────────────────────────────────
  if (method === 'DELETE' && entryId) {
    const deleted = await deleteFinancialEntry(sql, entryId, getUserId(actor))
    if (!deleted) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } })
      return
    }
    sendJson(204, null)
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/categories
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialCategories(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const data = await listFinancialCategories(sql)
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/financial-management/dashboard-feed
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialDashboardFeed(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const data = await getFinancialSummary(sql, { from, to })
  sendJson(200, { data })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST/PUT /api/financial-management/templates
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialItemTemplates(req, res, { method, sendJson, requestUrl, body }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const pathParts = url.pathname.replace('/api/financial-management/templates', '').split('/').filter(Boolean)
  const templateId = pathParts[0] ?? null

  if (method === 'GET' && !templateId) {
    const nature = url.searchParams.get('nature') ?? undefined
    const projectKind = url.searchParams.get('project_kind') ?? undefined
    const scope = url.searchParams.get('scope') ?? undefined
    const data = await listFinancialItemTemplates(sql, { nature, projectKind, scope })
    sendJson(200, { data })
    return
  }

  if (method === 'POST' && !templateId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    try {
      const data = await createFinancialItemTemplate(sql, body, getUserId(actor))
      sendJson(201, { data })
    } catch (err) {
      const status = err?.statusCode ?? 500
      sendJson(status, { error: { code: 'CREATE_FAILED', message: err?.message ?? 'Erro ao criar template.' } })
    }
    return
  }

  if (method === 'PUT' && templateId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    try {
      const data = await updateFinancialItemTemplate(sql, templateId, body, getUserId(actor))
      if (!data) {
        sendJson(404, { error: { code: 'NOT_FOUND', message: 'Template não encontrado.' } })
        return
      }
      sendJson(200, { data })
    } catch (err) {
      const status = err?.statusCode ?? 500
      sendJson(status, { error: { code: 'UPDATE_FAILED', message: err?.message ?? 'Erro ao atualizar template.' } })
    }
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST/PUT/DELETE /api/financial-management/project-items
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialProjectItems(req, res, { method, sendJson, requestUrl, body }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  const pathParts = url.pathname.replace('/api/financial-management/project-items', '').split('/').filter(Boolean)
  const itemId = pathParts[0] ?? null

  if (method === 'GET' && !itemId) {
    const proposalId = url.searchParams.get('proposal_id') ?? undefined
    const clientId = url.searchParams.get('client_id') ?? undefined
    const projectKind = url.searchParams.get('project_kind') ?? undefined
    const data = await listProjectFinancialItems(sql, { proposalId, clientId, projectKind })
    sendJson(200, { data })
    return
  }

  if (method === 'POST' && !itemId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    try {
      const data = await createProjectFinancialItem(sql, body, getUserId(actor))
      sendJson(201, { data })
    } catch (err) {
      const status = err?.statusCode ?? 500
      sendJson(status, { error: { code: 'CREATE_FAILED', message: err?.message ?? 'Erro ao criar item.' } })
    }
    return
  }

  if (method === 'PUT' && itemId) {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    try {
      const data = await updateProjectFinancialItem(sql, itemId, body, getUserId(actor))
      if (!data) {
        sendJson(404, { error: { code: 'NOT_FOUND', message: 'Item não encontrado.' } })
        return
      }
      sendJson(200, { data })
    } catch (err) {
      const status = err?.statusCode ?? 500
      sendJson(status, { error: { code: 'UPDATE_FAILED', message: err?.message ?? 'Erro ao atualizar item.' } })
    }
    return
  }

  if (method === 'DELETE' && itemId) {
    const deleted = await deleteProjectFinancialItem(sql, itemId, getUserId(actor))
    if (!deleted) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Item não encontrado.' } })
      return
    }
    sendJson(204, null)
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/financial-management/projects/:proposalId/bootstrap-structure
// ─────────────────────────────────────────────────────────────────────────────

export async function handleBootstrapProjectStructure(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  if (method !== 'POST') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')
  // path = /api/financial-management/projects/:id/bootstrap-structure
  const match = url.pathname.match(/\/api\/financial-management\/projects\/([^/]+)\/bootstrap-structure$/)
  const proposalId = match?.[1] ?? null
  if (!proposalId) {
    sendJson(400, { error: { code: 'INVALID_PATH', message: 'proposalId ausente na URL.' } })
    return
  }

  try {
    const data = await bootstrapProjectFinancialStructure(sql, proposalId, getUserId(actor))
    sendJson(200, { data })
  } catch (err) {
    const status = err?.statusCode ?? 500
    console.error('[financial][bootstrap] error', err)
    sendJson(status, { error: { code: 'BOOTSTRAP_FAILED', message: err?.message ?? 'Erro ao gerar estrutura.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/financial-management/receivable-plans
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialReceivablePlans(req, res, { method, sendJson, requestUrl, body }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return

  const sql = await getScopedSql(actor)
  const url = new URL(requestUrl, 'http://localhost')

  if (method === 'GET') {
    const proposalId = url.searchParams.get('proposal_id') ?? undefined
    const clientId = url.searchParams.get('client_id') ?? undefined
    const data = await listReceivablePlans(sql, { proposalId, clientId })
    sendJson(200, { data })
    return
  }

  if (method === 'POST') {
    if (!body || typeof body !== 'object') {
      sendJson(400, { error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' } })
      return
    }
    try {
      const data = await createReceivablePlan(sql, body, getUserId(actor))
      sendJson(201, { data })
    } catch (err) {
      const status = err?.statusCode ?? 500
      sendJson(status, { error: { code: 'CREATE_FAILED', message: err?.message ?? 'Erro ao criar plano.' } })
    }
    return
  }

  sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Summaries — aggregate view per proposal_id
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialProjectSummaries(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return
  const sql = await getScopedSql(actor)

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  const projectKind = url.searchParams.get('project_kind') ?? undefined
  const status = url.searchParams.get('status') ?? undefined

  try {
    const data = await listFinancialProjectSummaries(sql, { projectKind, status })
    sendJson(200, { data })
  } catch (err) {
    console.error('[financial][project-summaries] handler error', err)
    sendJson(500, { error: { code: 'QUERY_FAILED', message: err?.message ?? 'Erro ao listar projetos.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Detail — proposal metadata + all financial items
// ─────────────────────────────────────────────────────────────────────────────

export async function handleFinancialProjectDetail(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireAccess(actor, sendJson)) return
  const sql = await getScopedSql(actor)

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  // Match /api/financial-management/projects/:proposalId (no trailing path segment)
  const match = url.pathname.match(/\/api\/financial-management\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/)
  const proposalId = match?.[1] ?? null

  if (!proposalId) {
    sendJson(400, { error: { code: 'INVALID_PROPOSAL_ID', message: 'ID de proposta ausente ou inválido.' } })
    return
  }

  try {
    const data = await getFinancialProjectDetail(sql, proposalId)
    if (!data) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Projeto não encontrado.' } })
      return
    }
    sendJson(200, { data })
  } catch (err) {
    console.error('[financial][project-detail] handler error', err)
    sendJson(500, { error: { code: 'QUERY_FAILED', message: err?.message ?? 'Erro ao carregar projeto.' } })
  }
}
