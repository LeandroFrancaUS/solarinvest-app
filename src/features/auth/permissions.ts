// src/features/auth/permissions.ts
// Frontend-specific permission map for the SolarInvest RBAC system.
// Defines frontend roles and which ActivePage values each role is allowed to access.
// Reuses the conceptual structure of the backend permissionMap but is a
// frontend-only module — does not alter backend, DB, or calculation engines.

import type { ActivePage } from '../../types/navigation'

// ── Role definitions ──────────────────────────────────────────────────────────

/** Frontend application roles. */
export type UserRole =
  | 'ADMIN'
  | 'DIRETORIA'
  | 'COMERCIAL'
  | 'FINANCEIRO'
  | 'OPERACAO'
  | 'SUPORTE'

// ── Permission map ────────────────────────────────────────────────────────────

/**
 * Maps each frontend role to the set of ActivePage values the role may access.
 * Keep this list in sync with the navigation types in src/types/navigation.ts.
 */
export const permissionMap: Record<UserRole, ActivePage[]> = {
  ADMIN: [
    'dashboard',
    'operational-dashboard',
    'app',
    'crm',
    'consultar',
    'clientes',
    'settings',
    'simulacoes',
    'admin-users',
    'carteira',
    'financial-management',
    'project-hub',
    'comercial-leads',
    'comercial-propostas',
    'cobrancas-mensalidades',
    'cobrancas-recebimentos',
    'cobrancas-inadimplencia',
    'operacao-agenda',
    'operacao-chamados',
    'operacao-manutencoes',
    'operacao-limpezas',
    'operacao-seguros',
    'indicadores-visao-geral',
    'indicadores-leasing',
    'indicadores-vendas',
    'indicadores-fluxo-caixa',
    'relatorios-propostas',
    'relatorios-contratos',
    'relatorios-financeiro',
    'relatorios-clientes',
    'relatorios-operacao',
  ],

  /** DIRETORIA: acesso amplo — equivale a role_office no Stack Auth. */
  DIRETORIA: [
    'dashboard',
    'operational-dashboard',
    'app',
    'crm',
    'consultar',
    'clientes',
    'carteira',
    'financial-management',
    'project-hub',
    'comercial-leads',
    'comercial-propostas',
    'cobrancas-mensalidades',
    'cobrancas-recebimentos',
    'cobrancas-inadimplencia',
    'operacao-agenda',
    'operacao-chamados',
    'operacao-manutencoes',
    'operacao-limpezas',
    'operacao-seguros',
    'indicadores-visao-geral',
    'indicadores-leasing',
    'indicadores-vendas',
    'indicadores-fluxo-caixa',
    'relatorios-propostas',
    'relatorios-contratos',
    'relatorios-financeiro',
    'relatorios-clientes',
    'relatorios-operacao',
  ],

  /** COMERCIAL: acesso a propostas, clientes e indicadores comerciais. */
  COMERCIAL: [
    'dashboard',
    'app',
    'crm',
    'consultar',
    'clientes',
    'comercial-leads',
    'comercial-propostas',
    'simulacoes',
    'indicadores-leasing',
    'indicadores-vendas',
    'relatorios-propostas',
    'relatorios-contratos',
    'relatorios-clientes',
  ],

  /** FINANCEIRO: acesso a cobranças, carteira e indicadores financeiros. */
  FINANCEIRO: [
    'dashboard',
    'crm',
    'clientes',
    'carteira',
    'financial-management',
    'cobrancas-mensalidades',
    'cobrancas-recebimentos',
    'cobrancas-inadimplencia',
    'indicadores-visao-geral',
    'indicadores-fluxo-caixa',
    'relatorios-financeiro',
    'relatorios-clientes',
  ],

  /** OPERACAO: acesso à área de operação e leitura de clientes. */
  OPERACAO: [
    'operational-dashboard',
    'operacao-agenda',
    'operacao-chamados',
    'operacao-manutencoes',
    'operacao-limpezas',
    'operacao-seguros',
    'clientes',
    'crm',
    'project-hub',
    'relatorios-operacao',
  ],

  /** SUPORTE: acesso restrito a chamados, agenda e leitura de clientes. */
  SUPORTE: [
    'operacao-chamados',
    'operacao-agenda',
    'clientes',
    'crm',
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pages that are always accessible regardless of role, e.g. the 403 page itself. */
const ALWAYS_ACCESSIBLE: ActivePage[] = ['no-permission']

/**
 * Returns true if the given role is allowed to access the given page.
 * The 'no-permission' page is always accessible to prevent redirect loops.
 */
export function hasPermission(role: UserRole, page: ActivePage): boolean {
  if (ALWAYS_ACCESSIBLE.includes(page)) return true
  return permissionMap[role]?.includes(page) ?? false
}

// ── Role resolution ───────────────────────────────────────────────────────────

interface RbacSnapshot {
  isAdmin: boolean
  isOffice: boolean
  isFinanceiro: boolean
  isComercial: boolean
  /**
   * Future Stack Auth role for the Operação team.
   * Not yet wired to Stack Auth permissions — reserved for forward compatibility.
   */
  isOperacao?: boolean
  /**
   * Future Stack Auth role for the Suporte team.
   * Not yet wired to Stack Auth permissions — reserved for forward compatibility.
   */
  isSuporte?: boolean
  isLoading: boolean
}

/**
 * Maps the current Stack Auth RBAC state to a frontend UserRole.
 *
 * Falls back to 'ADMIN' when:
 * - Permissions are still loading (prevents premature redirects)
 * - No recognized role flag is set (preserves full access for existing users
 *   who have not yet been assigned a specific role in Stack Auth)
 */
export function resolveUserRole(rbac: RbacSnapshot): UserRole {
  if (rbac.isLoading) return 'ADMIN'
  if (rbac.isAdmin) return 'ADMIN'
  if (rbac.isOffice) return 'DIRETORIA'
  if (rbac.isFinanceiro) return 'FINANCEIRO'
  if (rbac.isComercial) return 'COMERCIAL'
  if (rbac.isOperacao) return 'OPERACAO'
  if (rbac.isSuporte) return 'SUPORTE'
  // No recognized role — fallback to ADMIN to avoid breaking existing users
  return 'ADMIN'
}
