// src/domain/analytics/kpis.ts
// Compute dashboard KPIs from filtered AnalyticsRecords.

import type { AnalyticsRecord, DashboardKPIs } from './types.js'

export function computeKPIs(records: readonly AnalyticsRecord[]): DashboardKPIs {
  const total = records.length
  const closed = records.filter((r) => r.isClosed)
  const active = records.filter((r) => r.isActive)

  const closedContracts = closed.length
  const activeClients = active.length

  const totalContractValue = closed.reduce((sum, r) => sum + (r.contractValue ?? 0), 0)
  const averageTicket = closedContracts > 0 ? totalContractValue / closedContracts : 0

  const withConsumption = records.filter((r) => r.consumption != null && r.consumption > 0)
  const totalConsumption = withConsumption.reduce((sum, r) => sum + (r.consumption ?? 0), 0)
  const averageConsumption = withConsumption.length > 0 ? totalConsumption / withConsumption.length : 0

  const conversionRate = total > 0 ? closedContracts / total : 0

  return {
    closedContracts,
    activeClients,
    totalContractValue,
    averageTicket,
    totalConsumption,
    averageConsumption,
    conversionRate,
  }
}
