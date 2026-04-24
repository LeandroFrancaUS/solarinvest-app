// server/invoices/handler.js
// Handles /api/invoices routes for client invoice management (faturas).
// RBAC: read → admin|office|financeiro; write → admin|office|financeiro.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  listClientInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  registerInvoicePayment,
  getInvoiceNotificationConfig,
  upsertInvoiceNotificationConfig,
  getInvoiceNotifications,
} from './repository.js'

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
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso às faturas não permitido para este perfil.')
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
  if (!['role_admin', 'role_office', 'role_financeiro'].includes(role)) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Operação de escrita em faturas requer perfil adequado.')
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
// GET /api/invoices?client_id=:id
// List all invoices for a client
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoicesListRequest(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const url = new URL(requestUrl, 'http://localhost')
  const clientIdRaw = url.searchParams.get('client_id')
  const clientId = clientIdRaw ? parseInt(clientIdRaw, 10) : null

  if (!clientId || !Number.isFinite(clientId) || clientId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'client_id é obrigatório.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const invoices = await listClientInvoices(sql, clientId)
    sendJson(200, { data: invoices })
  } catch (err) {
    console.error('[invoices][list] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao listar faturas.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invoices
// Create a new invoice
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoicesCreateRequest(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'POST') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  const { client_id, uc, invoice_number, reference_month, due_date, amount, notes } = body || {}

  if (!client_id || !uc || !reference_month || !due_date || amount == null) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'Campos obrigatórios ausentes.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const invoice = await createInvoice(sql, {
      client_id,
      uc,
      invoice_number,
      reference_month,
      due_date,
      amount,
      notes,
    })
    sendJson(201, { data: invoice })
  } catch (err) {
    console.error('[invoices][create] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao criar fatura.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/invoices/:invoiceId
// Update an invoice
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoicesUpdateRequest(req, res, { method, invoiceId, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'PATCH') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!invoiceId || !Number.isFinite(invoiceId) || invoiceId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de fatura inválido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const invoice = await updateInvoice(sql, invoiceId, body || {})
    if (!invoice) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Fatura não encontrada.' } })
      return
    }
    sendJson(200, { data: invoice })
  } catch (err) {
    console.error('[invoices][update] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar fatura.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/invoices/:invoiceId
// Delete an invoice
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoicesDeleteRequest(req, res, { method, invoiceId, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'DELETE') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!invoiceId || !Number.isFinite(invoiceId) || invoiceId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de fatura inválido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const deleted = await deleteInvoice(sql, invoiceId)
    if (!deleted) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Fatura não encontrada.' } })
      return
    }
    sendJson(200, { data: { success: true } })
  } catch (err) {
    console.error('[invoices][delete] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao deletar fatura.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invoices/:invoiceId/payment
// Register payment for an invoice
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoicePaymentRequest(req, res, { method, invoiceId, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'POST') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  if (!invoiceId || !Number.isFinite(invoiceId) || invoiceId <= 0) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'ID de fatura inválido.' } })
    return
  }

  const { payment_status, receipt_number, transaction_number, attachment_url } = body || {}

  if (!payment_status) {
    sendJson(400, { error: { code: 'VALIDATION_ERROR', message: 'payment_status é obrigatório.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const invoice = await registerInvoicePayment(sql, invoiceId, {
      payment_status,
      receipt_number,
      transaction_number,
      attachment_url,
      confirmed_by_user_id: actor.userId,
    })
    if (!invoice) {
      sendJson(404, { error: { code: 'NOT_FOUND', message: 'Fatura não encontrada.' } })
      return
    }
    sendJson(200, { data: invoice })
  } catch (err) {
    console.error('[invoices][payment] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao registrar pagamento.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices/notifications
// Get invoice notifications (alerts for due dates)
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoiceNotificationsRequest(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const config = await getInvoiceNotificationConfig(sql, actor.userId)
    const notifications = await getInvoiceNotifications(sql, config)
    sendJson(200, { data: notifications })
  } catch (err) {
    console.error('[invoices][notifications] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar notificações.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices/notification-config
// Get notification configuration
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoiceNotificationConfigGetRequest(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  if (method !== 'GET') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const config = await getInvoiceNotificationConfig(sql, actor.userId)
    sendJson(200, { data: config })
  } catch (err) {
    console.error('[invoices][config][get] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao buscar configuração.' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invoices/notification-config
// Update notification configuration
// ─────────────────────────────────────────────────────────────────────────────
export async function handleInvoiceNotificationConfigUpdateRequest(req, res, { method, sendJson, body }) {
  const actor = await resolveActor(req)
  if (!requireWriteAccess(actor, sendJson)) return

  if (method !== 'POST') {
    sendJson(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const config = await upsertInvoiceNotificationConfig(sql, actor.userId, body || {})
    sendJson(200, { data: config })
  } catch (err) {
    console.error('[invoices][config][update] error', err)
    sendJson(500, { error: { code: 'DB_ERROR', message: 'Erro ao atualizar configuração.' } })
  }
}
