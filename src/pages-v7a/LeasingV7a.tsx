import React, { useMemo, useState } from 'react'
import { FlowShellV7a, type FlowV7aStep } from '../components/flow-v7a/FlowShellV7a'

export type LeasingV7aProps = {
  sections: {
    consumo: () => React.ReactNode
    gerar: () => React.ReactNode
  }
  kpis: { label: string; value: string | number | null }[]
  manualReason?: string | null
  onGenerateProposal: () => void
}

export function LeasingV7a({ sections, kpis, manualReason, onGenerateProposal }: LeasingV7aProps) {
  const [step, setStep] = useState(1)

  const steps: FlowV7aStep[] = useMemo(
    () => [
      {
        id: 'cliente',
        title: 'Cliente',
        description: 'Dados do cliente e enquadramento.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'consumo',
        title: 'Consumo & Tarifa',
        description: 'Consumo médio, tarifa e upload do comprovante.',
        content: <>{sections.consumo()}</>,
      },
      {
        id: 'sistema',
        title: 'Sistema',
        description: 'Rede, instalação e restrições.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'oferta',
        title: 'Oferta de Leasing',
        description: 'Prazo e condições.',
        content: <div className="v7a-placeholder">Em configuração</div>,
      },
      {
        id: 'projecoes',
        title: 'Projeções',
        description: 'Retornos e economias previstas.',
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
      title="Leasing"
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
