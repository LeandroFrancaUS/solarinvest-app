import { useMemo, useState } from 'react'
import { FlowScaffold } from '../components/flows/FlowScaffold'
import { StepWizard, type StepConfig } from '../components/flows/StepWizard'
import { StepCard } from '../components/flows/StepCard'
import { StickySummary, type SummaryChecklistItem, type SummaryKpi } from '../components/flows/StickySummary'
import { ReviewAndGenerate } from '../components/flows/ReviewAndGenerate'
import { AssistantDrawer } from '../components/flows/AssistantDrawer'
import { useBRNumberField } from '../lib/locale/useBRNumberField'
import { formatNumberBR, formatMoneyBR } from '../lib/locale/br-number'
import { useVendaStore, vendaActions } from '../store/useVendaStore'
import type { TipoSistema } from '../lib/finance/roi'
import '../components/flows/flows.css'

export function VendasV2() {
  const [activeStep, setActiveStep] = useState(0)
  const cliente = useVendaStore((s) => s.cliente)
  const parametros = useVendaStore((s) => s.parametros)
  const configuracao = useVendaStore((s) => s.configuracao)
  const composicao = useVendaStore((s) => s.composicao)
  const orcamento = useVendaStore((s) => s.orcamento)

  const consumoField = useBRNumberField({
    value: parametros.consumo_kwh_mes,
    onChange: (value) => vendaActions.updateParametros({ consumo_kwh_mes: value ?? 0 }),
  })
  const tarifaField = useBRNumberField({
    value: parametros.tarifa_r_kwh,
    onChange: (value) => vendaActions.updateParametros({ tarifa_r_kwh: value ?? 0 }),
  })
  const capexField = useBRNumberField({
    value: composicao.capex_total,
    onChange: (value) => vendaActions.updateComposicao({ capex_total: value ?? 0 }),
  })
  const valorKitField = useBRNumberField({
    value: orcamento.valor_total_orcamento,
    onChange: (value) => vendaActions.updateOrcamento({ valor_total_orcamento: value ?? 0 }),
  })

  const requiredSteps: Record<string, () => string[]> = {
    contexto: () => {
      const missing: string[] = []
      if (!cliente.nome) missing.push('Informe o nome do cliente')
      if (!parametros.uf) missing.push('Selecione UF')
      return missing
    },
    entrada: () => {
      const missing: string[] = []
      if (!parametros.consumo_kwh_mes) missing.push('Consumo médio é obrigatório')
      if (!parametros.tarifa_r_kwh) missing.push('Tarifa cheia é obrigatória')
      return missing
    },
    engenharia: () => {
      const missing: string[] = []
      if (!configuracao.tipo_instalacao) missing.push('Tipo de instalação')
      if (!configuracao.tipo_sistema) missing.push('Tipo de sistema')
      return missing
    },
    kit: () => {
      const missing: string[] = []
      if (!orcamento.valor_total_orcamento && !composicao.capex_total) {
        missing.push('Informe valor do kit ou CAPEX')
      }
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
        description: 'Dados iniciais rápidos',
        validate: requiredSteps.contexto,
        render: () => (
          <StepCard title="Cliente" description="Quem é o lead?">
            <label className="field">
              <span>Nome</span>
              <input value={cliente.nome} onChange={(e) => vendaActions.updateCliente({ nome: e.target.value })} />
            </label>
            <label className="field">
              <span>Cidade</span>
              <input value={cliente.cidade} onChange={(e) => vendaActions.updateCliente({ cidade: e.target.value })} />
            </label>
            <label className="field">
              <span>UF</span>
              <input value={parametros.uf} onChange={(e) => vendaActions.updateParametros({ uf: e.target.value })} />
            </label>
          </StepCard>
        ),
      },
      {
        id: 'entrada',
        title: 'Entrada principal',
        description: 'Consumo e tarifa',
        validate: requiredSteps.entrada,
        render: () => (
          <StepCard title="Consumo" description="Base para dimensionamento">
            <label className="field">
              <span>Consumo médio (kWh/mês)</span>
              <input ref={consumoField.ref} value={consumoField.text} onChange={consumoField.onTextChange} onBlur={consumoField.onBlur} />
            </label>
            <label className="field">
              <span>Tarifa cheia (R$/kWh)</span>
              <input ref={tarifaField.ref} value={tarifaField.text} onChange={tarifaField.onTextChange} onBlur={tarifaField.onBlur} />
            </label>
            <p className="muted">Upload de orçamento permanece disponível na versão completa.</p>
          </StepCard>
        ),
      },
      {
        id: 'engenharia',
        title: 'Engenharia do sistema',
        description: 'Configurações técnicas',
        validate: requiredSteps.engenharia,
        render: () => (
          <StepCard title="Instalação" description="Selecione as opções técnicas">
            <label className="field">
              <span>Tipo de instalação</span>
              <input
                value={configuracao.tipo_instalacao}
                onChange={(e) => vendaActions.updateConfiguracao({ tipo_instalacao: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Tipo de sistema</span>
              <select
                value={configuracao.tipo_sistema}
                onChange={(e) => vendaActions.updateConfiguracao({ tipo_sistema: e.target.value as TipoSistema })}
              >
                <option value="">Selecione</option>
                <option value="ON_GRID">On-grid</option>
                <option value="HIBRIDO">Híbrido</option>
                <option value="OFF_GRID">Off-grid</option>
              </select>
            </label>
            <label className="field">
              <span>Observações técnicas</span>
              <textarea
                value={configuracao.estrutura_suporte}
                onChange={(e) => vendaActions.updateConfiguracao({ estrutura_suporte: e.target.value })}
              />
            </label>
          </StepCard>
        ),
      },
      {
        id: 'kit',
        title: 'Kit e CAPEX',
        description: 'Valores e itens principais',
        validate: requiredSteps.kit,
        render: () => (
          <>
            <StepCard title="Kit" description="Valor do orçamento ou cálculo interno">
              <label className="field">
                <span>Valor do kit (R$)</span>
                <input ref={valorKitField.ref} value={valorKitField.text} onChange={valorKitField.onTextChange} onBlur={valorKitField.onBlur} />
              </label>
              <label className="field">
                <span>CAPEX total (R$)</span>
                <input ref={capexField.ref} value={capexField.text} onChange={capexField.onTextChange} onBlur={capexField.onBlur} />
              </label>
              <p className="muted">Campos respeitam a lógica de cálculo existente e podem ser somente leitura quando calculados.</p>
            </StepCard>
          </>
        ),
      },
      {
        id: 'projecoes',
        title: 'Projeções e resultado',
        description: 'KPIs principais sempre visíveis',
        validate: requiredSteps.projecoes,
        render: () => (
          <StepCard title="Resumo do dimensionamento" description="Dados calculados pelo estado atual">
            <div className="grid-two">
              <div>
                <p className="muted">Potência (kWp)</p>
                <strong>{formatNumberBR(configuracao.potencia_sistema_kwp ?? 0)}</strong>
              </div>
              <div>
                <p className="muted">Geração estimada (kWh/mês)</p>
                <strong>{formatNumberBR(configuracao.geracao_estimada_kwh_mes ?? 0)}</strong>
              </div>
              <div>
                <p className="muted">CAPEX</p>
                <strong>{formatMoneyBR(composicao.capex_total ?? 0)}</strong>
              </div>
              <div>
                <p className="muted">Valor do kit</p>
                <strong>{formatMoneyBR(orcamento.valor_total_orcamento ?? 0)}</strong>
              </div>
            </div>
          </StepCard>
        ),
      },
    ],
    [cliente.nome, cliente.cidade, parametros.uf, parametros.consumo_kwh_mes, parametros.tarifa_r_kwh, configuracao.tipo_instalacao, configuracao.tipo_sistema, configuracao.estrutura_suporte, configuracao.potencia_sistema_kwp, configuracao.geracao_estimada_kwh_mes, composicao.capex_total, orcamento.valor_total_orcamento],
  )

  const allPendencias = useMemo(() => {
    return baseSteps.flatMap((step) => step.validate?.() ?? [])
  }, [baseSteps])

  const handleGenerateProposal = () => {
    if (allPendencias.length > 0) {
      const firstMissingStepIndex = baseSteps.findIndex((step) => (step.validate?.() ?? []).length > 0)
      if (firstMissingStepIndex >= 0) {
        setActiveStep(firstMissingStepIndex)
      }
      return
    }
    alert('Proposta gerada (UI V2).')
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
    { label: 'Consumo', ok: !!parametros.consumo_kwh_mes, onClick: () => setActiveStep(1) },
    { label: 'Tarifa', ok: !!parametros.tarifa_r_kwh, onClick: () => setActiveStep(1) },
    { label: 'Instalação', ok: !!configuracao.tipo_instalacao, onClick: () => setActiveStep(2) },
    { label: 'Sistema', ok: !!configuracao.tipo_sistema, onClick: () => setActiveStep(2) },
    { label: 'Valor do kit', ok: !!orcamento.valor_total_orcamento || !!composicao.capex_total, onClick: () => setActiveStep(3) },
  ]

  const summaryKpis: SummaryKpi[] = [
    { label: 'Potência (kWp)', value: formatNumberBR(configuracao.potencia_sistema_kwp ?? 0) },
    { label: 'Geração (kWh/mês)', value: formatNumberBR(configuracao.geracao_estimada_kwh_mes ?? 0) },
    { label: 'CAPEX', value: formatMoneyBR(composicao.capex_total ?? 0) },
    { label: 'Kit', value: formatMoneyBR(orcamento.valor_total_orcamento ?? 0) },
  ]

  const assistantInsights = (
    <div>
      <p>Assistente aponta rapidamente o que falta para gerar a proposta.</p>
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
      title="Venda — Simulação e Proposta"
      subtitle="Fluxo sequencial com resumo fixo"
      breadcrumbs={["Home", "Vendas", "Nova proposta"]}
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
