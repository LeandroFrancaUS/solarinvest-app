// server/client-portfolio/handler.js
// Handles /api/client-portfolio and /api/clients/:id/portfolio-export routes.
// RBAC: read → admin|office|financeiro; write → admin|office; comercial → denied.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  listPortfolioClients,
  getPortfolioClient,
  exportClientToPortfolio,
  removeClientFromPortfolio,
  updatePortfolioClientProfile,
  updateClientLifecycle,
  upsertClientContract,
  upsertClientProjectStatus,
  upsertClientBillingProfile,
  updateClientContractualTermByClientId,
  getBillingInstallmentsJson,
  getClientNotes,
  addClientNote,
  getPortfolioSummary,
} from './repository.js'
import { upsertClientEnergyProfile } from '../clients/repository.js'

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireReadAccess(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  const role = actorRole(actor)
  if (!['role_admin', 'role_office', 'role_financeiro'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso à Carteira de Clientes não permitido para este perfil.')
    return false
  }
  return true
}

function requireWriteAccess(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  const role = actorRole(actor)
  if (!['role_admin', 'role_office'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Operação de escrita na Carteira requer perfil admin ou office.')
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
  const rawSearch = url.searchParams.get('search')
  const search = typeof rawSearch === 'string' ? rawSearch.trim() : ''

  try {
    const sql = await getScopedSql(actor)
    const clients = await listPortfolioClients(sql, { search: search || undefined })
    sendJson(200, { data: clients })
  } catch (err) {
    console.error('[portfolio][list] error', {
      actorUserId: actor?.userId ?? null,
      actorRole: actorRole(actor),
      search,
      message: err instanceof Error ? err.message : String(err),
      code: err?.code ?? null,
      detail: err?.detail ?? null,
      hint: err?.hint ?? null,
      stack: err instanceof Error ? err.stack : undefined,
    })
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

  if (!Number.isFinite(clientId) || clientId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de cliente inválido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)

    console.info('[portfolio-export] start', {
      clientId,
      actorUserId: actor.userId,
      actorRole: actorRole(actor),
    })

    const updated = await exportClientToPortfolio(sql, clientId, actor.userId)

    if (!updated) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } })
      return
    }

    try {
      const { appendClientAuditLog } = await import('../clients/repository.js')
      await appendClientAuditLog(
        sql,
        updated.id,
        actor.userId,
        actor.email ?? null,
        'portfolio_export',
        null,
        {
          in_portfolio: true,
          portfolio_exported_at: updated.portfolio_exported_at,
          portfolio_exported_by_user_id: updated.portfolio_exported_by_user_id,
        },
        'Client exported to portfolio',
        null,
      )
    } catch (auditErr) {
      console.warn('[portfolio] audit log failed (non-fatal)', auditErr?.message)
    }

    console.info('[portfolio-export] success', {
      clientId: updated.id,
      actorUserId: actor.userId,
    })

    sendJson(200, { ok: true, data: updated })
  } catch (err) {
    console.error('[portfolio-export] failed', {
      clientId,
      actorUserId: actor?.userId ?? null,
      actorRole: actorRole(actor),
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      code: err?.code ?? null,
      detail: err?.detail ?? null,
      hint: err?.hint ?? null,
    })
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Não foi possível ativar o cliente.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/client-portfolio/:clientId/profile
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioProfilePatch(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)

    // Update core client fields (client_name, term_months, system_kwp, etc.) on the clients table.
    const profileResult = await updatePortfolioClientProfile(sql, clientId, body)
    if (!profileResult) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado na carteira.' } })
      return
    }

    // Also update lifecycle fields if any are present in the body (table is optional — ignore null result).
    if (body.lifecycle_status != null || body.onboarding_status != null || body.is_active_portfolio_client != null) {
      await updateClientLifecycle(sql, clientId, body).catch(() => {
        // client_lifecycle table may not exist in all environments; non-fatal.
      })
    }

    sendJson(200, { data: profileResult })
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

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const result = await upsertClientContract(sql, clientId, body)
    if (result === null && body.id) {
      // UPDATE matched no rows — the contract_id is stale or belongs to a different client
      sendJson(404, { error: { code: 'CONTRACT_NOT_FOUND', message: 'Contrato não encontrado para este cliente.' } })
      return
    }

    // Keep "prazo" synchronized between Contrato and Plano sources.
    // Whenever contractual_term_months is updated in client_contracts, mirror it to
    // client_energy_profile.prazo_meses for the same client.
    const hasContractTerm = Object.prototype.hasOwnProperty.call(body ?? {}, 'contractual_term_months')
    if (hasContractTerm) {
      const rawTerm = body?.contractual_term_months
      const normalizedTerm = rawTerm === undefined || rawTerm === null || rawTerm === ''
        ? null
        : Math.trunc(Number(rawTerm))
      if (normalizedTerm == null || Number.isFinite(normalizedTerm)) {
        await upsertClientEnergyProfile(sql, clientId, { prazo_meses: normalizedTerm })
      }
    }

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

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const result = await upsertClientProjectStatus(sql, clientId, body)
    sendJson(200, { data: result })
  } catch (err) {
    if (err?.code === 'ART_REQUIRES_ENGINEER') {
      sendJson(422, { error: { code: 'ART_REQUIRES_ENGINEER', message: err.message } })
      return
    }
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

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  try {
    // Validate installment_payment sub-object if present
    if (body.installment_payment) {
      const payment = body.installment_payment
      // Accept both 'pago' (legacy) and 'confirmado' (new) as paid statuses
      const isPaidStatus = payment.status === 'pago' || payment.status === 'confirmado'
      if (isPaidStatus) {
        const hasProof = (payment.receipt_number && String(payment.receipt_number).trim()) ||
                         (payment.transaction_number && String(payment.transaction_number).trim()) ||
                         (payment.attachment_url && String(payment.attachment_url).trim())
        if (!hasProof) {
          sendJson(400, { error: { code: 'PROOF_REQUIRED', message: 'Informe o número do comprovante ou da transação para registrar o pagamento.' } })
          return
        }
        // Normalise to canonical 'confirmado'
        payment.status = 'confirmado'
      }
      // Admin-only for editing a confirmed installment
      if (payment.is_confirmed_edit) {
        const role = actorRole(actor)
        if (role !== 'role_admin') {
          sendJson(403, { error: { code: 'ADMIN_ONLY', message: 'Apenas administradores podem editar parcelas já confirmadas.' } })
          return
        }
      }
    }

    const sql = await getScopedSql(actor)

    // ── installment_payment merge ────────────────────────────────────────────
    // When the body carries an installment_payment object, we need to merge it
    // into the installments_json array atomically.  We fetch the current array
    // first (cheap single-row SELECT), replace the entry with the matching
    // installment number (or append it when it doesn't exist yet), and pass
    // the resulting array as fields.installments_json so the upsert writes it.
    if (body.installment_payment) {
      const payment = body.installment_payment
      console.info('[portfolio][billing] installment_payment merge', {
        clientId,
        installmentNumber: payment.number,
        status: payment.status,
        receipt_number: payment.receipt_number ?? null,
        transaction_number: payment.transaction_number ?? null,
      })

      const existing = await getBillingInstallmentsJson(sql, clientId)
      const merged = existing.filter((p) => p.number !== payment.number)
      merged.push(payment)
      merged.sort((a, b) => a.number - b.number)
      body.installments_json = merged

      console.info('[portfolio][billing] installments_json after merge', {
        clientId,
        totalInstallments: merged.length,
        confirmedCount: merged.filter((p) => p.status === 'confirmado').length,
      })
    }

    const result = await upsertClientBillingProfile(sql, clientId, body)

    console.info('[portfolio][billing] upsert result', {
      clientId,
      rowId: result?.id ?? null,
      installmentsCount: Array.isArray(result?.installments_json) ? result.installments_json.length : null,
      updatedAt: result?.updated_at ?? null,
    })

    sendJson(200, { data: result })
  } catch (err) {
    console.error('[portfolio] billing patch error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar cobrança.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/client-portfolio/:clientId/plan
// Persists energy profile / leasing plan fields into client_energy_profile.
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioPlanPatch(req, res, { method, clientId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const parseNullableNumber = (value) => {
    if (value === undefined || value === null || value === '') return null
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string') return null

    const trimmed = value.trim()
    if (!trimmed) return null

    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const parseNullableInteger = (value) => {
    const parsed = parseNullableNumber(value)
    return parsed === null ? null : Math.trunc(parsed)
  }

  const parseNullableText = (value) => {
    if (value === undefined || value === null) return null
    const text = String(value).trim()
    return text ? text : null
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const profile = {
      kwh_contratado: parseNullableNumber(body.kwh_contratado ?? body.kwh_mes_contratado),
      potencia_kwp: parseNullableNumber(body.potencia_kwp),
      tipo_rede: parseNullableText(body.tipo_rede),
      tarifa_atual: parseNullableNumber(body.tarifa_atual),
      desconto_percentual: parseNullableNumber(body.desconto_percentual),
      mensalidade: parseNullableNumber(body.mensalidade ?? body.valor_mensalidade),
      indicacao: parseNullableText(body.indicacao),
      modalidade: parseNullableText(body.modalidade),
      prazo_meses: parseNullableInteger(body.prazo_meses),
      marca_inversor: parseNullableText(body.marca_inversor),
    }

    console.info('[portfolio][plan] request', {
      clientId,
      rawBody: body,
      normalizedProfile: profile,
      actorUserId: actor?.userId ?? null,
      actorRole: actorRole(actor),
    })

    const result = await upsertClientEnergyProfile(sql, clientId, profile)

    // Keep "prazo" synchronized between Plano and Contrato sources.
    // IMPORTANT: update existing contract rows in-place (by client_id) so we
    // don't create a new contract row and break project.contract_id linkage.
    // Whenever prazo_meses is updated in client_energy_profile, mirror it to
    // client_contracts.contractual_term_months for the same client.
    const hasPlanTerm = Object.prototype.hasOwnProperty.call(body ?? {}, 'prazo_meses')
    if (hasPlanTerm) {
      await updateClientContractualTermByClientId(sql, clientId, profile.prazo_meses)
      await upsertClientContract(sql, clientId, {
        contractual_term_months: profile.prazo_meses,
      })
    }

    console.info('[portfolio][plan] success', {
      clientId,
      result,
    })

    sendJson(200, { data: result })
  } catch (err) {
    console.error('[portfolio] plan patch error', {
      clientId,
      rawBody: body,
      code: err?.code ?? null,
      detail: err?.detail ?? null,
      hint: err?.hint ?? null,
      constraint: err?.constraint ?? null,
      table: err?.table ?? null,
      column: err?.column ?? null,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })

    sendJson(500, {
      error: {
        code: 'DB_ERROR',
        message: 'Erro ao atualizar plano.',
        detail: err?.message ?? 'unknown_error',
      },
    })
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

    let body
    try {
      body = await readJsonBody(req)
    } catch {
      sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
      return
    }

    if (!body?.content) {
      sendJson(400, { error: { code: 'INVALID_INPUT', message: 'content é obrigatório.' } })
      return
    }

    try {
      const sql = await getScopedSql(actor)
      const note = await addClientNote(sql, clientId, {
        ...body,
        created_by_user_id: actor.userId,
        created_by_name: actor.displayName ?? actor.email ?? null,
      })
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
// PATCH /api/clients/:clientId/portfolio-remove
// Removes a client from the portfolio (sets in_portfolio = false).
// Does NOT delete the client from the system.
// RBAC: write access required (admin|office). financeiro → read-only. comercial → denied.
// ─────────────────────────────────────────────────────────────────────────────
export async function handlePortfolioRemoveRequest(req, res, { method, clientId, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!Number.isFinite(clientId) || clientId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de cliente inválido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)

    console.info('[portfolio-remove] start', {
      clientId,
      actorUserId: actor.userId,
      actorRole: actorRole(actor),
    })

    const updated = await removeClientFromPortfolio(sql, clientId)

    if (!updated) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } })
      return
    }

    try {
      const { appendClientAuditLog } = await import('../clients/repository.js')
      await appendClientAuditLog(
        sql,
        updated.id,
        actor.userId,
        actor.email ?? null,
        'portfolio_remove',
        null,
        { in_portfolio: false },
        'Client removed from portfolio',
        null,
      )
    } catch (auditErr) {
      console.warn('[portfolio-remove] audit log failed (non-fatal)', auditErr?.message)
    }

    console.info('[portfolio-remove] success', {
      clientId: updated.id,
      actorUserId: actor.userId,
    })

    sendJson(200, { ok: true, data: updated })
  } catch (err) {
    console.error('[portfolio-remove] failed', {
      clientId,
      actorUserId: actor?.userId ?? null,
      actorRole: actorRole(actor),
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      code: err?.code ?? null,
      detail: err?.detail ?? null,
      hint: err?.hint ?? null,
    })
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao remover cliente da carteira.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/portfolio/summary
// ─────────────────────────────────────────────────────────────────────────────
export async function handleDashboardPortfolioSummary(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const db = getDatabaseClient()
    const summary = await getPortfolioSummary(db.sql)
    sendJson(200, { data: summary })
  } catch (err) {
    console.error('[portfolio] dashboard summary error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar resumo da carteira.' } })
  }
}
