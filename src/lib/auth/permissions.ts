// src/lib/auth/permissions.ts
// Stack Auth native permission IDs for the RBAC system.
// These must be created in the Stack Auth dashboard before they take effect.
//
// Dashboard setup:
//   1. Create permissions: role:admin, role:comercial, role:financeiro,
//      page:financial_analysis, page:preferences
//   2. Configure role:admin to include page:financial_analysis and page:preferences

export const PERMISSIONS = {
  ROLE_ADMIN: "role:admin",
  ROLE_COMERCIAL: "role:comercial",
  ROLE_FINANCEIRO: "role:financeiro",
  PAGE_FINANCIAL: "page:financial_analysis",
  PAGE_PREF: "page:preferences",
} as const
