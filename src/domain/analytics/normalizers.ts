// src/domain/analytics/normalizers.ts
// Convert heterogeneous data sources into AnalyticsRecord.

import type { AnalyticsRecord, AnalyticsContractType } from './types.js'

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

function normalizeContractType(value: unknown): AnalyticsContractType {
  const raw = str(value)?.toLowerCase()
  if (raw === 'leasing') return 'leasing'
  if (raw === 'sale' || raw === 'venda') return 'sale'
  if (raw === 'buyout' || raw === 'buy_out' || raw === 'buy-out') return 'buyout'
  return 'unknown'
}

function resolveConsultant(row: Record<string, unknown>): string | null {
  return str(
    row.consultant_name ??
    row.consultor_nome ??
    row.consultor ??
    row.owner_display_name ??
    row.ownerName ??
    row.created_by_name,
  )
}

function baseRecord(row: Record<string, unknown>, state: string | null): Pick<AnalyticsRecord, 'city' | 'state' | 'region' | 'consumption'> {
  return {
    city: str(row.city ?? row.cidade ?? row.client_city),
    state,
    region: regionFromState(state),
    consumption: num(row.consumption_kwh_month ?? row.kwh_contratado ?? row.kwh_mes_contratado),
  }
}

export function normalizeClient(c: Record<string, unknown>): AnalyticsRecord {
  const state = str(c.state ?? c.uf) ?? str(c.client_state)
  const closedAt = str(c.portfolio_exported_at ?? c.exported_to_portfolio_at)
  const activatedAt = str(c.clientActivatedAt ?? c.client_activated_at)
  const inPortfolio = Boolean(c.in_portfolio ?? c.inPortfolio ?? c.is_converted_customer)
  const contractType = normalizeContractType(c.contract_type)

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
    consultant: resolveConsultant(c),
    ...baseRecord(c, state),
    contractValue,
    saleContractValue: contractType === 'sale' || contractType === 'buyout' ? contractValue : null,
    leasingMonthlyValue: contractType === 'leasing' ? contractValue : null,
    contractType,
    isClosed: inPortfolio || closedAt != null,
    isActive: Boolean(c.is_active_portfolio_client) || activatedAt != null,
  }
}

export function normalizeProposal(p: Record<string, unknown>): AnalyticsRecord {
  const state = str(p.client_state)
  const status = str(p.status) ?? ''
  const isClosed = status === 'approved'
  const closedAt = isClosed ? str(p.updated_at) : null
  const contractType = normalizeContractType(p.contract_type ?? p.proposal_type ?? p.tipo_proposta)
  const contractValue = num(p.contract_value ?? p.capex_total)

  return {
    id: String((p.id ?? '') as string | number),
    createdAt: str(p.created_at),
    closedAt,
    activatedAt: null,
    consultant: resolveConsultant(p),
    ...baseRecord(p, state),
    contractValue,
    saleContractValue: contractType === 'sale' || contractType === 'buyout' ? contractValue : null,
    leasingMonthlyValue: contractType === 'leasing' ? num(p.mensalidade ?? p.valor_mensalidade) : null,
    contractType,
    isClosed,
    isActive: false,
  }
}

export function normalizePortfolio(row: Record<string, unknown>): AnalyticsRecord {
  const state = str(row.state)
  const contractType = normalizeContractType(row.contract_type)
  const leasingMonthlyValue = num(row.valor_mensalidade ?? row.mensalidade)
  const saleContractValue = num(row.buyout_amount_reference ?? row.contract_value ?? row.valordemercado)
  const contractValue = contractType === 'leasing'
    ? leasingMonthlyValue
    : (saleContractValue ?? leasingMonthlyValue)
  const lifecycleStatus = str(row.lifecycle_status) ?? ''
  const activatedAt = str(row.exported_to_portfolio_at ?? row.contract_start_date ?? row.client_created_at)
  const isActive =
    Boolean(row.is_active_portfolio_client) ||
    lifecycleStatus === 'active' ||
    lifecycleStatus === 'billing' ||
    Boolean(row.is_converted_customer)

  return {
    id: String((row.id ?? '') as string | number),
    createdAt: str(row.client_created_at),
    closedAt: str(row.contract_signed_at ?? row.exported_to_portfolio_at),
    activatedAt,
    consultant: resolveConsultant(row),
    ...baseRecord(row, state),
    contractValue,
    saleContractValue: contractType === 'sale' || contractType === 'buyout' ? saleContractValue : null,
    leasingMonthlyValue: contractType === 'leasing' ? leasingMonthlyValue : null,
    contractType,
    isClosed: Boolean(row.is_converted_customer),
    isActive,
  }
}
