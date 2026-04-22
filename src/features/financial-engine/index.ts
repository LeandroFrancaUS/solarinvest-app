// src/features/financial-engine/index.ts
// Barrel export for the financial-engine feature.
// Includes only the operational core (PR 4 scope).

export type { LeasingFinancialSummary } from './leasingCore'
export { computeLeasingFinancialSummary } from './leasingCore'

export type { VendaFinancialSummary } from './vendaCore'
export { computeVendaFinancialSummary } from './vendaCore'

export { LeasingFinancialCore } from './LeasingFinancialCore'
export { VendaFinancialCore } from './VendaFinancialCore'
