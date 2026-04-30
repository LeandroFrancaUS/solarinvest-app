// src/domain/analytics/kpis.ts
// Compute dashboard KPIs from filtered AnalyticsRecords.

import type { AnalyticsRecord, DashboardKPIs } from './types.js'

export function computeKPIs(records: readonly AnalyticsRecord[]): DashboardKPIs {
  const total = records.length
  const closed = records.filter((r) => r.isClosed)
  const active = records.filter((r) => r.isActive)

  const closedContracts = closed.length
  const activeClients = active.length

  const sales = closed.filter((r) => r.contractType === 'sale' || r.contractType === 'buyout')
  const leasing = closed.filter((r) => r.contractType === 'leasing')

  const totalContractValue = sales.reduce((sum, r) => sum + (r.saleContractValue ?? r.contractValue ?? 0), 0)
  const leasingMonthlyContracted = leasing.reduce((sum, r) => sum + (r.leasingMonthlyValue ?? r.contractValue ?? 0), 0)

  const averageTicket = sales.length > 0 ? totalContractValue / sales.length : 0

  const withConsumption = records.filter((r) => r.consumption != null && r.consumption > 0)
  const totalConsumption = withConsumption.reduce((sum, r) => sum + (r.consumption ?? 0), 0)
  const averageConsumption = withConsumption.length > 0 ? totalConsumption / withConsumption.length : 0

  const conversionRate = total > 0 ? closedContracts / total : 0

  return {
    closedContracts,
    activeClients,
    totalContractValue,
    leasingMonthlyContracted,
    averageTicket,
    totalConsumption,
    averageConsumption,
    conversionRate,
  }
}
