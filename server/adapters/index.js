// server/adapters/index.js
//
// Barrel export for the compatibility adapter layer.
//
// Usage:
//   import { ClientAdapter, ProposalAdapter } from '../adapters/index.js'
//
// Each named export is the full module — callers should destructure the
// functions they need:
//   const { fromDb, toDb, toSoftDelete } = ClientAdapter
//
// All adapters are pure data-mapping modules (no DB access).

export * as ClientAdapter    from './clientAdapter.js'
export * as ProposalAdapter  from './proposalAdapter.js'
export * as PortfolioAdapter from './portfolioAdapter.js'
export * as StorageAdapter   from './storageAdapter.js'
export * as AuthAdapter      from './authAdapter.js'
export * as FinanceAdapter   from './financeAdapter.js'
export * as ProjectAdapter   from './projectAdapter.js'
export * as ContractAdapter  from './contractAdapter.js'
