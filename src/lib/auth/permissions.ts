// src/lib/auth/permissions.ts
// Stack Auth native permission IDs for the RBAC system.
// These must be created in the Stack Auth dashboard before they take effect.
//
// Dashboard setup:
//   1. Create permissions: role_admin, role_comercial, role_office, role_financeiro,
//      page_clients, page_proposals, page_contracts (and optionally admin pages)
//   2. For backwards compatibility, legacy ids with ":" are still supported by the app.
//
// Role descriptions:
//   role_admin      → Administrador com acesso total ao sistema
//   role_comercial  → Usuário comum (acesso a clientes e propostas próprias)
//   role_office     → Acesso irrestrito a todos os clientes e propostas (leitura e escrita)
//   role_financeiro → Acesso a informações financeiras (read-only de clientes e propostas)

export const PERMISSIONS = {
  ROLE_ADMIN: "role_admin",
  ROLE_COMERCIAL: "role_comercial",
  ROLE_OFFICE: "role_office",
  ROLE_FINANCEIRO: "role_financeiro",
  PAGE_CLIENTS: "page_clients",
  PAGE_PROPOSALS: "page_proposals",
  PAGE_CONTRACTS: "page_contracts",
  PAGE_CLIENTS_LEGACY: "page:clients",
  PAGE_PROPOSALS_LEGACY: "page:proposals",
  PAGE_CONTRACTS_LEGACY: "page:contracts",
  PAGE_FINANCIAL: "page_financial_analysis",
  PAGE_FINANCIAL_LEGACY: "page:financial_analysis",
  PAGE_FINANCIAL_MANAGEMENT: "page_financial_management",
  PAGE_PREF: "page:preferences",
  PAGE_USERS: "page:users",
  PAGE_DASHBOARD: "page:dashboard",
  PAGE_PORTFOLIO: "page:portfolio",
} as const
