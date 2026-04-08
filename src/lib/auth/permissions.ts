// src/lib/auth/permissions.ts
// Stack Auth native permission IDs for the RBAC system.
// These must be created in the Stack Auth dashboard before they take effect.
//
// Dashboard setup:
//   1. Create permissions: role_admin, role_comercial, role_financeiro,
//      page:financial_analysis, page:preferences
//   2. Configure role_admin to include page:financial_analysis and page:preferences
//
// Role descriptions:
//   role_admin      → Administrador com acesso total ao sistema
//   role_comercial  → Usuário comum (acesso a clientes e propostas)
//   role_financeiro → Acesso a informações financeiras (read-only de clientes e propostas)

export const PERMISSIONS = {
  ROLE_ADMIN: "role_admin",
  ROLE_COMERCIAL: "role_comercial",
  ROLE_FINANCEIRO: "role_financeiro",
  PAGE_FINANCIAL: "page:financial_analysis",
  PAGE_PREF: "page:preferences",
} as const
