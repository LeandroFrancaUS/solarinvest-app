// src/features/projectHub/persistConvertedProjeto.ts
// Orchestration layer: builds a Projeto from an AnaliseFinanceira result and
// persists it to the backend, returning a Projeto whose `id` is the real UUID
// assigned by the database.
//
// Design principles:
//   • convertAnaliseToProjeto stays pure (no I/O) — this file owns all side effects.
//   • serverClientId is required for backend persistence. When absent, the function
//     returns the locally-generated Projeto unchanged.
//   • planId acts as an idempotency key: repeated calls with the same key
//     will return the existing backend project instead of creating a duplicate.

import { convertAnaliseToProjeto } from './convertAnaliseToProjeto'
import { createProjectFromAnalise } from '../../services/projectsApi'
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
  serverClientId?: number | null
  /**
   * Stable identifier for this analise run (idempotency key).
   * Must start with "analise:". Generated once per analise session and reused
   * across retries so that repeated conversions don't create duplicate projects.
   */
  planId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an AnaliseFinanceira result into a Projeto and persists it to the
 * backend when a serverClientId is provided.
 *
 * Returns the Projeto with its real backend UUID when persisted, a locally-
 * generated Projeto when serverClientId is absent, or null when the analysis
 * result is incomplete.
 *
 * Backend persistence:
 *   • Calls POST /api/projects/from-analise with the minimal snapshot.
 *   • On success the returned Projeto.id is the real UUID assigned by the DB,
 *     which makes ProjectChargesTab able to load and generate charges for it.
 *
 * Graceful degradation:
 *   • When serverClientId is absent, the function returns the locally-built
 *     Projeto (with a generated id). The caller should inform the user that
 *     billing features will not work until the project is linked to a backend client.
 *
 * convertAnaliseToProjeto is intentionally NOT modified — it remains pure.
 */
export async function persistConvertedProjeto(
  params: PersistConvertedProjetoParams,
): Promise<Projeto | null> {
  const {
    analiseFinanceiraResult,
    tipo,
    clienteNome,
    consultorNome,
    consultorId,
    pagamentoModalidade,
    serverClientId,
    planId,
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
    return null
  }

  if (serverClientId == null || !Number.isFinite(serverClientId) || serverClientId <= 0) {
    return projetoLocal
  }

  const { project } = await createProjectFromAnalise({
    client_id: serverClientId,
    project_type: tipo,
    plan_id: planId ?? `analise:${crypto.randomUUID()}`,
    client_name_snapshot: clienteNome ?? null,
  })

  return {
    ...projetoLocal,
    // Replace the locally-generated id with the real backend UUID so that
    // ProjectChargesTab and other backend-aware features work correctly.
    id: project.id,
  }
}
