// src/services/portfolioAutoFill.ts
// Orchestrates the auto-fill of computed fields for "Negócio fechado" clients.
//
// Triggers (all handled externally — this module only provides the logic):
//   • Portfolio list load
//   • Individual portfolio client load
//   • Client converted to "Negócio fechado"
//   • DB sync
//
// Protection:
//   • client.metadata.autoFilled = true  ← persisted loop-guard (server-side)
//   • processedInSession Set             ← in-memory guard (client-side per session)
//   • Batch debounce of 500ms
//   • Skips clients with no source_proposal_id

import { getProposal } from '../lib/api/proposalsApi'
import { patchPortfolioUsina } from './clientPortfolioApi'
import { hydrateClientComputedFields } from '../utils/hydrateClientComputedFields'
import type { PortfolioClientRow } from '../types/clientPortfolio'

// ─── In-session dedup set ─────────────────────────────────────────────────────
// Prevents re-running auto-fill for the same client within a browser session
// even if the component remounts.
const processedInSession = new Set<number>()

// ─── Per-client auto-fill ─────────────────────────────────────────────────────

/**
 * Run the auto-fill pipeline for a single portfolio client.
 *
 * Returns true when any fields were patched, false otherwise.
 */
export async function runAutoFillForClient(client: PortfolioClientRow): Promise<boolean> {
  if (!client?.id) return false

  // In-session guard (prevents multiple concurrent calls for the same client)
  if (processedInSession.has(client.id)) return false

  // Server-side guard (metadata.autoFilled = true)
  const meta = client.metadata
  if (meta && typeof meta === 'object' && meta.autoFilled === true) {
    processedInSession.add(client.id)
    return false
  }

  // Must have a linked proposal to source data from
  const proposalId = client.source_proposal_id
  if (!proposalId) {
    // Check if there are already-filled fields; if all key usina fields are set, mark done
    const allFilled =
      client.system_kwp != null &&
      client.geracao_estimada_kwh != null &&
      client.numero_modulos != null
    if (allFilled) processedInSession.add(client.id)
    return false
  }

  // Mark in-session before the async fetch to avoid duplicate concurrent runs
  processedInSession.add(client.id)

  let payloadJson: Record<string, unknown> | null = null
  try {
    const proposal = await getProposal(proposalId)
    payloadJson = proposal?.payload_json ?? null
  } catch (err) {
    console.warn('[auto-fill] failed to fetch proposal', { clientId: client.id, proposalId, err })
    // Remove from session set so it can be retried on next load
    processedInSession.delete(client.id)
    return false
  }

  const update = hydrateClientComputedFields(client, payloadJson)
  if (!update) {
    return false
  }

  // Build a plain object for the API call — spread the strongly-typed fields
  // into a Record so no unsafe cast is needed.
  const { energyProfile, ...rest } = update
  const apiPayload: Record<string, unknown> = { ...rest }
  if (energyProfile) apiPayload.energyProfile = energyProfile

  try {
    await patchPortfolioUsina(client.id, apiPayload)
    console.info('[auto-fill] persisted', { clientId: client.id, fields: Object.keys(update) })
    return true
  } catch (err) {
    console.warn('[auto-fill] patch failed', { clientId: client.id, err })
    // Remove from session set so we retry on the next load
    processedInSession.delete(client.id)
    return false
  }
}

// ─── Batch auto-fill ──────────────────────────────────────────────────────────

let batchTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Queue a batch auto-fill run for a list of portfolio clients.
 *
 * Uses a 500ms debounce so that rapid consecutive calls (e.g. from multiple
 * re-renders) are collapsed into one batch.
 *
 * Processes clients sequentially to avoid hitting rate limits.
 */
export function queueBatchAutoFill(clients: PortfolioClientRow[]): void {
  if (batchTimeout !== null) {
    clearTimeout(batchTimeout)
  }
  batchTimeout = setTimeout(() => {
    batchTimeout = null
    void runBatchAutoFill(clients)
  }, 500)
}

async function runBatchAutoFill(clients: PortfolioClientRow[]): Promise<void> {
  const candidates = clients.filter((c) => {
    if (!c?.id) return false
    if (processedInSession.has(c.id)) return false
    const meta = c.metadata
    if (meta && typeof meta === 'object' && meta.autoFilled === true) {
      processedInSession.add(c.id)
      return false
    }
    return true
  })

  if (candidates.length === 0) return

  console.info('[auto-fill] batch start', { count: candidates.length })

  for (const client of candidates) {
    try {
      await runAutoFillForClient(client)
    } catch {
      // Per-client errors are already handled inside runAutoFillForClient
    }
  }

  console.info('[auto-fill] batch done')
}
