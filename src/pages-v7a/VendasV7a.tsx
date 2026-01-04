import React, { useMemo, useState } from 'react'
import { FlowShellV7a, type FlowV7aStep } from '../components/flow-v7a/FlowShellV7a'

export type VendasV7aProps = {
  sections: {
    consumo: () => React.ReactNode
    gerar: () => React.ReactNode
  }
  kpis: { label: string; value: string | number | null }[]
  manualReason?: string | null
  onGenerateProposal: () => void
}

export function VendasV7a({ sections, kpis, manualReason, onGenerateProposal }: VendasV7aProps) {
  const [step, setStep] = useState(1)

  const steps: FlowV7aStep[] = useMemo(
    () => [
      {
        id: 'cliente',
        title: 'Cliente',
        description: 'Identificação e contatos principais.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'consumo',
        title: 'Consumo & Tarifa',
        description: 'Consumo médio, tarifa e comprovante em um só lugar.',
        content: <>{sections.consumo()}</>,
      },
      {
        id: 'sistema',
        title: 'Sistema',
        description: 'Tipo de instalação, sistema e rede.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'kit',
        title: 'Kit & Custos',
        description: 'Custos do kit e CAPEX.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'resultados',
        title: 'Resultados',
        description: 'KPIs e retornos projetados.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'gerar',
        title: 'Revisão & Proposta',
        description: 'Revise e gere a proposta oficial.',
        content: <>{sections.gerar()}</>,
      },
    ],
    [sections],
  )

  return (
    <FlowShellV7a
      title="Vendas"
      subtitle="Fluxo guiado, etapa por etapa"
      currentStep={step}
      steps={steps}
      kpis={kpis}
      manualReason={manualReason ?? null}
      pending={step < steps.length - 1 ? ['Complete as etapas anteriores antes de gerar a proposta.'] : []}
      onChangeStep={setStep}
      onGenerateProposal={onGenerateProposal}
    />
  )
}
