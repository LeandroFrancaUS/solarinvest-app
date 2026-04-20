// src/domain/analytics/normalizers.ts
// Convert heterogeneous data sources into AnalyticsRecord.

import type { AnalyticsRecord } from './types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v as string | number | boolean | bigint).trim()
  return s === '' ? null : s
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const STATE_TO_REGION: Record<string, string> = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
}

function regionFromState(uf: string | null): string | null {
  if (!uf) return null
  return STATE_TO_REGION[uf.toUpperCase()] ?? null
}

// ---------------------------------------------------------------------------
// Client normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a client row (from /api/clients) into an AnalyticsRecord.
 * Accepts the shape returned by clientsApi.listClients().
 */
export function normalizeClient(c: Record<string, unknown>): AnalyticsRecord {
  const state = str(c.state ?? c.uf) ?? str(c.client_state)
  const closedAt = str(c.portfolio_exported_at ?? c.exported_to_portfolio_at)
  const activatedAt = str(c.clientActivatedAt ?? c.client_activated_at)
  const inPortfolio = Boolean(c.in_portfolio ?? c.inPortfolio ?? c.is_converted_customer)

  // contract_value may come from energy_profile or latest_proposal_profile
  let contractValue = num(c.contract_value)
  if (contractValue == null && c.energy_profile && typeof c.energy_profile === 'object') {
    contractValue = num((c.energy_profile as Record<string, unknown>).mensalidade)
  }
  if (contractValue == null && c.latest_proposal_profile && typeof c.latest_proposal_profile === 'object') {
    contractValue = num((c.latest_proposal_profile as Record<string, unknown>).contract_value)
  }

  return {
    id: String(c.id as string | number ?? ''),
    createdAt: str(c.created_at ?? c.criadoEm),
    closedAt,
    activatedAt,
    consultant: str(c.owner_display_name ?? c.ownerName),
    city: str(c.city ?? c.cidade),
    state,
    region: regionFromState(state),
    contractValue,
    consumption: num(c.consumption_kwh_month),
    isClosed: inPortfolio || closedAt != null,
    isActive: Boolean(c.is_active_portfolio_client) || activatedAt != null,
  }
}

// ---------------------------------------------------------------------------
// Proposal normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a proposal row (from /api/proposals) into an AnalyticsRecord.
 */
export function normalizeProposal(p: Record<string, unknown>): AnalyticsRecord {
  const state = str(p.client_state)
  const status = str(p.status) ?? ''
  const isClosed = status === 'approved'
  const closedAt = isClosed ? str(p.updated_at) : null

  return {
    id: String((p.id ?? '') as string | number),
    createdAt: str(p.created_at),
    closedAt,
    activatedAt: null,
    consultant: str(p.owner_display_name),
    city: str(p.client_city),
    state,
    region: regionFromState(state),
    contractValue: num(p.contract_value ?? p.capex_total),
    consumption: num(p.consumption_kwh_month),
    isClosed,
    isActive: false,
  }
}

// ---------------------------------------------------------------------------
// Portfolio normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a portfolio client row (PortfolioClientRow) into an AnalyticsRecord.
 */
export function normalizePortfolio(row: Record<string, unknown>): AnalyticsRecord {
  const state = str(row.state)
  const activatedAt = str(row.exported_to_portfolio_at)

  let contractValue = num(row.mensalidade)
  if (contractValue == null) {
    contractValue = num(row.buyout_amount_reference)
  }

  const lifecycleStatus = str(row.lifecycle_status) ?? ''
  const isActive =
    Boolean(row.is_active_portfolio_client) ||
    lifecycleStatus === 'active' ||
    lifecycleStatus === 'billing'

  return {
    id: String((row.id ?? '') as string | number),
    createdAt: str(row.client_created_at),
    closedAt: str(row.contract_signed_at ?? row.exported_to_portfolio_at),
    activatedAt,
    consultant: null, // portfolio rows don't carry owner display name
    city: str(row.city),
    state,
    region: regionFromState(state),
    contractValue,
    consumption: num(row.consumption_kwh_month ?? row.kwh_contratado),
    isClosed: Boolean(row.is_converted_customer),
    isActive,
  }
}
