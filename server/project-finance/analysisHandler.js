// server/project-finance/analysisHandler.js
// Handles:
//   GET  /api/projects/:id/financial-analysis  — load AF snapshot
//   PUT  /api/projects/:id/financial-analysis  — save AF snapshot
//
// These endpoints serve the Análise Financeira in embedded mode (inside the
// Central de Projetos).  They persist the full inputs/outputs JSON payload
// without recalculating anything on the backend.
//
// RBAC: read  → admin | office | financeiro
//       write → admin | office

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import {
  findProjectFinanceAnalysis,
  upsertProjectFinanceAnalysis,
  resolveProjectContract,
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
    sendError(sendJson, 403, 'FORBIDDEN', 'Acesso à Análise Financeira do Projeto não permitido para este perfil.')
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
    sendError(sendJson, 403, 'FORBIDDEN', 'Salvar Análise Financeira do Projeto requer perfil admin ou office.')
    return false
  }
  return true
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  if (!db?.sql) {
    const err = new Error('Database client not available or not configured')
    err.statusCode = 503
    throw err
  }
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}

/**
 * Derives locked_project_type ('leasing' | 'venda') from the project row and
 * contract.  project_type on the projects row is the authoritative source;
 * the contract can refine it ('sale' | 'buyout' → 'venda').
 * Falls back to 'leasing' as the default when neither source specifies a type,
 * matching the default used across the billing and financial engines.
 */
function deriveLockedProjectType(project, contract) {
  const raw = contract?.contract_type ?? project?.project_type ?? 'leasing'
  if (raw === 'venda' || raw === 'sale' || raw === 'buyout') return 'venda'
  return 'leasing'
}

function logError(scope, err, extra = {}) {
  console.error(`[project-finance/analysis][${scope}] error`, {
    ...extra,
    code: err?.code ?? null,
    message: err instanceof Error ? err.message : String(err),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/projects/:id/financial-analysis
// PUT  /api/projects/:id/financial-analysis
// ─────────────────────────────────────────────────────────────────────────────

export async function handleProjectFinanceAnalysis(req, res, { method, projectId, readJsonBody, sendJson }) {
  const actor = await resolveActor(req)

  // ── GET ──────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    if (!requireRead(actor, sendJson)) return
    try {
      const sql = await getScopedSql(actor)

      const project = await findProjectById(sql, projectId)
      if (!project) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
        return
      }

      const contract = await resolveProjectContract(sql, projectId)
      const lockedProjectType = deriveLockedProjectType(project, contract)

      // snapshot row — may be null when no AF has been saved yet
      const snapshot = await findProjectFinanceAnalysis(sql, projectId)

      sendJson(200, {
        data: {
          project_id: projectId,
          project_type: project.project_type ?? null,
          analysis_mode: 'embedded',
          locked_project_type: lockedProjectType,
          inputs_json: snapshot?.inputs_json ?? null,
          outputs_json: snapshot?.outputs_json ?? null,
          updated_at: snapshot?.updated_at ?? null,
        },
      })
    } catch (err) {
      logError('get', err, { projectId })
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao carregar Análise Financeira do projeto.')
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

    try {
      const sql = await getScopedSql(actor)

      const project = await findProjectById(sql, projectId)
      if (!project) {
        sendError(sendJson, 404, 'NOT_FOUND', 'Projeto não encontrado.')
        return
      }

      const contract = await resolveProjectContract(sql, projectId)
      const lockedProjectType = deriveLockedProjectType(project, contract)

      const saved = await upsertProjectFinanceAnalysis(
        sql,
        projectId,
        {
          inputs_json:  body.inputs_json  ?? null,
          outputs_json: body.outputs_json ?? null,
        },
        actor?.userId ?? null,
      )

      if (!saved) {
        sendError(sendJson, 500, 'UPSERT_FAILED', 'Não foi possível salvar a Análise Financeira.')
        return
      }

      sendJson(200, {
        ok: true,
        data: {
          project_id: projectId,
          project_type: project.project_type ?? null,
          analysis_mode: 'embedded',
          locked_project_type: lockedProjectType,
          inputs_json: saved.inputs_json ?? null,
          outputs_json: saved.outputs_json ?? null,
          updated_at: saved.updated_at ?? null,
        },
      })
    } catch (err) {
      logError('put', err, { projectId })
      sendError(sendJson, 500, 'DB_ERROR', 'Erro ao salvar Análise Financeira do projeto.')
    }
    return
  }

  sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
}
