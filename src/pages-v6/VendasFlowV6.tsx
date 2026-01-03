import React, { useMemo, useState } from 'react'
import { FlowLayoutV6 } from '../components/flow-v6/FlowLayoutV6'
import { StepCardV6 } from '../components/flow-v6/StepCardV6'
import { SummarySidebarV6 } from '../components/flow-v6/SummarySidebarV6'
import { WizardV6 } from '../components/flow-v6/WizardV6'

export type VendasSections = {
  cliente: () => React.ReactNode
  consumo: () => React.ReactNode
  sistema: () => React.ReactNode
  kitCustos: () => React.ReactNode
  resultados: () => React.ReactNode
  gerar: () => React.ReactNode
}

type ClienteResumo = {
  nome: string
}

type VendasFlowV6Props = {
  sections: VendasSections
  cliente: ClienteResumo
  consumoMedio?: number | null
  tipoInstalacao?: string | null
  tipoSistema?: string | null
  potenciaInstalada?: number | null
  geracaoMensal?: number | null
  valorKit?: string | number | null
  capexTotal?: string | number | null
  modoOrcamentoLabel?: string
  onGenerateProposal: () => void
  onToggleLegacy: () => void
}

export function VendasFlowV6({
  sections,
  cliente,
  consumoMedio,
  tipoInstalacao,
  tipoSistema,
  potenciaInstalada,
  geracaoMensal,
  valorKit,
  capexTotal,
  modoOrcamentoLabel,
  onGenerateProposal,
  onToggleLegacy,
}: VendasFlowV6Props) {
  const [stepIndex, setStepIndex] = useState(0)

  const pendencias = useMemo(() => {
    const items: Array<{ label: string; step: number }> = []
    if (!cliente.nome) {
      items.push({ label: 'Nome do cliente', step: 0 })
    }
    if (consumoMedio == null || consumoMedio <= 0) {
      items.push({ label: 'Consumo médio', step: 1 })
    }
    if (!tipoInstalacao) {
      items.push({ label: 'Tipo de instalação', step: 2 })
    }
    if (!tipoSistema) {
      items.push({ label: 'Tipo de sistema', step: 2 })
    }
    if (capexTotal == null || capexTotal === '') {
      items.push({ label: 'Capex total', step: 5 })
    }
    return items
  }, [capexTotal, cliente.nome, consumoMedio, tipoInstalacao, tipoSistema])

  const handleVerPendencias = () => {
    if (pendencias.length > 0) {
      setStepIndex(pendencias[0].step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const steps = [
    {
      title: 'Cliente',
      content: <StepCardV6 title="Cliente" description="Dados principais do cliente">{sections.cliente()}</StepCardV6>,
    },
    {
      title: 'Consumo e Tarifa',
      content: (
        <StepCardV6
          title="Consumo e Tarifa"
          description="Inclui histórico de consumo, tarifa e upload de conta."
        >
          {sections.consumo()}
        </StepCardV6>
      ),
    },
    {
      title: 'Configuração do Sistema',
      content: (
        <StepCardV6
          title="Configuração do Sistema"
          description="Tipo de instalação, sistema e rede."
        >
          {sections.sistema()}
        </StepCardV6>
      ),
    },
    {
      title: 'Kit e Custos',
      content: (
        <StepCardV6 title="Kit e Custos" description="Custos detalhados e modo manual/automático.">
          {sections.kitCustos()}
        </StepCardV6>
      ),
    },
    {
      title: 'Resultados',
      content: (
        <StepCardV6 title="Resultados" description="Gráficos e projeções.">
          {sections.resultados()}
        </StepCardV6>
      ),
    },
    {
      title: 'Revisão e Gerar Proposta',
      content: (
        <StepCardV6 title="Revisão final" description="Revise e gere a proposta.">
          {sections.gerar()}
        </StepCardV6>
      ),
    },
  ]

  return (
    <FlowLayoutV6
      title="Vendas — Flow V6"
      stepIndex={stepIndex}
      totalSteps={steps.length}
      onToggleLegacy={onToggleLegacy}
      sidebar={
        <SummarySidebarV6
          modoLabel={modoOrcamentoLabel}
          kpis={[
            { label: 'Potência (kWp)', value: potenciaInstalada ?? '—' },
            { label: 'Geração (kWh/mês)', value: geracaoMensal ?? '—' },
            { label: 'Valor do kit', value: valorKit ?? '—' },
            { label: 'CAPEX Total', value: capexTotal ?? '—' },
          ]}
          pendencias={pendencias}
          onVerPendencias={handleVerPendencias}
          onGerarProposta={onGenerateProposal}
        />
      }
    >
      <WizardV6 steps={steps} stepIndex={stepIndex} onStepChange={setStepIndex} onFinish={onGenerateProposal} />
    </FlowLayoutV6>
  )
}
