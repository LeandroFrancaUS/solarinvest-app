// src/types/navigation.ts
// Shared navigation type definitions used across App.tsx, sidebarConfig.ts, and useRouteGuard.ts.
// Single source of truth for page and section identifiers.

export type ActivePage =
  | 'dashboard'
  | 'operational-dashboard'
  | 'app'
  | 'crm'
  | 'consultar'
  | 'clientes'
  | 'settings'
  | 'simulacoes'
  | 'admin-users'
  | 'carteira'
  | 'financial-management'
  | 'project-hub'

export type SimulacoesSection =
  | 'nova'
  | 'salvas'
  | 'analise'
