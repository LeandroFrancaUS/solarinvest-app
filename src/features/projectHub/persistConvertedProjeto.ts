// src/features/projectHub/persistConvertedProjeto.ts
// Orchestration layer: builds a Projeto from an AnaliseFinanceira result and
// persists it to the backend, returning a Projeto whose `id` is the real UUID
// assigned by the database.
//
// Design principles:
//   • convertAnaliseToProjeto stays pure (no I/O) — this file owns all side effects.
//   • client_id is required for backend persistence. When absent, the function
//     returns the locally-generated Projeto unchanged and sets persisted=false.
//   • analise_id acts as an idempotency key: repeated calls with the same key
//     will return the existing backend project instead of creating a duplicate.

import { convertAnaliseToProjeto } from './convertAnaliseToProjeto'
import { createProjectFromAnalise } from './projectsApi'
import type { Projeto } from './useProjectStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PersistConvertedProjetoParams {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  tipo: 'venda' | 'leasing'
  clienteNome?: string
  consultorNome?: string
  consultorId?: string
  pagamentoModalidade?: 'avista' | 'parcelado'
  /**
   * Backend client id. When present the project is persisted to the backend
   * and the returned Projeto.id will be the real UUID from the database.
   * When absent, the project is created locally only.
   */
  clientId?: number
  /**
   * Stable identifier for this analise run (idempotency key).
   * Recommended: generate once with crypto.randomUUID() per analise session
   * and reuse across retries so that repeated conversions don't create
   * duplicate projects.
   */
  analiseId?: string
}

export interface PersistConvertedProjetoResult {
  projeto: Projeto
  /** True when the project was successfully persisted to the backend. */
  persisted: boolean
  /**
   * True when the backend returned an already-existing project rather than
   * creating a new one (idempotent replay). Only relevant when persisted=true.
   */
  alreadyExisted: boolean
  /**
   * Non-fatal warning message when backend persistence was skipped because
   * client_id was not available. The caller should surface this to the user.
   */
  warning?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an AnaliseFinanceira result into a Projeto and persists it to the
 * backend when a clientId is provided.
 *
 * Backend persistence:
 *   • Calls POST /api/projects/from-analise with the minimal snapshot.
 *   • On success the returned Projeto.id is the real UUID assigned by the DB,
 *     which makes ProjectChargesTab able to load and generate charges for it.
 *
 * Graceful degradation:
 *   • When clientId is absent, the function returns the locally-built Projeto
 *     (with a generated id) and sets persisted=false + warning. The caller
 *     should inform the user that billing features will not work until the
 *     project is linked to a backend client.
 *
 * convertAnaliseToProjeto is intentionally NOT modified — it remains pure.
 */
export async function persistConvertedProjeto(
  params: PersistConvertedProjetoParams,
): Promise<PersistConvertedProjetoResult> {
  const {
    analiseFinanceiraResult,
    tipo,
    clienteNome,
    consultorNome,
    consultorId,
    pagamentoModalidade,
    clientId,
    analiseId,
  } = params

  const projetoLocal = convertAnaliseToProjeto({
    analiseFinanceiraResult,
    tipo,
    clienteNome,
    consultorNome,
    consultorId,
    pagamentoModalidade,
  })

  if (projetoLocal === null) {
    throw new Error('Análise Financeira incompleta — não é possível converter em projeto.')
  }

  if (clientId == null || !Number.isFinite(clientId) || clientId <= 0) {
    return {
      projeto: projetoLocal,
      persisted: false,
      alreadyExisted: false,
      warning:
        'Projeto criado localmente. Para habilitar cobranças é necessário vincular a um cliente no backend (client_id ausente).',
    }
  }

  const { project, created } = await createProjectFromAnalise({
    client_id: clientId,
    project_type: tipo,
    analise_id: analiseId,
    client_name: clienteNome,
  })

  const projetoPersistido: Projeto = {
    ...projetoLocal,
    // Replace the locally-generated id with the real backend UUID so that
    // ProjectChargesTab and other backend-aware features work correctly.
    id: project.id,
  }

  return {
    projeto: projetoPersistido,
    persisted: true,
    alreadyExisted: !created,
  }
}
