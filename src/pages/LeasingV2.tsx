import { useMemo, useState } from 'react'
import { FlowScaffold } from '../components/flows/FlowScaffold'
import { StepWizard, type StepConfig } from '../components/flows/StepWizard'
import { StepCard } from '../components/flows/StepCard'
import { StickySummary, type SummaryChecklistItem, type SummaryKpi } from '../components/flows/StickySummary'
import { ReviewAndGenerate } from '../components/flows/ReviewAndGenerate'
import { AssistantDrawer } from '../components/flows/AssistantDrawer'
import { useBRNumberField } from '../lib/locale/useBRNumberField'
import { formatMoneyBR, formatNumberBR, toNumberFlexible } from '../lib/locale/br-number'
import { leasingActions, useLeasingStore } from '../store/useLeasingStore'
import '../components/flows/flows.css'

interface LeasingV2Props {
  onGenerateProposal?: () => Promise<boolean> | boolean | void
  onNavigateBack?: () => void
  onNavigateVendas?: () => void
}

export function LeasingV2({ onGenerateProposal, onNavigateBack, onNavigateVendas }: LeasingV2Props) {
  const [activeStep, setActiveStep] = useState(0)
  const contrato = useLeasingStore((s) => s.contrato)
  const dadosTecnicos = useLeasingStore((s) => s.dadosTecnicos)
  const oferta = useLeasingStore((s) => ({
    prazoContratualMeses: s.prazoContratualMeses,
    energiaContratadaKwhMes: s.energiaContratadaKwhMes,
    tarifaInicial: s.tarifaInicial,
    descontoContratual: s.descontoContratual,
    valorDeMercadoEstimado: s.valorDeMercadoEstimado,
  }))

  const energiaField = useBRNumberField({
    value: oferta.energiaContratadaKwhMes,
    onChange: (value) => leasingActions.update({ energiaContratadaKwhMes: value ?? 0 }),
  })
  const tarifaField = useBRNumberField({
    value: oferta.tarifaInicial,
    onChange: (value) => leasingActions.update({ tarifaInicial: value ?? 0 }),
  })
  const prazoField = useBRNumberField({
    value: oferta.prazoContratualMeses,
    onChange: (value) => leasingActions.update({ prazoContratualMeses: value ?? 0 }),
  })
  const potenciaField = useBRNumberField({
    value: dadosTecnicos.potenciaInstaladaKwp,
    onChange: (value) => leasingActions.updateDadosTecnicos({ potenciaInstaladaKwp: value ?? 0 }),
  })
  const mercadoField = useBRNumberField({
    value: oferta.valorDeMercadoEstimado,
    onChange: (value) => leasingActions.setValorDeMercadoEstimado(value ?? 0),
  })

  const requiredSteps: Record<string, () => string[]> = {
    contexto: () => {
      const missing: string[] = []
      if (!contrato.tipoContrato) missing.push('Tipo de contrato')
      if (!contrato.localEntrega) missing.push('Local de entrega')
      return missing
    },
    entrada: () => {
      const missing: string[] = []
      if (!oferta.energiaContratadaKwhMes) missing.push('Consumo contratado')
      if (!oferta.tarifaInicial) missing.push('Tarifa inicial')
      return missing
    },
    sistema: () => {
      const missing: string[] = []
      if (!dadosTecnicos.tipoInstalacao) missing.push('Tipo de instalação')
      if (!dadosTecnicos.potenciaInstaladaKwp) missing.push('Potência instalada')
      return missing
    },
    oferta: () => {
      const missing: string[] = []
      if (!oferta.prazoContratualMeses) missing.push('Prazo contratual')
      if (!oferta.valorDeMercadoEstimado) missing.push('Valor de mercado estimado')
      return missing
    },
    projecoes: () => [],
    revisao: () => [],
  }

  const baseSteps: StepConfig[] = useMemo(
    () => [
      {
        id: 'contexto',
        title: 'Contexto do cliente',
        description: 'Dados iniciais do contrato',
        validate: requiredSteps.contexto,
        render: () => (
          <StepCard title="Dados do contrato" description="Informações gerais">
            <label className="field">
              <span>Tipo de contrato</span>
              <select value={contrato.tipoContrato} onChange={(e) => leasingActions.updateContrato({ tipoContrato: e.target.value })}>
                <option value="">Selecione</option>
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
              </select>
            </label>
            <label className="field">
              <span>Local de entrega</span>
              <input value={contrato.localEntrega} onChange={(e) => leasingActions.updateContrato({ localEntrega: e.target.value })} />
            </label>
            <label className="field">
              <span>Responsável</span>
              <input value={contrato.nomeCondominio} onChange={(e) => leasingActions.updateContrato({ nomeCondominio: e.target.value })} />
            </label>
          </StepCard>
        ),
      },
      {
        id: 'entrada',
        title: 'Entrada principal',
        description: 'Consumo contratado e tarifa',
        validate: requiredSteps.entrada,
        render: () => (
          <StepCard title="Consumo" description="Dados para dimensionamento">
            <label className="field">
              <span>Energia contratada (kWh/mês)</span>
              <input ref={energiaField.ref} value={energiaField.text} onChange={energiaField.onTextChange} onBlur={energiaField.onBlur} />
            </label>
            <label className="field">
              <span>Tarifa inicial (R$/kWh)</span>
              <input ref={tarifaField.ref} value={tarifaField.text} onChange={tarifaField.onTextChange} onBlur={tarifaField.onBlur} />
            </label>
            <p className="muted">Upload de conta/orçamento permanece no fluxo completo.</p>
          </StepCard>
        ),
      },
      {
        id: 'sistema',
        title: 'Sistema e restrições',
        description: 'Dados técnicos essenciais',
        validate: requiredSteps.sistema,
        render: () => (
          <StepCard title="Sistema" description="Informações técnicas">
            <label className="field">
              <span>Tipo de instalação</span>
              <input
                value={dadosTecnicos.tipoInstalacao}
                onChange={(e) => leasingActions.updateDadosTecnicos({ tipoInstalacao: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Potência instalada (kWp)</span>
              <input ref={potenciaField.ref} value={potenciaField.text} onChange={potenciaField.onTextChange} onBlur={potenciaField.onBlur} />
            </label>
            <label className="field">
              <span>Área útil (m²)</span>
              <input
                value={dadosTecnicos.areaUtilM2}
                onChange={(e) => leasingActions.updateDadosTecnicos({ areaUtilM2: toNumberFlexible(e.target.value) ?? 0 })}
              />
            </label>
          </StepCard>
        ),
      },
      {
        id: 'oferta',
        title: 'Oferta de leasing',
        description: 'Prazo e condições',
        validate: requiredSteps.oferta,
        render: () => (
          <StepCard title="Condições" description="Configuração financeira">
            <label className="field">
              <span>Prazo contratual (meses)</span>
              <input ref={prazoField.ref} value={prazoField.text} onChange={prazoField.onTextChange} onBlur={prazoField.onBlur} />
            </label>
            <label className="field">
              <span>Desconto contratual (%)</span>
              <input
                value={oferta.descontoContratual}
                onChange={(e) => leasingActions.update({ descontoContratual: toNumberFlexible(e.target.value) ?? 0 })}
              />
            </label>
            <label className="field">
              <span>Valor de mercado estimado (R$)</span>
              <input ref={mercadoField.ref} value={mercadoField.text} onChange={mercadoField.onTextChange} onBlur={mercadoField.onBlur} />
            </label>
          </StepCard>
        ),
      },
      {
        id: 'projecoes',
        title: 'Projeções',
        description: 'KPIs principais',
        validate: requiredSteps.projecoes,
        render: () => (
          <StepCard title="Indicadores" description="Resumo do estado atual">
            <div className="grid-two">
              <div>
                <p className="muted">Potência (kWp)</p>
                <strong>{formatNumberBR(dadosTecnicos.potenciaInstaladaKwp ?? 0)}</strong>
              </div>
              <div>
                <p className="muted">Energia contratada</p>
                <strong>{formatNumberBR(oferta.energiaContratadaKwhMes ?? 0)} kWh/mês</strong>
              </div>
              <div>
                <p className="muted">Tarifa inicial</p>
                <strong>{formatMoneyBR(oferta.tarifaInicial ?? 0)}</strong>
              </div>
              <div>
                <p className="muted">Valor de mercado</p>
                <strong>{formatMoneyBR(oferta.valorDeMercadoEstimado ?? 0)}</strong>
              </div>
            </div>
          </StepCard>
        ),
      },
    ],
    [contrato.localEntrega, contrato.nomeCondominio, contrato.tipoContrato, dadosTecnicos.areaUtilM2, dadosTecnicos.potenciaInstaladaKwp, dadosTecnicos.tipoInstalacao, oferta.descontoContratual, oferta.energiaContratadaKwhMes, oferta.tarifaInicial, oferta.valorDeMercadoEstimado, oferta.prazoContratualMeses],
  )

  const allPendencias = useMemo(() => baseSteps.flatMap((step) => step.validate?.() ?? []), [baseSteps])

  const handleGenerateProposal = async () => {
    if (allPendencias.length > 0) {
      const missingIndex = baseSteps.findIndex((step) => (step.validate?.() ?? []).length > 0)
      if (missingIndex >= 0) setActiveStep(missingIndex)
      return
    }
    if (onGenerateProposal) {
      await onGenerateProposal()
      return
    }
    alert('Proposta de leasing gerada (UI V2).')
  }

  const steps: StepConfig[] = useMemo(
    () => [
      ...baseSteps,
      {
        id: 'revisao',
        title: 'Revisão e proposta',
        description: 'Checklist final e geração',
        validate: requiredSteps.revisao,
        render: () => <ReviewAndGenerate pendencias={allPendencias} onGenerate={handleGenerateProposal} />,
      },
    ],
    [allPendencias, baseSteps],
  )

  const checklist: SummaryChecklistItem[] = [
    { label: 'Contrato', ok: !!contrato.tipoContrato, onClick: () => setActiveStep(0) },
    { label: 'Energia', ok: !!oferta.energiaContratadaKwhMes, onClick: () => setActiveStep(1) },
    { label: 'Tarifa', ok: !!oferta.tarifaInicial, onClick: () => setActiveStep(1) },
    { label: 'Instalação', ok: !!dadosTecnicos.tipoInstalacao, onClick: () => setActiveStep(2) },
    { label: 'Potência', ok: !!dadosTecnicos.potenciaInstaladaKwp, onClick: () => setActiveStep(2) },
    { label: 'Prazo', ok: !!oferta.prazoContratualMeses, onClick: () => setActiveStep(3) },
  ]

  const summaryKpis: SummaryKpi[] = [
    { label: 'Potência (kWp)', value: formatNumberBR(dadosTecnicos.potenciaInstaladaKwp ?? 0) },
    { label: 'Energia (kWh/mês)', value: formatNumberBR(oferta.energiaContratadaKwhMes ?? 0) },
    { label: 'Tarifa inicial', value: formatMoneyBR(oferta.tarifaInicial ?? 0) },
    { label: 'Valor de mercado', value: formatMoneyBR(oferta.valorDeMercadoEstimado ?? 0) },
  ]

  const assistantInsights = (
    <div>
      <p>Assistente lista pendências antes de gerar a proposta.</p>
      <ul>
        {allPendencias.length === 0 ? <li>Nenhuma pendência encontrada.</li> : null}
        {allPendencias.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )

  return (
    <FlowScaffold
      title="Leasing — Simulação e Proposta"
      subtitle="Fluxo sequencial com resumo fixo"
      breadcrumbs={["Home", "Leasing", "Nova proposta"]}
      actions={
        <div className="flow-actions-inline">
          {onNavigateBack ? (
            <button type="button" className="ghost" onClick={onNavigateBack}>
              Voltar para painel
            </button>
          ) : null}
          {onNavigateVendas ? (
            <button type="button" className="ghost" onClick={onNavigateVendas}>
              Ir para Vendas V2
            </button>
          ) : null}
        </div>
      }
      sidebar={
        <StickySummary
          kpis={summaryKpis}
          checklist={checklist}
          primaryLabel="Gerar Proposta"
          onPrimaryAction={handleGenerateProposal}
        />
      }
    >
      <StepWizard steps={steps} activeStep={activeStep} onStepChange={setActiveStep} />
      <AssistantDrawer insights={assistantInsights} />
    </FlowScaffold>
  )
}
