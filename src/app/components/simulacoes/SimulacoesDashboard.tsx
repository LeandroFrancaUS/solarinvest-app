import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { labelWithTooltip } from '../../../components/InfoTooltip'

import {
  calcEconomiaContrato,
  calcEconomiaHorizonte,
  calcCapexFromValorMercado,
  calcKPIs,
  calcTarifaComDesconto,
  calcTusdEncargo,
  calcValorMercado,
  defaultTUSD,
  makeSimId,
  projectTarifaCheia,
  type PerfilConsumo,
  type Simulacao,
  type SimulationMonthlyDetail,
} from '../../../lib/finance/simulation'
import type { TipoSistema } from '../../../lib/finance/roi'
import {
  formatMoneyBR,
  formatNumberBR,
  formatNumberBRWithOptions,
  formatPercentBR,
  toNumberFlexible,
} from '../../../lib/locale/br-number'
import { useBRNumberField } from '../../../lib/locale/useBRNumberField'
import { useSimulationsStore } from '../../../store/useSimulationsStore'
import { useSimulationComparisons } from './hooks/useSimulationComparisons'
import { FormSimulacao } from './FormSimulacao'
import { ListaSimulacoes } from './ListaSimulacoes'
import { ComparadorSimulacoes } from './ComparadorSimulacoes'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const formatUpdatedAt = (timestamp: number | undefined): string => {
  if (!timestamp) {
    return 'Nunca salvo'
  }
  try {
    return dateTimeFormatter.format(new Date(timestamp))
  } catch (error) {
    return '—'
  }
}

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

type SimulationDefaults = {
  consumoKwhMes: number
  valorInvestimento: number
  prazoLeasingAnos: number
  tipoSistema: TipoSistema
}

const normalizeSimulationDefaults = ({
  consumoKwhMes,
  valorInvestimento,
  prazoLeasingAnos,
  tipoSistema,
}: SimulationDefaults) => {
  const consumo = Number.isFinite(consumoKwhMes) ? Math.max(0, consumoKwhMes) : 0
  const capex = Number.isFinite(valorInvestimento) ? Math.max(0, valorInvestimento) : 0
  const prazo = Number.isFinite(prazoLeasingAnos) ? Math.max(0, prazoLeasingAnos) : 0
  return { consumo, capex, prazo, tipoSistema }
}

const createDefaultSimulation = ({
  consumoKwhMes,
  valorInvestimento,
  prazoLeasingAnos,
  tipoSistema,
}: SimulationDefaults): Simulacao => {
  const now = Date.now()
  const perfil: PerfilConsumo = 'residencial'
  const { consumo, capex, prazo, tipoSistema: tipo } = normalizeSimulationDefaults({
    consumoKwhMes,
    valorInvestimento,
    prazoLeasingAnos,
    tipoSistema,
  })
  return {
    id: makeSimId(),
    nome: 'Nova simulação',
    createdAt: now,
    updatedAt: now,
    desconto_pct: 20,
    capex_solarinvest: capex,
    anos_contrato: prazo,
    inflacao_energetica_pct: 8,
    inflacao_ipca_pct: 4,
    tarifa_cheia_r_kwh_m1: 1,
    kc_kwh_mes: consumo,
    perfil_consumo: perfil,
    tusd_pct: defaultTUSD(perfil),
    seguro_pct: 0.8,
    tipo_sistema: tipo,
    obs: '',
    subtrair_tusd_contrato: true,
    subtrair_tusd_pos_contrato: true,
  }
}

const cloneSimulation = (sim: Simulacao): Simulacao => ({ ...sim })

const ECONOMIA_ANOS_OPTIONS = [15, 20, 30] as const

export type SimulacoesSection = 'nova' | 'salvas' | 'comparar'

type SimulacoesDashboardProps = {
  consumoKwhMes: number
  valorInvestimento: number
  tipoSistema: TipoSistema
  prazoLeasingAnos: number
  section?: SimulacoesSection
  sectionRequestId?: number
}

const SIMULATION_DETAILS_ROW_HEIGHT = 48
const SIMULATION_DETAILS_VISIBLE_ROWS = 12
const SIMULATION_DETAILS_VIRTUALIZED_OVERSCAN = 4
const SIMULATION_DETAILS_COLUMN_COUNT = 9

export const SimulacoesDashboard = React.memo(function SimulacoesDashboard({
  consumoKwhMes,
  valorInvestimento,
  tipoSistema,
  prazoLeasingAnos,
  section,
  sectionRequestId,
}: SimulacoesDashboardProps): JSX.Element {
  const {
    itemsById,
    selectedIds,
    activeSimulationId,
    addSimulation,
    updateSimulation,
    removeSimulation,
    duplicateSimulation,
    selectSimulations,
    clearSelection,
    setActiveSimulation,
  } = useSimulationsStore(
    (state) => ({
      itemsById: state.items,
      selectedIds: state.selectedIds,
      activeSimulationId: state.activeId,
      addSimulation: state.add,
      updateSimulation: state.update,
      removeSimulation: state.remove,
      duplicateSimulation: state.duplicate,
      selectSimulations: state.select,
      clearSelection: state.clearSelection,
      setActiveSimulation: state.setActive,
    }),
    shallow,
  )

  const capexAutoRef = useRef<number | null>(null)

  const buildDefaultSimulation = useCallback(
    () =>
      createDefaultSimulation({
        consumoKwhMes,
        valorInvestimento,
        prazoLeasingAnos,
        tipoSistema,
      }),
    [consumoKwhMes, valorInvestimento, prazoLeasingAnos, tipoSistema],
  )

  const [current, setCurrent] = useState<Simulacao>(() => {
    const initial = buildDefaultSimulation()
    capexAutoRef.current = initial.capex_solarinvest
    return initial
  })
  const simulations = useMemo(
    () =>
      Object.values(itemsById)
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [itemsById],
  )
  const lastActiveRef = useRef<string | undefined>(undefined)
  const [tusdTouched, setTusdTouched] = useState(false)
  const [comparisonHorizon, setComparisonHorizon] = useState<number>(30)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const defaultsRef = useRef(
    normalizeSimulationDefaults({ consumoKwhMes, valorInvestimento, prazoLeasingAnos, tipoSistema }),
  )

  const isSaved = Boolean(itemsById[current.id])

  useEffect(() => {
    if (lastActiveRef.current === activeSimulationId) {
      return
    }

    lastActiveRef.current = activeSimulationId

    if (!activeSimulationId || activeSimulationId === 'new') {
      const fresh = buildDefaultSimulation()
      capexAutoRef.current = fresh.capex_solarinvest
      setCurrent(fresh)
      setTusdTouched(false)
      return
    }

    const stored = itemsById[activeSimulationId]
    if (stored) {
      const clone = cloneSimulation(stored)
      capexAutoRef.current = null
      setCurrent(clone)
      setTusdTouched(true)
    }
  }, [activeSimulationId, buildDefaultSimulation, itemsById])

  useEffect(() => {
    if (!tusdTouched && (!current.tusd_pct || current.tusd_pct <= 0)) {
      setCurrent((prev) => ({ ...prev, tusd_pct: defaultTUSD(prev.perfil_consumo) }))
    }
  }, [current.perfil_consumo, current.tusd_pct, tusdTouched])

  useEffect(() => {
    if (!current.tipo_sistema) {
      setCurrent((prev) => ({ ...prev, tipo_sistema: tipoSistema }))
    }
  }, [current.tipo_sistema, tipoSistema])

  useEffect(() => {
    const normalized = normalizeSimulationDefaults({
      consumoKwhMes,
      valorInvestimento,
      prazoLeasingAnos,
      tipoSistema,
    })
    const previous = defaultsRef.current ?? normalized
    defaultsRef.current = normalized

    if (isSaved) {
      return
    }

    setCurrent((prev) => {
      const patch: Partial<Simulacao> = {}
      if (prev.kc_kwh_mes === previous.consumo && prev.kc_kwh_mes !== normalized.consumo) {
        patch.kc_kwh_mes = normalized.consumo
      }
      if (
        prev.capex_solarinvest === previous.capex &&
        prev.capex_solarinvest !== normalized.capex
      ) {
        patch.capex_solarinvest = normalized.capex
      }
      if (prev.anos_contrato === previous.prazo && prev.anos_contrato !== normalized.prazo) {
        patch.anos_contrato = normalized.prazo
      }
      if (
        (!prev.tipo_sistema || prev.tipo_sistema === previous.tipoSistema) &&
        prev.tipo_sistema !== normalized.tipoSistema
      ) {
        patch.tipo_sistema = normalized.tipoSistema
      }

      if (Object.keys(patch).length === 0) {
        return prev
      }

      if (patch.capex_solarinvest !== undefined) {
        capexAutoRef.current = patch.capex_solarinvest
      }

      return { ...prev, ...patch }
    })
  }, [consumoKwhMes, valorInvestimento, prazoLeasingAnos, tipoSistema, isSaved])

  useEffect(() => {
    if (capexAutoRef.current == null) {
      return
    }

    const defaults = defaultsRef.current
    const baseConsumo = defaults?.consumo && defaults.consumo > 0 ? defaults.consumo : consumoKwhMes
    const baseCapex = defaults?.capex && defaults.capex > 0 ? defaults.capex : valorInvestimento

    if (!Number.isFinite(baseConsumo) || baseConsumo <= 0) {
      return
    }
    if (!Number.isFinite(baseCapex) || baseCapex <= 0) {
      return
    }
    if (!Number.isFinite(current.kc_kwh_mes) || current.kc_kwh_mes <= 0) {
      return
    }

    const ratio = baseCapex / baseConsumo
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return
    }

    const nextCapex = ratio * current.kc_kwh_mes
    if (!Number.isFinite(nextCapex) || Math.abs(current.capex_solarinvest - nextCapex) < 0.5) {
      return
    }

    setCurrent((prev) => {
      if (Math.abs(prev.capex_solarinvest - nextCapex) < 0.5) {
        return prev
      }
      capexAutoRef.current = nextCapex
      return { ...prev, capex_solarinvest: nextCapex }
    })
  }, [current.kc_kwh_mes, consumoKwhMes, valorInvestimento])

  const valorMercado = useMemo(() => calcValorMercado(current.capex_solarinvest), [current.capex_solarinvest])
  const handleValorMercadoInputChange = useCallback(
    (valor: number | null) => {
      const valorMercadoInput = Number.isFinite(valor ?? NaN) ? Number(valor) : 0
      const capexNormalizado = calcCapexFromValorMercado(valorMercadoInput)
      capexAutoRef.current = null
      setCurrent((prev) => ({
        ...prev,
        capex_solarinvest: capexNormalizado,
      }))
    },
    [setCurrent, calcCapexFromValorMercado],
  )
  const valorMercadoField = useBRNumberField({
    mode: 'money',
    value: valorMercado,
    onChange: handleValorMercadoInputChange,
  })
  const tarifaComDesconto = useMemo(
    () => calcTarifaComDesconto(current.tarifa_cheia_r_kwh_m1, current.desconto_pct),
    [current.tarifa_cheia_r_kwh_m1, current.desconto_pct],
  )
  const tusdResumoMes1 = useMemo(
    () => calcTusdEncargo(current, 1),
    [
      current.kc_kwh_mes,
      current.tarifa_cheia_r_kwh_m1,
      current.tusd_pct,
      current.tusd_tipo_cliente,
      current.tusd_subtipo,
      current.tusd_simultaneidade,
      current.tusd_tarifa_r_kwh,
      current.tusd_ano_referencia,
      current.perfil_consumo,
      current.tipo_sistema,
      current.inflacao_energetica_pct,
    ],
  )
  const encargoTusdMes1 = tusdResumoMes1.custoTUSD_Mes_R
  const seguroAnualBase = useMemo(
    () => valorMercado * (Number.isFinite(current.seguro_pct) ? current.seguro_pct / 100 : 0),
    [valorMercado, current.seguro_pct],
  )
  const economiaContrato = useMemo(() => calcEconomiaContrato(current), [current])
  const economia15 = useMemo(() => calcEconomiaHorizonte(current, 15), [current])
  const economia20 = useMemo(() => calcEconomiaHorizonte(current, 20), [current])
  const economia30 = useMemo(() => calcEconomiaHorizonte(current, 30), [current])
  const kpis = useMemo(() => calcKPIs(current), [current])

  const selectedSimulations = useMemo(
    () =>
      selectedIds
        .map((id) => itemsById[id])
        .filter((sim): sim is Simulacao => Boolean(sim))
        .map((sim) => cloneSimulation(sim)),
    [itemsById, selectedIds],
  )

  const comparisonRows = useSimulationComparisons(selectedSimulations, comparisonHorizon)

  useEffect(() => {
    setExpandedRows((prev) => {
      const next: Record<string, boolean> = {}
      for (const sim of selectedSimulations) {
        if (prev[sim.id]) {
          next[sim.id] = true
        }
      }
      return next
    })
  }, [selectedSimulations])

  const toggleExpandedRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = true
      }
      return next
    })
  }

  const handleNumberChange = (field: keyof Simulacao) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = toNumberFlexible(event.target.value)
    const value = parsed ?? 0
    setCurrent((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (field === 'tusd_pct') {
      setTusdTouched(true)
    }
  }

  const handleTextChange = (field: 'nome' | 'obs') => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value
    setCurrent((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePerfilChange = (perfil: PerfilConsumo) => {
    setCurrent((prev) => {
      const shouldAutofill = !tusdTouched || prev.tusd_pct <= 0
      return {
        ...prev,
        perfil_consumo: perfil,
        tusd_pct: shouldAutofill ? defaultTUSD(perfil) : prev.tusd_pct,
      }
    })
  }

  const handleTipoSistemaChange = (novoTipo: TipoSistema) => {
    setCurrent((prev) => ({
      ...prev,
      tipo_sistema: novoTipo,
    }))
  }

  const handleToggle = (field: 'subtrair_tusd_contrato' | 'subtrair_tusd_pos_contrato') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setCurrent((prev) => ({
        ...prev,
        [field]: event.target.checked,
      }))
    }

  const handleNewSimulation = useCallback(() => {
    const next = buildDefaultSimulation()
    capexAutoRef.current = next.capex_solarinvest
    setCurrent(next)
    setTusdTouched(false)
    setActiveSimulation('new')
    lastActiveRef.current = 'new'
  }, [buildDefaultSimulation, setActiveSimulation])

  const sanitizeSimulationForSave = (sim: Simulacao, timestamp: number): Simulacao => {
    const { nome, obs, ...rest } = sim
    const trimmedNome = nome?.trim()
    const trimmedObs = obs?.trim()
    return {
      ...rest,
      ...(trimmedNome ? { nome: trimmedNome } : {}),
      ...(trimmedObs ? { obs: trimmedObs } : {}),
      updatedAt: timestamp,
    }
  }

  const handleSave = () => {
    const now = Date.now()
    const sanitized = sanitizeSimulationForSave(current, now)
    if (isSaved) {
      updateSimulation(current.id, sanitized)
      setCurrent(sanitized)
      setActiveSimulation(current.id)
      lastActiveRef.current = current.id
    } else {
      const payload = { ...sanitized, createdAt: now }
      addSimulation(payload)
      setCurrent(payload)
      setActiveSimulation(payload.id)
      lastActiveRef.current = payload.id
    }
  }

  const handleReset = () => {
    if (isSaved) {
      const stored = itemsById[current.id]
      if (stored) {
        const clone = cloneSimulation(stored)
        capexAutoRef.current = null
        setCurrent(clone)
        setTusdTouched(true)
        return
      }
    }
    handleNewSimulation()
  }

  const handleDelete = () => {
    if (!isSaved) {
      handleNewSimulation()
      return
    }
    const previousList = simulations
    const index = previousList.findIndex((sim) => sim.id === current.id)
    removeSimulation(current.id)
    const fallback = previousList.filter((sim) => sim.id !== current.id)[Math.max(0, index - 1)]
    if (fallback) {
      const clone = cloneSimulation(fallback)
      capexAutoRef.current = null
      setCurrent(clone)
      setTusdTouched(true)
      setActiveSimulation(fallback.id)
      lastActiveRef.current = fallback.id
    } else {
      handleNewSimulation()
    }
  }

  const handleDuplicate = () => {
    if (isSaved) {
      const duplicated = duplicateSimulation(current.id)
      if (duplicated) {
        const clone = cloneSimulation(duplicated)
        capexAutoRef.current = null
        setCurrent(clone)
        setTusdTouched(true)
        lastActiveRef.current = duplicated.id
      }
      return
    }
    const now = Date.now()
    const { nome, ...rest } = current
    const clone: Simulacao = {
      ...rest,
      ...(nome ? { nome: `${nome} (cópia)` } : {}),
      id: makeSimId(),
      createdAt: now,
      updatedAt: now,
    }
    capexAutoRef.current = null
    setCurrent(clone)
    setActiveSimulation('new')
    lastActiveRef.current = 'new'
  }

  const handleToggleSelection = (id: string) => {
    const alreadySelected = selectedIds.includes(id)
    if (alreadySelected) {
      selectSimulations(selectedIds.filter((selectedId) => selectedId !== id))
    } else {
      selectSimulations([...selectedIds, id])
    }
  }

  const prazoMeses = Math.max(0, Math.round(current.anos_contrato * 12))
  const tarifaCheiaMes1 = projectTarifaCheia(current.tarifa_cheia_r_kwh_m1, current.inflacao_energetica_pct, 1)
  const tipoSistemaAtual = current.tipo_sistema ?? tipoSistema
  const configuracoesRef = useRef<HTMLDivElement | null>(null)
  const salvasRef = useRef<HTMLDivElement | null>(null)
  const comparadorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!section) {
      return
    }
    const target =
      section === 'nova' ? configuracoesRef.current : section === 'salvas' ? salvasRef.current : comparadorRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [section, sectionRequestId])

  return (
    <div className="simulacoes-panel">
      <header className="simulacoes-panel__header">
        <div className="simulacoes-panel__heading">
          <h2>{current.nome?.trim() || 'Nova simulação'}</h2>
          <p>
            {isSaved ? `Última atualização ${formatUpdatedAt(current.updatedAt)}` : 'Simulação ainda não salva'}
          </p>
        </div>
        <div className="simulacoes-action-bar">
          <button type="button" className="secondary" onClick={handleNewSimulation}>
            Nova simulação
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            Salvar
          </button>
          <button type="button" className="secondary" onClick={handleDuplicate}>
            Duplicar
          </button>
          <button type="button" className="secondary danger" onClick={handleDelete}>
            Excluir
          </button>
          <button type="button" className="secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      <div ref={configuracoesRef}>
        <FormSimulacao
          simulation={current}
          tipoSistemaAtual={tipoSistemaAtual}
          valorMercadoField={valorMercadoField}
          onNumberChange={handleNumberChange}
          onTextChange={handleTextChange}
          onPerfilChange={handlePerfilChange}
          onTipoSistemaChange={handleTipoSistemaChange}
          onToggle={handleToggle}
        />
      </div>

      <section className="result-section simulations-summary">
        <header>
          <h4>Resumo financeiro</h4>
        </header>
        <div className="simulations-summary-grid">
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Tarifa cheia (mês 1)',
                'Tarifa sem desconto considerada no primeiro mês antes dos reajustes mensais compostos.',
              )}
            </span>
            <strong>{formatMoneyBR(tarifaCheiaMes1)}</strong>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Tarifa com desconto (mês 1)',
                'Resultado da fórmula Tarifa com desconto = Tarifa cheia × (1 - desconto ÷ 100).',
              )}
            </span>
            <strong>{formatMoneyBR(tarifaComDesconto)}</strong>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Valor de mercado',
                'Estimativa para recompra ao fim do contrato. CAPEX considerado nos cálculos = Valor de mercado ÷ 1,29.',
              )}
            </span>
            <strong>{formatMoneyBR(valorMercado)}</strong>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Seguro anual (1º ano)',
                'Prêmio anual calculado a partir do percentual de seguro: Seguro anual = Valor de mercado × (% ÷ 100).',
              )}
            </span>
            <strong>{formatMoneyBR(seguroAnualBase)}</strong>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Encargo TUSD (mês 1)',
                'Encargo calculado para o mês inicial considerando consumo, simultaneidade e peso TUSD.',
              )}
            </span>
            <strong>{formatMoneyBR(encargoTusdMes1)}</strong>
            <small>
              Simultaneidade {formatPercentBR(tusdResumoMes1.simultaneidadeUsada)} • Fator ano {formatPercentBR(tusdResumoMes1.fatorAno)} • {formatNumberBR(tusdResumoMes1.kWhCompensado)} kWh compensados
            </small>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Economia acumulada no contrato',
                'Somatório da economia líquida dos meses do contrato + Valor de mercado + Custos variáveis recuperados.',
              )}
            </span>
            <strong>{formatMoneyBR(economiaContrato)}</strong>
          </div>
        </div>
      </section>

      <section className="result-section simulations-economy">
        <header>
          <h4>Economia projetada</h4>
        </header>
        <div className="simulations-summary-grid">
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Economia em 15 anos',
                'Projeção de calcEconomiaHorizonte para 15 anos: economia do contrato + economia pós-contrato até o ano 15, respeitando a opção de subtrair TUSD.',
              )}
            </span>
            <strong>{formatMoneyBR(economia15)}</strong>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Economia em 20 anos',
                'Cálculo idêntico ao de 15 anos, estendendo a projeção até o ano 20.',
              )}
            </span>
            <strong>{formatMoneyBR(economia20)}</strong>
          </div>
          <div className="simulations-summary-card">
            <span>
              {labelWithTooltip(
                'Economia em 30 anos',
                'Economia contratual somada à economia projetada para o pós-contrato até completar 30 anos.',
              )}
            </span>
            <strong>{formatMoneyBR(economia30)}</strong>
          </div>
        </div>
      </section>

      <section className="result-section simulations-kpis">
        <header>
          <h4>KPIs SolarInvest</h4>
        </header>
        <div className="simulations-kpi-grid">
          <div className="simulations-kpi-card">
            <span>
              {labelWithTooltip(
                'Receita total',
                'Somatório da receita mensal: Receita mês = Consumo × Tarifa com desconto.',
              )}
            </span>
            <strong>{formatMoneyBR(kpis.receitaTotal)}</strong>
          </div>
          <div className="simulations-kpi-card">
            <span>
              {labelWithTooltip(
                'Custos variáveis (OPEX)',
                'Despesa operacional acumulada, majoritariamente seguro mensal reajustado ano a ano.',
              )}
            </span>
            <strong>{formatMoneyBR(kpis.custosVariaveis)}</strong>
          </div>
          <div className="simulations-kpi-card">
            <span>
              {labelWithTooltip(
                'Lucro líquido',
                'Lucro líquido = Receita total - CAPEX - Custos variáveis.',
              )}
            </span>
            <strong>{formatMoneyBR(kpis.lucroLiquido)}</strong>
          </div>
          <div className="simulations-kpi-card">
            <span>{labelWithTooltip('ROI', 'Retorno sobre o investimento: ROI = Lucro líquido ÷ CAPEX.')}</span>
            <strong>{formatPercentValue(kpis.roi)}</strong>
          </div>
          <div className="simulations-kpi-card">
            <span>
              {labelWithTooltip(
                'Payback (meses)',
                'Menor mês em que o acumulado de (Receita mensal - OPEX mensal) atinge o CAPEX investido.',
              )}
            </span>
            <strong>{formatPayback(kpis.paybackMeses)}</strong>
          </div>
          <div className="simulations-kpi-card">
            <span>
              {labelWithTooltip(
                'Retorno a.m. bruto',
                'Taxa equivalente mensal do ROI: (1 + ROI)^{1/meses do contrato} - 1.',
              )}
            </span>
            <strong>{formatPercentValue(kpis.retornoMensalBruto)}</strong>
          </div>
        </div>
      </section>

      <div ref={salvasRef}>
        <ListaSimulacoes
          simulations={simulations}
          selectedIds={selectedIds}
          activeSimulationId={activeSimulationId}
          onToggleSelection={handleToggleSelection}
          formatUpdatedAt={formatUpdatedAt}
        />
      </div>

      <div ref={comparadorRef}>
        <ComparadorSimulacoes
          rows={comparisonRows}
          comparisonHorizon={comparisonHorizon}
          horizonOptions={ECONOMIA_ANOS_OPTIONS}
          onChangeHorizon={(value) => setComparisonHorizon(value)}
          onClearSelection={clearSelection}
          selectedCount={selectedIds.length}
          expandedRows={expandedRows}
          onToggleRow={toggleExpandedRow}
        />
      </div>
    </div>
  )
})
