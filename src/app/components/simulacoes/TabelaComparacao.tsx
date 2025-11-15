import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { labelWithTooltip } from '../../../components/InfoTooltip'
import {
  formatMoneyBR,
  formatNumberBR,
  formatNumberBRWithOptions,
  formatPercentBR,
} from '../../../lib/locale/br-number'
import { projectTarifaCheia } from '../../../lib/finance/simulation'
import type { SimulationComparisonResult } from '../../../workers/simulationWorker'

const SIMULATION_DETAILS_ROW_HEIGHT = 48
const SIMULATION_DETAILS_VISIBLE_ROWS = 12
const SIMULATION_DETAILS_VIRTUALIZED_OVERSCAN = 4
const SIMULATION_DETAILS_COLUMN_COUNT = 9

const formatPercentValue = (value: number): string => {
  if (!Number.isFinite(value) || value <= -1) {
    return '—'
  }
  return formatPercentBR(value)
}

const formatPayback = (payback: number): string => {
  if (!Number.isFinite(payback) || payback <= 0) {
    return '—'
  }
  return formatNumberBRWithOptions(payback, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type TabelaComparacaoProps = {
  rows: SimulationComparisonResult[]
  comparisonHorizon: number
  expandedRows: Record<string, boolean>
  onToggleRow: (id: string) => void
}

export function TabelaComparacao({ rows, comparisonHorizon, expandedRows, onToggleRow }: TabelaComparacaoProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <div className="tabela-comparacao-wrapper" role="region" aria-label="Comparativo de cenários">
      <div className="tabela-comparacao-scroll">
        <table className="tabela-comparacao">
          <thead>
            <tr>
              <th className="cenario-col">
                {labelWithTooltip('Cenário', 'Nome do cenário salvo usado para identificar cada linha do comparativo.')}
              </th>
              <th>
                {labelWithTooltip(
                  'Desconto',
                  'Percentual de desconto aplicado sobre a tarifa cheia. Tarifa com desconto = Tarifa cheia × (1 - desconto ÷ 100).',
                )}
              </th>
              <th>
                {labelWithTooltip('Prazo (meses)', 'Prazo total do contrato em meses: Anos × 12.')}
              </th>
              <th>
                {labelWithTooltip('Consumo (kWh/mês)', 'Consumo médio mensal utilizado em todas as projeções financeiras.')}
              </th>
              <th>
                {labelWithTooltip('Tarifa cheia (mês 1)', 'Tarifa sem desconto considerada no primeiro mês.')}
              </th>
              <th>
                {labelWithTooltip(
                  'Tarifa com desconto (mês 1)',
                  'Tarifa cheia do mês 1 com o desconto contratado aplicado.',
                )}
              </th>
              <th>{labelWithTooltip('Encargo TUSD', 'Encargo TUSD projetado para o primeiro mês da simulação.')}</th>
              <th>{labelWithTooltip('Custos variáveis', 'Total de OPEX do cenário, composto principalmente pelo seguro.')}</th>
              <th>{labelWithTooltip('Receita total', 'Soma das receitas mensais obtidas com a venda de energia.')}</th>
              <th>{labelWithTooltip('Lucro líquido', 'Lucro líquido = Receita total - CAPEX - Custos variáveis.')}</th>
              <th>{labelWithTooltip('ROI', 'Lucro líquido dividido pelo CAPEX investido.')}</th>
              <th>
                {labelWithTooltip('Payback', 'Menor mês em que o fluxo acumulado iguala ou supera o CAPEX investido.')}
              </th>
              <th>
                {labelWithTooltip(
                  'Retorno a.m. bruto',
                  'Taxa mensal equivalente do ROI: (1 + ROI)^{1/meses do contrato} - 1.',
                )}
              </th>
              <th>
                {labelWithTooltip(
                  `Economia (${comparisonHorizon} anos)`,
                  'Resultado de calcEconomiaHorizonte usando o horizonte selecionado acima.',
                )}
              </th>
              <th>
                {labelWithTooltip(
                  'Economia acumulada',
                  'Valor retornado por calcEconomiaContrato: economia líquida do contrato + valor de mercado + OPEX recuperado.',
                )}
              </th>
              <th>{labelWithTooltip('Observações', 'Notas livres registradas no cenário.')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({
              sim,
              tarifaDesconto,
              encargoTusd,
              indicadores,
              economiaContratoSim,
              economiaHorizon,
              detalhesMensais,
            }) => {
              const prazo = Math.max(0, Math.round(sim.anos_contrato * 12))
              const tarifaCheia = projectTarifaCheia(sim.tarifa_cheia_r_kwh_m1, sim.inflacao_energetica_pct, 1)
              const isExpanded = Boolean(expandedRows[sim.id])
              const detailRowId = `sim-details-${sim.id}`
              return (
                <React.Fragment key={sim.id}>
                  <tr className={isExpanded ? 'is-expanded' : undefined}>
                    <td className="cenario-col">
                      <button
                        type="button"
                        className="simulations-expand-button"
                        onClick={() => onToggleRow(sim.id)}
                        aria-expanded={isExpanded}
                        aria-controls={detailRowId}
                        aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} cenário`}
                      >
                        {isExpanded ? '−' : '+'}
                      </button>
                      <div className="cenario-col__info">
                        <strong>{sim.nome?.trim() || sim.id}</strong>
                        <small>
                          {formatNumberBRWithOptions(prazo, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} meses •{' '}
                          {formatNumberBR(sim.kc_kwh_mes)} kWh/mês
                        </small>
                      </div>
                    </td>
                    <td className="is-numeric">{formatPercentBR(sim.desconto_pct / 100)}</td>
                    <td className="is-numeric">
                      {formatNumberBRWithOptions(prazo, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="is-numeric">{formatNumberBR(sim.kc_kwh_mes)}</td>
                    <td className="is-numeric">{formatMoneyBR(tarifaCheia)}</td>
                    <td className="is-numeric">{formatMoneyBR(tarifaDesconto)}</td>
                    <td className="is-numeric">{formatMoneyBR(encargoTusd)}</td>
                    <td className="is-numeric">{formatMoneyBR(indicadores.custosVariaveis)}</td>
                    <td className="is-numeric">{formatMoneyBR(indicadores.receitaTotal)}</td>
                    <td className="is-numeric">{formatMoneyBR(indicadores.lucroLiquido)}</td>
                    <td className="is-numeric">{formatPercentValue(indicadores.roi)}</td>
                    <td className="is-numeric">{formatPayback(indicadores.paybackMeses)}</td>
                    <td className="is-numeric">{formatPercentValue(indicadores.retornoMensalBruto)}</td>
                    <td className="is-numeric">{formatMoneyBR(economiaHorizon)}</td>
                    <td className="is-numeric">{formatMoneyBR(economiaContratoSim)}</td>
                    <td>{sim.obs?.trim() || '—'}</td>
                  </tr>
                  {isExpanded ? (
                    <tr className="simulation-details-row">
                      <td className="cenario-col details" />
                      <td colSpan={15} id={detailRowId}>
                        <SimulationDetailsTable detalhes={detalhesMensais} prazo={prazo} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type SimulationDetailsTableProps = {
  detalhes: SimulationComparisonResult['detalhesMensais']
  prazo: number
}

const SimulationDetailsTable = React.memo(function SimulationDetailsTable({
  detalhes,
  prazo,
}: SimulationDetailsTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const viewportHeight = useMemo(() => {
    return Math.max(
      SIMULATION_DETAILS_ROW_HEIGHT,
      Math.min(SIMULATION_DETAILS_VISIBLE_ROWS, detalhes.length) * SIMULATION_DETAILS_ROW_HEIGHT,
    )
  }, [detalhes.length])

  const totalHeight = detalhes.length * SIMULATION_DETAILS_ROW_HEIGHT
  const shouldVirtualize = totalHeight > viewportHeight

  const prazoLabel = formatNumberBRWithOptions(prazo, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  useEffect(() => {
    if (!shouldVirtualize && scrollTop !== 0) {
      setScrollTop(0)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
      return
    }

    if (!shouldVirtualize) {
      return
    }

    const maxScrollTop = Math.max(0, totalHeight - viewportHeight)
    if (scrollTop > maxScrollTop && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = maxScrollTop
      setScrollTop(maxScrollTop)
    }
  }, [scrollTop, shouldVirtualize, totalHeight, viewportHeight])

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!shouldVirtualize) {
        if (event.currentTarget.scrollTop !== 0) {
          event.currentTarget.scrollTop = 0
        }
        return
      }

      setScrollTop(event.currentTarget.scrollTop)
    },
    [shouldVirtualize],
  )

  const { startIndex, endIndex } = useMemo(() => {
    if (!shouldVirtualize) {
      return { startIndex: 0, endIndex: detalhes.length }
    }

    const firstVisibleIndex = Math.floor(scrollTop / SIMULATION_DETAILS_ROW_HEIGHT)
    const lastVisibleIndex = Math.ceil((scrollTop + viewportHeight) / SIMULATION_DETAILS_ROW_HEIGHT)

    return {
      startIndex: Math.max(0, firstVisibleIndex - SIMULATION_DETAILS_VIRTUALIZED_OVERSCAN),
      endIndex: Math.min(detalhes.length, lastVisibleIndex + SIMULATION_DETAILS_VIRTUALIZED_OVERSCAN),
    }
  }, [detalhes.length, scrollTop, shouldVirtualize, viewportHeight])

  const visibleRows = useMemo(() => detalhes.slice(startIndex, endIndex), [detalhes, startIndex, endIndex])

  const topSpacerHeight = shouldVirtualize ? startIndex * SIMULATION_DETAILS_ROW_HEIGHT : 0
  const bottomSpacerHeight = shouldVirtualize ? (detalhes.length - endIndex) * SIMULATION_DETAILS_ROW_HEIGHT : 0

  const renderSpacerRow = (key: string, height: number) => (
    <tr aria-hidden="true" className="simulation-details-spacer-row" key={key} style={{ height }}>
      <td
        colSpan={SIMULATION_DETAILS_COLUMN_COUNT}
        style={{
          padding: 0,
          border: 'none',
          background: 'transparent',
          height,
        }}
      />
    </tr>
  )

  return (
    <div className="simulation-details">
      <div className="simulation-details-header">
        <strong>
          {labelWithTooltip(
            'Detalhamento mensal',
            'Tabela com os fluxos financeiros calculados mês a mês a partir do cenário selecionado.',
          )}
        </strong>
        <span>
          {labelWithTooltip(
            `Prazo (meses): ${prazoLabel}`,
            'Quantidade total de meses considerada no contrato para gerar as linhas abaixo.',
          )}
        </span>
      </div>
      <div className="simulation-details-table-wrapper">
        <div
          className="simulation-details-table-scroll"
          onScroll={handleScroll}
          ref={scrollContainerRef}
          style={{ maxHeight: viewportHeight, overflowY: 'auto', width: '100%' }}
        >
          <table className="simulation-details-table">
            <thead>
              <tr>
                <th>{labelWithTooltip('Mês', 'Número sequencial do mês desde o início do contrato.')}</th>
                <th>
                  {labelWithTooltip(
                    'Tarifa cheia',
                    'Tarifa projetada do mês considerando o reajuste energético informado.',
                  )}
                </th>
                <th>
                  {labelWithTooltip('Tarifa c/ desconto', 'Tarifa cheia do mês × (1 - desconto ÷ 100).')}
                </th>
                <th>{labelWithTooltip('Encargo TUSD', 'Encargo TUSD calculado para o mês correspondente.')}</th>
                <th>{labelWithTooltip('Receita', 'Receita mensal = Consumo × Tarifa com desconto do mês.')}</th>
                <th>
                  {labelWithTooltip(
                    'Custos variáveis',
                    'OPEX mensal, principalmente o seguro reajustado proporcionalmente.',
                  )}
                </th>
                <th>
                  {labelWithTooltip(
                    'Economia bruta',
                    'Economia bruta = Consumo × (Tarifa cheia - Tarifa com desconto).',
                  )}
                </th>
                <th>
                  {labelWithTooltip('Economia líquida', 'Economia bruta - Encargo TUSD (se aplicável).')}
                </th>
                <th>
                  {labelWithTooltip(
                    'Acumulado',
                    'Soma acumulada da economia líquida subtraindo o CAPEX até o mês correspondente.',
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 ? renderSpacerRow('top', topSpacerHeight) : null}
              {visibleRows.map((detalhe) => (
                <tr key={detalhe.mes}>
                  <td>{formatNumberBRWithOptions(detalhe.mes, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td>{formatMoneyBR(detalhe.tarifaCheia)}</td>
                  <td>{formatMoneyBR(detalhe.tarifaComDesconto)}</td>
                  <td>{formatMoneyBR(detalhe.encargoTusd)}</td>
                  <td>{formatMoneyBR(detalhe.receita)}</td>
                  <td>{formatMoneyBR(detalhe.custos)}</td>
                  <td>{formatMoneyBR(detalhe.economiaBruta)}</td>
                  <td>{formatMoneyBR(detalhe.economiaLiquida)}</td>
                  <td>{formatMoneyBR(detalhe.economiaAcumulada)}</td>
                </tr>
              ))}
              {bottomSpacerHeight > 0 ? renderSpacerRow('bottom', bottomSpacerHeight) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})
