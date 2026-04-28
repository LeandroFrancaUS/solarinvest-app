// src/features/projectHub/persistConvertedProjeto.ts
// Orchestrates building a Projeto from an analysis result and optionally
// persisting it to the backend via /api/storage when a clientId is available.
//
// Rules:
// - When clientId is present: assigns a backend UUID and writes to /api/storage.
// - When clientId is absent (or backend write fails): returns the local fallback
//   Projeto (id = Date.now().toString()) and logs a controlled warning.
// - Never modifies convertAnaliseToProjeto or the backend engines.

import { convertAnaliseToProjeto } from './convertAnaliseToProjeto'
import { persistRemoteStorageEntry } from '../../app/services/serverStorage'
import type { Projeto } from './useProjectStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

export const PROJETO_HUB_STORAGE_PREFIX = 'projeto_hub_'

export interface PersistConvertedProjetoParams {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  tipo: 'venda' | 'leasing'
  clienteNome?: string
  consultorNome?: string
  consultorId?: string
  pagamentoModalidade?: 'avista' | 'parcelado'
  /** Local client record ID. When present, a backend UUID is assigned and the
   *  project is persisted via /api/storage so it survives page refreshes. */
  clientId?: string | null
}

/**
 * Converts an AnaliseFinanceira result into a persisted Projeto.
 *
 * - With clientId  → uuid id + /api/storage write; returns Projeto with UUID.
 * - Without clientId → local fallback (Date.now id); warns to console.
 *
 * Always returns the Projeto to hand off to addProjeto, or null when the
 * underlying convertAnaliseToProjeto returns null (no analiseFinanceiraResult).
 */
export async function persistConvertedProjeto(
  params: PersistConvertedProjetoParams,
): Promise<Projeto | null> {
  const baseProjeto = convertAnaliseToProjeto(params)
  if (!baseProjeto) return null

  if (!params.clientId) {
    console.info(
      '[persistConvertedProjeto] clientId não disponível — projeto criado localmente',
      { id: baseProjeto.id },
    )
    return baseProjeto
  }

  // Assign a proper UUID so the id is backend-stable when clientId is known.
  const uuid: string =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const projeto: Projeto = { ...baseProjeto, id: uuid }

  try {
    await persistRemoteStorageEntry(
      `${PROJETO_HUB_STORAGE_PREFIX}${params.clientId}_${uuid}`,
      JSON.stringify(projeto),
    )
    if (import.meta.env.DEV) {
      console.info('[persistConvertedProjeto] Projeto persistido no backend', {
        id: uuid,
        clientId: params.clientId,
      })
    }
  } catch (err) {
    console.warn(
      '[persistConvertedProjeto] Falha ao persistir no backend — mantendo fallback local',
      err,
    )
    // Return the UUID-id projeto even if /api/storage fails so the caller can
    // still call addProjeto and show feedback to the user.
  }

  return projeto
}
