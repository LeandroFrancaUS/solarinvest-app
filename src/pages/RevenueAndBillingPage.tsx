// src/pages/RevenueAndBillingPage.tsx
// Receita e Cobrança — delegates entirely to FinancialManagementPage.
// The "Projetos" tab uses RealProjectsTab (useProjectsStore) which shows
// project-level rows with search, type and status filters.

import { FinancialManagementPage } from './FinancialManagementPage'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
  initialProjectId?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// RevenueAndBillingPage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Receita e Cobrança page.
 *
 * Delegates entirely to FinancialManagementPage, which renders RealProjectsTab
 * for the "Projetos" tab.  RealProjectsTab uses useProjectsStore and shows
 * project-level rows with search, type and status filters, a "X projetos"
 * count, and clickable client names.
 */
export function RevenueAndBillingPage({ onBack, initialProjectId }: Props) {
  return (
    <FinancialManagementPage
      onBack={onBack}
      {...(initialProjectId != null ? { initialProjectId } : {})}
    />
  )
}
