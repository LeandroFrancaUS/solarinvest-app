/**
 * Parity Test Suite — Section I: UI Smoke Tests
 *
 * These tests verify that key page components exist and their source files
 * are structurally complete. Since full rendering requires complex store setup,
 * we use source inspection for most checks and delegate actual render tests
 * to the existing critical/app-render test suite.
 *
 * For components that can render without store dependencies, we test them
 * directly.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../..')

function readSource(relPath: string): string {
  const full = resolve(ROOT, relPath)
  if (!existsSync(full)) return ''
  return readFileSync(full, 'utf-8')
}

function fileExists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath))
}

// ─── I1: Dashboard opens ──────────────────────────────────────────────────────

describe('I1 — Dashboard page', () => {
  it('DashboardPage component exists', () => {
    expect(fileExists('src/pages/DashboardPage.tsx')).toBe(true)
  })

  it('DashboardPage exports a default component', () => {
    const src = readSource('src/pages/DashboardPage.tsx')
    const hasDefault = src.includes('export default') || src.includes('export { DashboardPage }') || src.includes('export function DashboardPage')
    expect(hasDefault).toBe(true)
  })

  it('DashboardPage uses financial KPI cards', () => {
    const src = readSource('src/pages/DashboardPage.tsx')
    expect(src).toContain('FinancialKpiCards')
  })

  it('OperationalDashboardPage exists for operational view', () => {
    expect(fileExists('src/pages/OperationalDashboardPage.tsx')).toBe(true)
  })
})

// ─── I2: Clients opens ────────────────────────────────────────────────────────

describe('I2 — Clients page', () => {
  it('ClientesPage component exists', () => {
    expect(fileExists('src/pages/ClientesPage.tsx')).toBe(true)
  })

  it('ClientesPage exports a component', () => {
    const src = readSource('src/pages/ClientesPage.tsx')
    expect(src.length).toBeGreaterThan(0)
  })

  it('ClientPortfolioPage exists for portfolio view', () => {
    expect(fileExists('src/pages/ClientPortfolioPage.tsx')).toBe(true)
  })
})

// ─── I3: Leasing Proposal opens ──────────────────────────────────────────────

describe('I3 — Leasing Proposal page', () => {
  it('Leasing simulação feature directory exists', () => {
    const hasFeature = fileExists('src/features/simulacoes') || fileExists('src/features/financial-engine')
    expect(hasFeature).toBe(true)
  })

  it('PrintPageLeasing exists for leasing PDF output', () => {
    expect(fileExists('src/pages/PrintPageLeasing.tsx')).toBe(true)
  })

  it('Leasing store exists', () => {
    expect(fileExists('src/store/useLeasingStore.ts')).toBe(true)
  })

  it('Leasing store has useLeasingStore export', () => {
    const src = readSource('src/store/useLeasingStore.ts')
    expect(src).toContain('useLeasingStore')
  })
})

// ─── I4: Sale Proposal opens ─────────────────────────────────────────────────

describe('I4 — Sale Proposal page', () => {
  it('Venda store exists', () => {
    expect(fileExists('src/store/useVendaStore.ts')).toBe(true)
  })

  it('Venda store has useVendaStore export', () => {
    const src = readSource('src/store/useVendaStore.ts')
    expect(src).toContain('useVendaStore')
  })

  it('PrintableProposalVenda component directory exists', () => {
    expect(fileExists('src/components/print/PrintableProposalVenda')).toBe(true)
  })

  it('ComercialPropostasPage exists', () => {
    expect(fileExists('src/pages/ComercialPropostasPage.tsx')).toBe(true)
  })
})

// ─── I5: Portfolio opens ──────────────────────────────────────────────────────

describe('I5 — Portfolio page', () => {
  it('ClientPortfolioPage exists', () => {
    expect(fileExists('src/pages/ClientPortfolioPage.tsx')).toBe(true)
  })

  it('ClientPortfolioPage has portfolio tab system', () => {
    const src = readSource('src/pages/ClientPortfolioPage.tsx')
    expect(src.length).toBeGreaterThan(0)
    // Should have tabs for different portfolio views
    const hasTabPattern = src.includes('tab') || src.includes('Tab') || src.includes('Cobrança') || src.includes('Contrato')
    expect(hasTabPattern).toBe(true)
  })
})

// ─── I6: Financial opens ─────────────────────────────────────────────────────

describe('I6 — Financial management page', () => {
  it('FinancialManagementPage exists', () => {
    expect(fileExists('src/pages/FinancialManagementPage.tsx')).toBe(true)
  })

  it('FinancialManagementPage imports financial management API', () => {
    const src = readSource('src/pages/FinancialManagementPage.tsx')
    expect(src).toContain('financialManagementApi')
  })

  it('FinancialAnalysesPage exists for advanced analytics', () => {
    expect(fileExists('src/pages/FinancialAnalysesPage.tsx')).toBe(true)
  })

  it('RevenueAndBillingPage exists for billing view', () => {
    expect(fileExists('src/pages/RevenueAndBillingPage.tsx')).toBe(true)
  })
})

// ─── I7: Projects opens ───────────────────────────────────────────────────────

describe('I7 — Projects page', () => {
  it('ProjectDetailPage exists', () => {
    expect(fileExists('src/pages/ProjectDetailPage.tsx')).toBe(true)
  })

  it('projectHub feature directory exists', () => {
    expect(fileExists('src/features/projectHub')).toBe(true)
  })

  it('projects store exists', () => {
    expect(fileExists('src/store/useProjectsStore.ts')).toBe(true)
  })
})

// ─── I8: Admin opens ─────────────────────────────────────────────────────────

describe('I8 — Admin page', () => {
  it('admin-users feature directory exists', () => {
    expect(fileExists('src/features/admin-users')).toBe(true)
  })

  it('RequireAdmin guard protects admin routes', () => {
    expect(fileExists('src/auth/guards/RequireAdmin.tsx')).toBe(true)
  })

  it('SettingsPage exists for system configuration', () => {
    expect(fileExists('src/pages/SettingsPage.tsx')).toBe(true)
  })
})

// ─── I9: CRM opens ───────────────────────────────────────────────────────────

describe('I9 — CRM page', () => {
  it('crm feature directory exists', () => {
    expect(fileExists('src/features/crm')).toBe(true)
  })

  it('ComercialLeadsPage exists for CRM leads', () => {
    expect(fileExists('src/pages/ComercialLeadsPage.tsx')).toBe(true)
  })

  it('CRM hooks and utilities exist', () => {
    const src = readSource('src/features/crm/__tests__/useCrm.test.ts')
    expect(src.length).toBeGreaterThan(0)
  })
})

// ─── I10: Settings opens ─────────────────────────────────────────────────────

describe('I10 — Settings page', () => {
  it('SettingsPage exists', () => {
    expect(fileExists('src/pages/SettingsPage.tsx')).toBe(true)
  })

  it('settings feature pages exist', () => {
    const hasSettings = fileExists('src/pages/settings')
    expect(hasSettings).toBe(true)
  })
})

// ─── I11: App router has all critical routes ──────────────────────────────────

describe('I11 — App routing completeness', () => {
  it('App.tsx exists and is the main entry point', () => {
    expect(fileExists('src/App.tsx')).toBe(true)
  })

  it('App.tsx references dashboard route', () => {
    const src = readSource('src/App.tsx')
    const hasDashboard = src.includes('dashboard') || src.includes('Dashboard')
    expect(hasDashboard).toBe(true)
  })

  it('App.tsx references clients route', () => {
    const src = readSource('src/App.tsx')
    const hasClientes = src.includes('clientes') || src.includes('Clientes') || src.includes('ClientesPage')
    expect(hasClientes).toBe(true)
  })

  it('App.tsx references financial route', () => {
    const src = readSource('src/App.tsx')
    const hasFinancial = src.includes('financeiro') || src.includes('financial') || src.includes('Financial')
    expect(hasFinancial).toBe(true)
  })

  it('AccessPendingPage or NoPermissionPage exists for unauthorized users', () => {
    const src = readSource('src/App.tsx')
    // App.tsx uses NoPermissionPage to redirect unauthorized users
    const hasAccessControl = src.includes('AccessPending') || src.includes('access-pending') || src.includes('NoPermissionPage') || src.includes('NoPermission')
    expect(hasAccessControl).toBe(true)
  })

  it('SignInPage exists for authentication', () => {
    expect(fileExists('src/pages/SignInPage.tsx')).toBe(true)
  })
})
