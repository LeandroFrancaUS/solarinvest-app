// server/project-finance/handler.js
// Handles:
//   GET  /api/projects/:id/finance  — load financial profile
//   PUT  /api/projects/:id/finance  — create/update financial profile
//
// RBAC: read  → admin | office | financeiro
//       write → admin | office

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  findProjectFinanceByProjectId,
  resolveProjectContractType,
  upsertProjectFinance,
} from './repository.js'
import { findProjectById } from '../projects/repository.js'

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers
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
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso ao Financeiro do Projeto não permitido para este perfil.')
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
    sendError(sendJson, 403, 'FORBIDDEN', 'Edição do Financeiro do Projeto requer perfil admin ou office.')
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
  console.error(`[project-finance][${scope}] error`, {
    ...extra,
    code: err?.code ?? null,
    message: err instanceof Error ? err.message : String(err),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/projects/:id/finance
// PUT  /api/projects/:id/finance
// ─────────────────────────────────────────────────────────────────────────────

export async function handleProjectFinance(req, res, { method, projectId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)

  // ── GET ──────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    if (!requireRead(actor, sendJson)) return
    try {
      const sql = await getScopedSql(actor)

      // Verify the project exists and is accessible.
      const project = await findProjectById(sql, projectId)
      if (!project) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
        return
      }

      const profile = await findProjectFinanceByProjectId(sql, projectId)
      const resolvedContractType = await resolveProjectContractType(sql, projectId)

      sendJson(200, {
        data: {
          profile,
          contract_type: resolvedContractType ?? project.project_type ?? 'leasing',
          project_id: projectId,
        },
      })
    } catch (err) {
      logError('get', err, { projectId })
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao carregar financeiro do projeto.')
    }
    return
  }

  // ── PUT ──────────────────────────────────────────────────────────────────
  if (method === 'PUT') {
    if (!requireWrite(actor, sendJson)) return

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

    // Validate contract_type
    if (body.contract_type && !['leasing', 'venda'].includes(body.contract_type)) {
      sendError(sendJson, 400, 'INVALID_CONTRACT_TYPE', 'contract_type deve ser "leasing" ou "venda".')
      return
    }

    try {
      const sql = await getScopedSql(actor)

      // Verify project exists (RLS also enforces this).
      const project = await findProjectById(sql, projectId)
      if (!project) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
        return
      }

      // If contract_type is not provided in body, resolve from contract/project.
      let contract_type = body.contract_type
      if (!contract_type) {
        contract_type = await resolveProjectContractType(sql, projectId)
        contract_type = contract_type ?? project.project_type ?? 'leasing'
      }

      const profile = await upsertProjectFinance(
        sql,
        projectId,
        {
          ...body,
          contract_type,
          client_id: body.client_id ?? project.client_id,
        },
        actor?.userId ?? null,
      )

      sendJson(200, {
        ok: true,
        data: profile,
        contract_type,
        project_id: projectId,
      })
    } catch (err) {
      logError('put', err, { projectId })
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao salvar financeiro do projeto.')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
}
