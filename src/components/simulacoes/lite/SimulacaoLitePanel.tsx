import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RevenueCostProfitChartLite } from './RevenueCostProfitChartLite'
import { TarifaForecastChartLite } from './TarifaForecastChartLite'
import { RoiByYearChartLite } from './RoiByYearChartLite'
import { SimulationReportLite } from '../../export/SimulationReportLite'
import type { TarifaAtualLite, TarifaHistoricaLite } from '../../../lib/aneel/aneelClientLite'
import { fetchHistoricoTarifasCurtas, fetchTarifaAtualDistribuidora } from '../../../lib/aneel/aneelClientLite'
import { runSimulacaoLite, type SimulacaoLiteInput, type SimulacaoLiteScenarioKey } from '../../../lib/finance/simulacaoEngineLite'
import { useSimulacoesLiteStore, makeLitePlanoId, type SimulacaoLitePlano } from '../../../store/simulacoesLiteStore'
import { gerarRecomendacaoLite } from '../../../lib/ai/simulacaoRecommenderLite'
import { formatMoneyBR, formatPercentBR, formatNumberBRWithOptions } from '../../../lib/locale/br-number'

const scenarioOptions: Array<{ key: SimulacaoLiteScenarioKey; label: string }> = [
  { key: 'base', label: 'Base' },
  { key: 'otimista', label: 'Otimista' },
  { key: 'pessimista', label: 'Pessimista' },
]

export type SimulacaoLitePanelProps = {
  defaultCapex?: number
  defaultConsumoMensal?: number
  defaultAnosAnalise?: number
}

type FormState = {
  planoNome: string
  capex: number
  opexMensal: number
  consumoMensalKwh: number
  energiaVendidaKwhMensal: number
  tarifaInicial: number
  distribuidoraId: string
  anosAnalise: number
  tusdAbsorvidaPercent: number
  taxaDescontoAnual: number
}

const formatPercent = (value: number): string => formatPercentBR(value / 100)

export const SimulacaoLitePanel: React.FC<SimulacaoLitePanelProps> = ({
  defaultCapex = 250000,
  defaultConsumoMensal = 8000,
  defaultAnosAnalise = 15,
}) => {
  const [form, setForm] = useState<FormState>({
    planoNome: 'Plano base',
    capex: defaultCapex,
    opexMensal: 2500,
    consumoMensalKwh: defaultConsumoMensal,
    energiaVendidaKwhMensal: defaultConsumoMensal,
    tarifaInicial: 0.85,
    distribuidoraId: '',
    anosAnalise: defaultAnosAnalise,
    tusdAbsorvidaPercent: 0.12,
    taxaDescontoAnual: 0.1,
  })
  const [tarifaAneel, setTarifaAneel] = useState<TarifaAtualLite | undefined>()
  const [historicoAneel, setHistoricoAneel] = useState<TarifaHistoricaLite[] | undefined>()
  const [aneelStatus, setAneelStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const planos = useSimulacoesLiteStore((state) => state.planos)
  const selectedPlanoId = useSimulacoesLiteStore((state) => state.selectedPlanoId)
  const selectedScenario = useSimulacoesLiteStore((state) => state.selectedScenario)
  const recomendacao = useSimulacoesLiteStore((state) => state.recomendacao)
  const upsertPlano = useSimulacoesLiteStore((state) => state.upsertPlano)
  const setSelectedPlano = useSimulacoesLiteStore((state) => state.setSelectedPlano)
  const setSelectedScenario = useSimulacoesLiteStore((state) => state.setSelectedScenario)
  const setRecomendacao = useSimulacoesLiteStore((state) => state.setRecomendacao)

  const handleInputChange = useCallback((field: keyof FormState) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setForm((current) => ({
        ...current,
        [field]: field === 'planoNome' || field === 'distribuidoraId' ? value : Number(value),
      }))
    }
  }, [])

  useEffect(() => {
    if (!selectedPlanoId && planos.length > 0) {
      setSelectedPlano(planos[0].id)
    }
  }, [selectedPlanoId, planos, setSelectedPlano])

  useEffect(() => {
    if (planos.length >= 2) {
      const recomendacaoGerada = gerarRecomendacaoLite(
        planos.map((plano) => ({ planoId: plano.id, nomePlano: plano.nome, resultado: plano.resultado })),
      )
      setRecomendacao(recomendacaoGerada)
    } else {
      setRecomendacao(null)
    }
  }, [planos, setRecomendacao])

  useEffect(() => {
    if (!form.distribuidoraId) {
      setTarifaAneel(undefined)
      setHistoricoAneel(undefined)
      setAneelStatus('idle')
      return
    }
    let active = true
    const load = async () => {
      setAneelStatus('loading')
      try {
        const [tarifa, historico] = await Promise.all([
          fetchTarifaAtualDistribuidora(form.distribuidoraId),
          fetchHistoricoTarifasCurtas(form.distribuidoraId),
        ])
        if (!active) return
        setTarifaAneel(tarifa)
        setHistoricoAneel(historico)
        setAneelStatus('success')
      } catch (error) {
        console.error('Erro ao carregar ANEEL', error)
        if (!active) return
        setAneelStatus('error')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [form.distribuidoraId])

  const selectedPlano = useMemo(() => planos.find((plano) => plano.id === selectedPlanoId), [planos, selectedPlanoId])
  const scenario = selectedPlano?.resultado.cenarios[selectedScenario]
  const serieAno = scenario?.serieAno ?? []

  const handleRunSimulation = useCallback(() => {
    const input: SimulacaoLiteInput = {
      capex: Math.max(0, form.capex),
      opexMensal: Math.max(0, form.opexMensal),
      consumoMensalKwh: Math.max(0, form.consumoMensalKwh),
      energiaVendidaKwhMensal: Math.max(0, form.energiaVendidaKwhMensal),
      tarifaInicial: form.tarifaInicial,
      distribuidoraId: form.distribuidoraId || undefined,
      anosAnalise: Math.max(1, form.anosAnalise),
      tusdAbsorvidaPercent: Math.max(0, Math.min(1, form.tusdAbsorvidaPercent)),
      taxaDescontoAnual: Math.max(0, form.taxaDescontoAnual),
      tarifaAneel,
      historicoAneel,
    }
    const resultado = runSimulacaoLite(input)
    const id = makeLitePlanoId(form.planoNome)
    const plano: SimulacaoLitePlano = {
      id,
      nome: form.planoNome || 'Plano sem nome',
      input,
      resultado,
    }
    upsertPlano(plano)
    setSelectedPlano(plano.id)
  }, [form, historicoAneel, tarifaAneel, upsertPlano, setSelectedPlano])

  const handleExportPdf = useCallback(() => {
    if (!selectedPlano) {
      return
    }
    const markup = renderToStaticMarkup(
      <SimulationReportLite resultado={selectedPlano.resultado} recomendacao={recomendacao} />,
    )
    if (typeof window === 'undefined') {
      return
    }
    const popup = window.open('', '_blank')
    if (!popup) {
      return
    }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Relatório LITE</title></head><body>${markup}</body></html>`)
    popup.document.close()
    popup.focus()
    popup.print()
  }, [selectedPlano, recomendacao])

  const kpisEssenciais = scenario?.kpisEssenciais
  const kpisAvancados = scenario?.kpisAvancados

  const kpisList = kpisEssenciais
    ? [
        { label: 'CAPEX total', value: formatMoneyBR(kpisEssenciais.capexTotal), tooltip: 'Investimento inicial previsto.' },
        { label: 'OPEX mensal', value: formatMoneyBR(kpisEssenciais.opexMensal), tooltip: 'Custos operacionais recorrentes.' },
        { label: 'Lucro mensal', value: formatMoneyBR(kpisEssenciais.lucroLiquidoMensal), tooltip: 'Lucro líquido médio por mês.' },
        { label: 'Lucro anual', value: formatMoneyBR(kpisEssenciais.lucroLiquidoAnual), tooltip: 'Lucro líquido estimado no primeiro ano.' },
        { label: 'Lucro total', value: formatMoneyBR(kpisEssenciais.lucroLiquidoTotal), tooltip: 'Lucro acumulado ao longo do horizonte.' },
        { label: 'ROI', value: formatPercentBR(kpisEssenciais.roiPercent / 100), tooltip: 'Retorno sobre o investimento.' },
        {
          label: 'Payback',
          value: `${formatNumberBRWithOptions(kpisEssenciais.paybackMeses, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })} meses`,
          tooltip: 'Tempo estimado para recuperar o investimento.',
        },
      ]
    : []

  const kpisAvancadosList = kpisAvancados
    ? [
        { label: 'VPL', value: formatMoneyBR(kpisAvancados.vpl), tooltip: 'Valor presente líquido.' },
        {
          label: 'TIR',
          value: kpisAvancados.tir ? formatPercent(kpisAvancados.tir * 100) : '—',
          tooltip: 'Taxa interna de retorno.',
        },
        { label: 'LCOE', value: `${formatMoneyBR(kpisAvancados.lcoe)} / kWh`, tooltip: 'Custo nivelado de energia.' },
      ]
    : []

  return (
    <section className="simulacao-lite-panel">
      <div className="panel-header">
        <div>
          <h3>Simulações LITE (V3.5)</h3>
          <p>
            Gere rapidamente cenários baseados na tarifa da distribuidora, visualize KPIs essenciais e exporte um PDF enxuto.
          </p>
        </div>
        <div className="panel-actions">
          <button type="button" className="ghost" onClick={handleRunSimulation}>
            Rodar simulação LITE
          </button>
          <button type="button" onClick={handleExportPdf} disabled={!selectedPlano}>
            Gerar relatório PDF
          </button>
        </div>
      </div>
      <div className="simulacao-lite-form">
        <label>
          Nome do plano
          <input type="text" value={form.planoNome} onChange={handleInputChange('planoNome')} />
        </label>
        <label>
          CAPEX (R$)
          <input type="number" value={form.capex} min={0} onChange={handleInputChange('capex')} />
        </label>
        <label>
          OPEX mensal (R$)
          <input type="number" value={form.opexMensal} min={0} onChange={handleInputChange('opexMensal')} />
        </label>
        <label>
          Consumo mensal (kWh)
          <input type="number" value={form.consumoMensalKwh} min={0} onChange={handleInputChange('consumoMensalKwh')} />
        </label>
        <label>
          Energia vendida (kWh/mês)
          <input type="number" value={form.energiaVendidaKwhMensal} min={0} onChange={handleInputChange('energiaVendidaKwhMensal')} />
        </label>
        <label>
          Tarifa inicial (R$/kWh)
          <input type="number" step="0.01" value={form.tarifaInicial} min={0} onChange={handleInputChange('tarifaInicial')} />
        </label>
        <label>
          Distribuidora (código ANEEL)
          <input type="text" value={form.distribuidoraId} onChange={handleInputChange('distribuidoraId')} />
          <small className={`aneel-status ${aneelStatus}`}>
            {aneelStatus === 'idle' && 'Informe um código ANEEL para buscar a tarifa.'}
            {aneelStatus === 'loading' && 'Buscando dados da ANEEL...'}
            {aneelStatus === 'success' && 'Tarifa e histórico carregados.'}
            {aneelStatus === 'error' && 'Não foi possível buscar os dados. Usando valores padrão.'}
          </small>
        </label>
        <label>
          Horizonte (anos)
          <input type="number" value={form.anosAnalise} min={1} onChange={handleInputChange('anosAnalise')} />
        </label>
        <label>
          % TUSD absorvida
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={form.tusdAbsorvidaPercent}
            onChange={handleInputChange('tusdAbsorvidaPercent')}
          />
        </label>
        <label>
          Taxa de desconto anual
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.taxaDescontoAnual}
            onChange={handleInputChange('taxaDescontoAnual')}
          />
        </label>
      </div>
      <div className="planos-lite">
        {planos.map((plano) => {
          const roi = plano.resultado.cenarios.base.kpisEssenciais.roiPercent
          const payback = plano.resultado.cenarios.base.kpisEssenciais.paybackMeses
          return (
            <button
              key={plano.id}
              type="button"
              className={`plano-card${selectedPlano?.id === plano.id ? ' active' : ''}`}
              onClick={() => setSelectedPlano(plano.id)}
            >
              <strong>{plano.nome}</strong>
              <span>ROI: {formatPercentBR(roi / 100)}</span>
              <span>Payback: {formatNumberBRWithOptions(payback, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} meses</span>
            </button>
          )
        })}
        {planos.length === 0 ? <p>Nenhum plano gerado ainda. Preencha os dados e clique em "Rodar simulação".</p> : null}
      </div>
      {planos.length > 0 ? (
        <>
          <div className="scenario-switcher">
            {scenarioOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={selectedScenario === option.key ? 'active' : ''}
                onClick={() => setSelectedScenario(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="kpi-grid-lite">
            {kpisList.map((kpi) => (
              <article key={kpi.label} className="kpi-card" title={kpi.tooltip}>
                <p>{kpi.label}</p>
                <strong>{kpi.value}</strong>
              </article>
            ))}
          </div>
          <div className="kpi-grid-lite secondary">
            {kpisAvancadosList.map((kpi) => (
              <article key={kpi.label} className="kpi-card" title={kpi.tooltip}>
                <p>{kpi.label}</p>
                <strong>{kpi.value}</strong>
              </article>
            ))}
          </div>
          <div className="charts-lite">
            <RevenueCostProfitChartLite data={serieAno} />
            <TarifaForecastChartLite data={serieAno} />
            <RoiByYearChartLite data={serieAno} />
          </div>
          {recomendacao ? (
            <div className="recomendacao-lite">
              <h4>Sugestão de plano SolarInvest</h4>
              <p>{recomendacao.motivoResumo}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
