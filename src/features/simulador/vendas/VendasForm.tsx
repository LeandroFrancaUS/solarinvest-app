// src/features/simulador/vendas/VendasForm.tsx
// Vendas tab main form content.
// Extracted from App.tsx (PR F — Extract Vendas UI composition).
// Receives all data via props — no internal state, no direct store access.

import React from 'react'
import type { VendaConfiguracaoSectionProps } from '../../../components/VendaConfiguracaoSection'
import { VendaConfiguracaoSection } from '../../../components/VendaConfiguracaoSection'
import type { ComposicaoUfvSectionProps } from '../../../components/ComposicaoUfvSection'
import { ComposicaoUfvSection } from '../../../components/ComposicaoUfvSection'
import type { RetornoProjetadoSectionProps } from '../../../components/RetornoProjetadoSection'
import { RetornoProjetadoSection } from '../../../components/RetornoProjetadoSection'

export interface VendasFormProps {
  modoOrcamento: 'auto' | 'manual'

  // Pre-rendered sections for complex inline JSX that closes over App.tsx state.
  // This pattern is established in LeasingSections (configuracaoUsinaSection).
  autoOrcamentoSectionNode: React.ReactNode
  parametrosSectionNode: React.ReactNode
  resumoPublicoSectionNode: React.ReactNode
  budgetUploadSectionNode: React.ReactNode
  budgetKitSectionNode: React.ReactNode

  // CondicoesPagamentoSection is pre-composed in App.tsx (const condicoesPagamentoSection).
  condicoesPagamentoSection: React.ReactNode

  // Typed prop bundles for sub-components rendered directly here.
  vendaConfiguracaoProps: VendaConfiguracaoSectionProps
  composicaoUfvProps: ComposicaoUfvSectionProps
  retornoProps: RetornoProjetadoSectionProps
}

export function VendasForm({
  modoOrcamento,
  autoOrcamentoSectionNode,
  parametrosSectionNode,
  resumoPublicoSectionNode,
  budgetUploadSectionNode,
  budgetKitSectionNode,
  condicoesPagamentoSection,
  vendaConfiguracaoProps,
  composicaoUfvProps,
  retornoProps,
}: VendasFormProps) {
  return (
    <>
      {modoOrcamento === 'auto' ? autoOrcamentoSectionNode : null}
      {modoOrcamento === 'manual' ? (
        <>
          {parametrosSectionNode}
          <VendaConfiguracaoSection {...vendaConfiguracaoProps} />
          {resumoPublicoSectionNode}
          <ComposicaoUfvSection {...composicaoUfvProps} />
          {budgetUploadSectionNode}
          {budgetKitSectionNode}
        </>
      ) : null}
      {condicoesPagamentoSection}
      <RetornoProjetadoSection {...retornoProps} />
    </>
  )
}
