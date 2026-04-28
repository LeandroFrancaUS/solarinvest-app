// src/features/projectHub/persistConvertedProjeto.ts
// Orchestrates building a Projeto from an analysis result and optionally
// persisting it to the real backend via POST /api/projects/from-analise
// when a serverClientId (numeric DB client_id) is available.
//
// Rules:
// - When serverClientId is present: calls /api/projects/from-analise, assigns
//   the backend UUID as Projeto.id, and returns the persisted Projeto.
// - When serverClientId is absent (client not yet synced) or backend call fails:
//   returns the local fallback Projeto (id = Date.now().toString()) and logs a
//   controlled warning.
// - Never modifies convertAnaliseToProjeto or the backend engines.

import { convertAnaliseToProjeto } from './convertAnaliseToProjeto'
import { createProjectFromAnalise } from '../../services/projectsApi'
import type { Projeto } from './useProjectStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

export interface PersistConvertedProjetoParams {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  tipo: 'venda' | 'leasing'
  clienteNome?: string
  consultorNome?: string
  consultorId?: string
  pagamentoModalidade?: 'avista' | 'parcelado'
  /** Numeric DB client_id from the backend. When present, the project is
   *  persisted via POST /api/projects/from-analise with a real backend UUID. */
  serverClientId?: number | null
}

/**
 * Converts an AnaliseFinanceira result into a persisted Projeto.
 *
 * - With serverClientId → calls /api/projects/from-analise; returns Projeto
 *   with the backend UUID as id.
 * - Without serverClientId → local fallback (Date.now id); warns to console.
 *
 * Always returns the Projeto to hand off to addProjeto, or null when the
 * underlying convertAnaliseToProjeto returns null (no analiseFinanceiraResult).
 */
export async function persistConvertedProjeto(
  params: PersistConvertedProjetoParams,
): Promise<Projeto | null> {
  const baseProjeto = convertAnaliseToProjeto(params)
  if (!baseProjeto) return null

  if (!params.serverClientId) {
    console.info(
      '[persistConvertedProjeto] serverClientId não disponível — projeto criado localmente',
      { id: baseProjeto.id },
    )
    return baseProjeto
  }

  // Generate a stable plan_id client-side so repeated clicks don't create duplicates.
  const planId = `analise:${crypto.randomUUID()}`

  try {
    const { project } = await createProjectFromAnalise({
      client_id: params.serverClientId,
      project_type: params.tipo,
      client_name_snapshot: params.clienteNome ?? null,
      plan_id: planId,
    })

    const projeto: Projeto = { ...baseProjeto, id: project.id }

    if (import.meta.env.DEV) {
      console.info('[persistConvertedProjeto] Projeto persistido via /api/projects/from-analise', {
        id: project.id,
        serverClientId: params.serverClientId,
        created: true,
      })
    }

    return projeto
  } catch (err) {
    console.warn(
      '[persistConvertedProjeto] Falha ao persistir no backend — mantendo fallback local',
      err,
    )
    // Return the local projeto so the caller can still call addProjeto and
    // show feedback to the user even when the backend call fails.
    return baseProjeto
  }
}
