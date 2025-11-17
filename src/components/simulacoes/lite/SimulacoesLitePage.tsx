import React, { useEffect, useMemo } from 'react'

import { SimulacaoLitePanel, SIMULACAO_LITE_SCENARIOS } from './SimulacaoLitePanel'
import { useSimulacoesLiteStore } from '../../../store/simulacoesLiteStore'
import { formatMoneyBR, formatNumberBRWithOptions, formatPercentBR } from '../../../lib/locale/br-number'
import { RevenueCostProfitChartLite } from './RevenueCostProfitChartLite'
import { TarifaForecastChartLite } from './TarifaForecastChartLite'
import { RoiByYearChartLite } from './RoiByYearChartLite'
import { openSimulacaoLiteReport } from './exportSimulacaoLiteReport'

export type SimulacoesLitePageProps = {
  mode: 'nova' | 'salvas' | 'detalhe'
  simulacaoId?: string | null
  onNavigateNova: () => void
  onNavigateSalvas: () => void
  onNavigateDetalhe: (id: string) => void
}

export const SimulacoesLitePage: React.FC<SimulacoesLitePageProps> = ({
  mode,
  simulacaoId,
  onNavigateNova,
  onNavigateSalvas,
  onNavigateDetalhe,
}) => {
  const planos = useSimulacoesLiteStore((state) => state.planos)
  const setSelectedPlano = useSimulacoesLiteStore((state) => state.setSelectedPlano)
  const selectedScenario = useSimulacoesLiteStore((state) => state.selectedScenario)
  const setSelectedScenario = useSimulacoesLiteStore((state) => state.setSelectedScenario)
  const recomendacao = useSimulacoesLiteStore((state) => state.recomendacao)

  useEffect(() => {
    if (mode === 'detalhe' && simulacaoId) {
      setSelectedPlano(simulacaoId)
    }
  }, [mode, simulacaoId, setSelectedPlano])

  const detalhePlano = useMemo(
    () => planos.find((plano) => plano.id === simulacaoId),
    [planos, simulacaoId],
  )

  const detalheScenario = detalhePlano?.resultado.cenarios[selectedScenario]
  const detalheSerieAno = detalheScenario?.serieAno ?? []
  const detalheKpisEssenciais = detalheScenario?.kpisEssenciais
  const detalheKpisAvancados = detalheScenario?.kpisAvancados

  const detalheKpis = detalheKpisEssenciais
    ? [
        { label: 'CAPEX total', value: formatMoneyBR(detalheKpisEssenciais.capexTotal) },
        { label: 'OPEX mensal', value: formatMoneyBR(detalheKpisEssenciais.opexMensal) },
        { label: 'Lucro mensal', value: formatMoneyBR(detalheKpisEssenciais.lucroLiquidoMensal) },
        { label: 'Lucro anual', value: formatMoneyBR(detalheKpisEssenciais.lucroLiquidoAnual) },
        { label: 'Lucro total', value: formatMoneyBR(detalheKpisEssenciais.lucroLiquidoTotal) },
        { label: 'ROI', value: formatPercentBR(detalheKpisEssenciais.roiPercent / 100) },
        {
          label: 'Payback',
          value: `${formatNumberBRWithOptions(detalheKpisEssenciais.paybackMeses, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })} meses`,
        },
      ]
    : []

  const detalheKpisAvancadosList = detalheKpisAvancados
    ? [
        { label: 'VPL', value: formatMoneyBR(detalheKpisAvancados.vpl) },
        {
          label: 'TIR',
          value:
            typeof detalheKpisAvancados.tir === 'number'
              ? formatPercentBR(detalheKpisAvancados.tir)
              : '—',
        },
        { label: 'LCOE', value: `${formatMoneyBR(detalheKpisAvancados.lcoe)} / kWh` },
      ]
    : []

  const pageDescription =
    mode === 'nova'
      ? 'Monte uma nova simulação financeira LITE com dados da ANEEL.'
      : mode === 'salvas'
        ? 'Consulte simulações já geradas e abra detalhes completos.'
        : 'Consulte os KPIs da simulação selecionada e gere relatórios.'

  const renderSavedList = () => (
    <section className="config-card simulacoes-lite-saved">
      <div className="simulacoes-lite-saved-header">
        <div>
          <h3>Simulações salvas</h3>
          <p>Selecione uma simulação para analisar KPIs ou gerar um relatório.</p>
        </div>
        <button type="button" onClick={onNavigateNova}>
          Nova simulação
        </button>
      </div>
      {planos.length === 0 ? (
        <p className="simulacoes-lite-empty">
          Nenhuma simulação foi criada ainda. Clique em "Nova simulação" para começar.
        </p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Plano</th>
                <th>ROI (Base)</th>
                <th>Payback</th>
                <th>Lucro total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {planos.map((plano) => {
                const base = plano.resultado.cenarios.base.kpisEssenciais
                return (
                  <tr key={plano.id}>
                    <td>
                      <strong>{plano.nome}</strong>
                    </td>
                    <td>{formatPercentBR(base.roiPercent / 100)}</td>
                    <td>
                      {formatNumberBRWithOptions(base.paybackMeses, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                      meses
                    </td>
                    <td>{formatMoneyBR(base.lucroLiquidoTotal)}</td>
                    <td>
                      <button type="button" className="link" onClick={() => onNavigateDetalhe(plano.id)}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  const renderDetalhe = () => {
    if (!detalhePlano) {
      return (
        <section className="config-card simulacao-lite-detalhe">
          <div className="simulacoes-lite-empty">
            <p>Simulação não encontrada. Volte para a lista e selecione outra.</p>
            <button type="button" onClick={onNavigateSalvas}>
              Voltar para simulações salvas
            </button>
          </div>
        </section>
      )
    }

    const handleExport = () => openSimulacaoLiteReport(detalhePlano, recomendacao)

    return (
      <section className="config-card simulacao-lite-detalhe">
        <div className="simulacao-lite-detalhe-header">
          <div>
            <h3>{detalhePlano.nome}</h3>
            <p>Resultados completos da simulação com cenários Base, Otimista e Pessimista.</p>
          </div>
          <div className="detalhe-actions">
            <button type="button" className="ghost" onClick={onNavigateSalvas}>
              Simulações salvas
            </button>
            <button type="button" className="ghost" onClick={onNavigateNova}>
              Nova simulação
            </button>
            <button type="button" onClick={handleExport}>
              Gerar relatório PDF
            </button>
          </div>
        </div>
        <div className="scenario-switcher">
          {SIMULACAO_LITE_SCENARIOS.map((option) => (
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
          {detalheKpis.map((kpi) => (
            <article key={kpi.label} className="kpi-card">
              <p>{kpi.label}</p>
              <strong>{kpi.value}</strong>
            </article>
          ))}
        </div>
        <div className="kpi-grid-lite secondary">
          {detalheKpisAvancadosList.map((kpi) => (
            <article key={kpi.label} className="kpi-card">
              <p>{kpi.label}</p>
              <strong>{kpi.value}</strong>
            </article>
          ))}
        </div>
        <div className="charts-lite">
          <RevenueCostProfitChartLite data={detalheSerieAno} />
          <TarifaForecastChartLite data={detalheSerieAno} />
          <RoiByYearChartLite data={detalheSerieAno} />
        </div>
        {recomendacao ? (
          <div className="recomendacao-lite">
            <h4>Sugestão de plano SolarInvest</h4>
            <p>{recomendacao.motivoResumo}</p>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <div className="simulacoes-lite-page">
      <div className="simulacoes-lite-page-header">
        <div>
          <h2>Simulações</h2>
          <p>{pageDescription}</p>
        </div>
        {mode === 'nova' ? (
          <button type="button" className="ghost" onClick={onNavigateSalvas} disabled={planos.length === 0}>
            Simulações salvas
          </button>
        ) : (
          <button type="button" className="ghost" onClick={onNavigateNova}>
            Nova simulação
          </button>
        )}
      </div>
      {mode === 'nova' ? <SimulacaoLitePanel /> : mode === 'salvas' ? renderSavedList() : renderDetalhe()}
    </div>
  )
}
