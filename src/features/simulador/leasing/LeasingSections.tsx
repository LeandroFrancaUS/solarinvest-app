// src/features/simulador/leasing/LeasingSections.tsx
// Full leasing tab inner composition.
// Extracted from App.tsx (PR E — Extract Leasing UI composition).
// Receives all data via props — no internal state, no direct store access.

import React from 'react'
import type { ParametrosPrincipaisSectionProps } from '../../../components/ParametrosPrincipaisSection'
import { ParametrosPrincipaisSection } from '../../../components/ParametrosPrincipaisSection'
import type { LeasingContratoSectionProps } from '../../../components/LeasingContratoSection'
import { LeasingContratoSection } from '../../../components/LeasingContratoSection'
import type { LeasingFormProps } from './LeasingForm'
import { LeasingForm } from './LeasingForm'

export interface LeasingSectionsProps {
  // ParametrosPrincipaisSection – passed through as a typed bundle
  parametrosPrincipaisProps: ParametrosPrincipaisSectionProps

  // Pre-rendered section from App.tsx (renderConfiguracaoUsinaSection)
  configuracaoUsinaSection: React.ReactNode

  // LeasingContratoSection – conditional on !shouldHideSimpleViewItems
  leasingContratoProps: LeasingContratoSectionProps
  shouldHideSimpleViewItems: boolean

  // LeasingForm props
  leasingFormProps: LeasingFormProps
}

export function LeasingSections({
  parametrosPrincipaisProps,
  configuracaoUsinaSection,
  leasingContratoProps,
  shouldHideSimpleViewItems,
  leasingFormProps,
}: LeasingSectionsProps) {
  return (
    <>
      <ParametrosPrincipaisSection {...parametrosPrincipaisProps} />
      {configuracaoUsinaSection}
      {shouldHideSimpleViewItems ? null : (
        <LeasingContratoSection {...leasingContratoProps} />
      )}
      <LeasingForm {...leasingFormProps} />
    </>
  )
}
