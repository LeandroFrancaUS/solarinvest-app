import React, { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  DEFAULT_TUSD_CONFIG,
  formatYYYYMM,
  getCurrentYearMonth,
  parseYYYYMM,
  runSimulations,
  type SimulationInput,
  type SimulationResult,
} from '../../lib/simulacoes/calculadora'
import {
  formatMoneyBR,
  formatNumberBR,
  formatNumberBRWithOptions,
  toNumberFlexible,
} from '../../lib/locale/br-number'
import { formatAxis } from '../../utils/formatters'
import { selectNumberInputOnFocus } from '../../utils/focusHandlers'

type SimulationScenarioForm = {
  id: string
  label: string
  desconto: string
  capex: string
  anos: string
  inflacaoEnergeticaAA: string
  ipcaAA: string
  tarifaCheiaInicial: string
  tarifaComDesconto: string
  indexarTarifaComDesconto: boolean
  kcKWhMes: string
  omMensal: string
  seguroMensal: string
  inicioYYYYMM: string
}

type ScenarioFieldKey = keyof SimulationScenarioForm

type ScenarioErrors = Partial<Record<ScenarioFieldKey, string>>

type SortOption = 'lucroLiquido' | 'roiPercent' | 'paybackMeses' | 'receitaTotal'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'lucroLiquido', label: 'Lucro líquido (maior primeiro)' },
  { value: 'roiPercent', label: 'ROI do projeto (maior primeiro)' },
  { value: 'paybackMeses', label: 'Payback (menor primeiro)' },
  { value: 'receitaTotal', label: 'Receita total (maior primeiro)' },
]

const DEFAULT_SCENARIO_VALUES = {
  desconto: '20',
  capex: '40000',
  anos: '5',
  inflacaoEnergeticaAA: '8',
  ipcaAA: '4',
  tarifaCheiaInicial: '1',
  tarifaComDesconto: '',
  kcKWhMes: '400',
  omMensal: '0',
  seguroMensal: '0',
}

const createScenarioId = () => `sim-${Math.random().toString(36).slice(2, 10)}`

const createDefaultScenario = (index: number): SimulationScenarioForm => {
  const defaultDate = formatYYYYMM(getCurrentYearMonth())
  return {
    id: createScenarioId(),
    label: `Cenário ${index}`,
    desconto: DEFAULT_SCENARIO_VALUES.desconto,
    capex: DEFAULT_SCENARIO_VALUES.capex,
    anos: DEFAULT_SCENARIO_VALUES.anos,
    inflacaoEnergeticaAA: DEFAULT_SCENARIO_VALUES.inflacaoEnergeticaAA,
    ipcaAA: DEFAULT_SCENARIO_VALUES.ipcaAA,
    tarifaCheiaInicial: DEFAULT_SCENARIO_VALUES.tarifaCheiaInicial,
    tarifaComDesconto: DEFAULT_SCENARIO_VALUES.tarifaComDesconto,
    indexarTarifaComDesconto: true,
    kcKWhMes: DEFAULT_SCENARIO_VALUES.kcKWhMes,
    omMensal: DEFAULT_SCENARIO_VALUES.omMensal,
    seguroMensal: DEFAULT_SCENARIO_VALUES.seguroMensal,
    inicioYYYYMM: defaultDate,
  }
}

const toPercentDisplay = (value: number) =>
  `${formatNumberBRWithOptions(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

const toMonthsDisplay = (value: number | null, totalMeses: number) => {
  if (value == null) {
    return `> ${totalMeses}`
  }
  return formatNumberBRWithOptions(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

const tooltipFormatter = (value: number) => formatMoneyBR(value)

const monthFormatter = (index: number) => `M${index}`

const parsePositiveNumber = (value: string, allowZero = false) => {
  const parsed = toNumberFlexible(value)
  if (parsed == null) return null
  if (parsed < 0 || (!allowZero && parsed === 0)) return null
  return parsed
}

const parseNonNegativeNumber = (value: string) => {
  const parsed = toNumberFlexible(value)
  if (parsed == null) return null
  if (parsed < 0) return null
  return parsed
}

const sanitizeLabel = (label: string, fallback: string) => {
  const trimmed = label.trim()
  return trimmed || fallback
}

const buildSimulationInput = (
  scenario: SimulationScenarioForm,
  fallbackLabel: string,
): { input?: SimulationInput; errors: ScenarioErrors } => {
  const errors: ScenarioErrors = {}

  const descontoPct = parseNonNegativeNumber(scenario.desconto)
  if (descontoPct == null) {
    errors.desconto = 'Informe um percentual válido.'
  } else if (descontoPct > 100) {
    errors.desconto = 'O desconto deve estar entre 0% e 100%.'
  }

  const anos = parsePositiveNumber(scenario.anos)
  if (anos == null) {
    errors.anos = 'Informe um prazo em anos maior que zero.'
  }

  const capex = parsePositiveNumber(scenario.capex)
  if (capex == null) {
    errors.capex = 'CAPEX inválido.'
  }

  const inflacaoEnergeticaAA = parseNonNegativeNumber(scenario.inflacaoEnergeticaAA)
  if (inflacaoEnergeticaAA == null) {
    errors.inflacaoEnergeticaAA = 'Informe a inflação energética anual.'
  }

  const ipcaAA = parseNonNegativeNumber(scenario.ipcaAA)
  if (ipcaAA == null) {
    errors.ipcaAA = 'Informe o IPCA anual.'
  }

  const tarifaCheiaInicial = parsePositiveNumber(scenario.tarifaCheiaInicial, true)
  if (tarifaCheiaInicial == null) {
    errors.tarifaCheiaInicial = 'Tarifa cheia inválida.'
  }

  const tarifaComDesconto = scenario.tarifaComDesconto
    ? parsePositiveNumber(scenario.tarifaComDesconto, true)
    : undefined
  if (scenario.tarifaComDesconto && tarifaComDesconto == null) {
    errors.tarifaComDesconto = 'Tarifa com desconto inválida.'
  }

  if (
    tarifaCheiaInicial != null &&
    tarifaComDesconto != null &&
    tarifaComDesconto > tarifaCheiaInicial
  ) {
    errors.tarifaComDesconto = 'A tarifa com desconto não pode exceder a tarifa cheia.'
  }

  const kcKWhMes = parsePositiveNumber(scenario.kcKWhMes)
  if (kcKWhMes == null) {
    errors.kcKWhMes = 'Informe um piso contratual em kWh/mês.'
  }

  const omMensal = scenario.omMensal ? parseNonNegativeNumber(scenario.omMensal) : 0
  if (scenario.omMensal && omMensal == null) {
    errors.omMensal = 'Valor de O&M inválido.'
  }

  const seguroMensal = scenario.seguroMensal ? parseNonNegativeNumber(scenario.seguroMensal) : 0
  if (scenario.seguroMensal && seguroMensal == null) {
    errors.seguroMensal = 'Valor do seguro inválido.'
  }

  const inicio = parseYYYYMM(scenario.inicioYYYYMM)
  if (!inicio) {
    errors.inicioYYYYMM = 'Data de início inválida (use AAAA-MM).'
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  const label = sanitizeLabel(scenario.label, fallbackLabel)

  const input: SimulationInput = {
    id: scenario.id,
    label,
    desconto: (descontoPct ?? 0) / 100,
    capex: capex ?? 0,
    anos: Math.max(1, Math.round(anos ?? 1)),
    inflacaoEnergeticaAA: (inflacaoEnergeticaAA ?? 0) / 100,
    ipcaAA: (ipcaAA ?? 0) / 100,
    tarifaCheiaInicial: tarifaCheiaInicial ?? 0,
    indexarTarifaComDesconto: scenario.indexarTarifaComDesconto,
    kcKWhMes: kcKWhMes ?? 0,
    omMensal: omMensal ?? 0,
    seguroMensal: seguroMensal ?? 0,
    inicioYYYYMM: scenario.inicioYYYYMM,
  }

  if (tarifaComDesconto != null) {
    input.tarifaComDesconto = tarifaComDesconto
  }

  return { input, errors }
}

const getSortMetric = (result: SimulationResult, sort: SortOption) => {
  switch (sort) {
    case 'lucroLiquido':
      return result.kpi.lucroLiquido
    case 'roiPercent':
      return result.kpi.roiPercent
    case 'paybackMeses':
      return result.kpi.paybackMeses ?? Infinity
    case 'receitaTotal':
      return result.kpi.receitaTotal
    default:
      return result.kpi.lucroLiquido
  }
}

const sortResults = (results: SimulationResult[], sort: SortOption) => {
  const sorted = [...results]
  sorted.sort((a, b) => {
    const valueA = getSortMetric(a, sort)
    const valueB = getSortMetric(b, sort)

    if (sort === 'paybackMeses') {
      return valueA - valueB
    }

    return valueB - valueA
  })
  return sorted
}

const formatEconomiaLabel = (value: number) => formatMoneyBR(value)

const formatObservacoes = (result: SimulationResult) => {
  const partes = [] as string[]
  partes.push(`Indexa T desc: ${result.input.indexarTarifaComDesconto ? 'sim' : 'não'}`)
  const possuiCustos = (result.input.omMensal ?? 0) > 0 || (result.input.seguroMensal ?? 0) > 0
  partes.push(`O&M/Seguro: ${possuiCustos ? 'sim' : 'não'}`)
  return partes.join(' | ')
}

const formatMonthLabel = (month: number | null, totalMeses?: number) => {
  if (month == null || !Number.isFinite(month)) {
    if (Number.isFinite(totalMeses)) {
      return `> ${formatNumberBRWithOptions(totalMeses ?? 0, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} meses`
    }
    return 'Sem payback no prazo'
  }

  return `${formatNumberBRWithOptions(month, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}º mês`
}

const SimulationTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div className="simulations-chart-tooltip">
      <strong>{monthFormatter(label as number)}</strong>
      <ul>
        {payload.map((entry: any) => (
          <li key={entry.dataKey}>
            <span>{entry.name}:</span> <strong>{tooltipFormatter(entry.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SimulacoesTab(): JSX.Element {
  const [scenarios, setScenarios] = useState<SimulationScenarioForm[]>([
    createDefaultScenario(1),
  ])
  const [activeScenarioId, setActiveScenarioId] = useState<string>(scenarios[0]?.id ?? '')
  const [sortOption, setSortOption] = useState<SortOption>('lucroLiquido')
  const [results, setResults] = useState<SimulationResult[]>([])
  const [errors, setErrors] = useState<Record<string, ScenarioErrors>>({})

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0]

  const handleUpdateScenario = (id: string, field: ScenarioFieldKey, value: string | boolean) => {
    setScenarios((prev) =>
      prev.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              [field]: typeof value === 'boolean' ? value : value,
            }
          : scenario,
      ),
    )

    setErrors((prev) => {
      const scenarioErrors = prev[id]
      if (!scenarioErrors) {
        return prev
      }
      const { [field]: _removed, ...rest } = scenarioErrors
      return { ...prev, [id]: rest }
    })
  }

  const handleAddScenario = () => {
    setScenarios((prev) => {
      const nextIndex = prev.length + 1
      const novo = createDefaultScenario(nextIndex)
      setActiveScenarioId(novo.id)
      return [...prev, novo]
    })
  }

  const handleDuplicateScenario = () => {
    const base = activeScenario
    if (!base) return
    setScenarios((prev) => {
      const novo: SimulationScenarioForm = {
        ...base,
        id: createScenarioId(),
        label: `${sanitizeLabel(base.label, 'Cenário')} (cópia)`,
      }
      setActiveScenarioId(novo.id)
      return [...prev, novo]
    })
  }

  const handleRemoveScenario = () => {
    if (scenarios.length <= 1) {
      return
    }
    setScenarios((prev) => {
      const filtered = prev.filter((scenario) => scenario.id !== activeScenarioId)
      const nextActive = filtered[filtered.length - 1]
      setActiveScenarioId(nextActive?.id ?? '')
      setErrors((current) => {
        const { [activeScenarioId]: _removed, ...rest } = current
        return rest
      })
      return filtered
    })
    setResults((prev) => prev.filter((result) => result.input.id !== activeScenarioId))
  }

  const handleReset = () => {
    const primeiro = createDefaultScenario(1)
    setScenarios([primeiro])
    setActiveScenarioId(primeiro.id)
    setResults([])
    setErrors({})
  }

  const handleRun = () => {
    const aggregateErrors: Record<string, ScenarioErrors> = {}
    const inputs: SimulationInput[] = []

    scenarios.forEach((scenario, index) => {
      const fallback = `Cenário ${index + 1}`
      const { input, errors: scenarioErrors } = buildSimulationInput(scenario, fallback)
      if (Object.keys(scenarioErrors).length > 0 || !input) {
        aggregateErrors[scenario.id] = scenarioErrors
        return
      }
      inputs.push({ ...input, label: sanitizeLabel(scenario.label, fallback) })
    })

    setErrors(aggregateErrors)

    if (Object.keys(aggregateErrors).length > 0) {
      return
    }

    const computed = runSimulations(inputs, DEFAULT_TUSD_CONFIG)
    setResults(computed)
  }

  const sortedResults = useMemo(() => sortResults(results, sortOption), [results, sortOption])

  const activeResult = results.find((result) => result.input.id === activeScenario?.id)

  const chartData = useMemo(() => {
    if (!activeResult) {
      return []
    }
    return activeResult.meses.map((mes) => ({
      mes: mes.mesIndex,
      receita: mes.receitaBruta,
      custos: mes.om + mes.seguro,
      acumulado: mes.acumuladoLiquido,
    }))
  }, [activeResult])

  const handleExportCsv = () => {
    if (sortedResults.length === 0) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const header = [
      'Cenário',
      'Desconto (%)',
      'Prazo (meses)',
      'Kc (kWh/mês)',
      'Tarifa cheia (mês 1)',
      'Tarifa com desconto (mês 1)',
      'Receita total (R$)',
      'Custos variáveis (R$)',
      'Lucro líquido (R$)',
      'ROI (%)',
      'Payback (meses)',
      'Retorno bruto a.m. (%)',
      'Economia cliente mês 1 (R$)',
      'Economia cliente acumulada (R$)',
      'Encargo TUSD total (R$)',
      'Observações',
    ]

    const rows = sortedResults.map((result) => {
      const mesesTotais = result.meses.length
      const tarifaDescontoMes1 = result.meses[0]?.tarifaDesconto ?? 0
      const linha = [
        sanitizeLabel(result.input.label ?? '', 'Cenário'),
        toPercentDisplay(result.input.desconto * 100),
        formatNumberBRWithOptions(mesesTotais, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        formatNumberBR(result.input.kcKWhMes),
        formatMoneyBR(result.input.tarifaCheiaInicial),
        formatMoneyBR(tarifaDescontoMes1),
        formatMoneyBR(result.kpi.receitaTotal),
        formatMoneyBR(result.kpi.custosVariaveisTotais),
        formatMoneyBR(result.kpi.lucroLiquido),
        toPercentDisplay(result.kpi.roiPercent),
        toMonthsDisplay(result.kpi.paybackMeses, mesesTotais),
        toPercentDisplay(result.kpi.retornoMesBrutoPercent),
        formatMoneyBR(result.kpi.economiaClienteMes1),
        formatMoneyBR(result.kpi.economiaClienteAcumulada),
        formatMoneyBR(result.kpi.tusdTotal),
        formatObservacoes(result),
      ]
      return linha.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')
    })

    const csvContent = [header.join(';'), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `simulacoes-solarinvest-${Date.now()}.csv`
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="simulations-tab">
      <div className="simulations-layout">
        <aside className="simulations-sidebar" aria-label="Cenários cadastrados">
          <div className="simulations-sidebar-header">
            <h5>Cenários</h5>
            <p>Adicione variações para comparar resultados lado a lado.</p>
          </div>
          <div className="simulations-scenario-list">
            {scenarios.map((scenario, index) => {
              const label = sanitizeLabel(scenario.label, `Cenário ${index + 1}`)
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={`simulations-scenario-button${
                    scenario.id === activeScenario?.id ? ' active' : ''
                  }`}
                  onClick={() => setActiveScenarioId(scenario.id)}
                >
                  <span>{label}</span>
                  <small>{formatNumberBRWithOptions(Number(scenario.anos) * 12 || 0, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })} meses</small>
                </button>
              )
            })}
          </div>
          <div className="simulations-sidebar-actions">
            <button type="button" onClick={handleAddScenario} className="secondary">
              + Adicionar cenário
            </button>
            <button type="button" onClick={handleDuplicateScenario} className="secondary">
              Duplicar cenário
            </button>
            <button
              type="button"
              onClick={handleRemoveScenario}
              className="secondary danger"
              disabled={scenarios.length <= 1}
            >
              Remover cenário
            </button>
          </div>
        </aside>

        {activeScenario ? (
          <div className="simulations-form-area">
            <div className="simulations-form-grid">
              <div className="field">
                <label htmlFor="simulation-label">Nome do cenário</label>
                <input
                  id="simulation-label"
                  type="text"
                  maxLength={60}
                  value={activeScenario.label}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'label', event.target.value)}
                  placeholder="Ex.: 60 meses | 20% desconto"
                />
              </div>

              <div className="field">
                <label htmlFor="simulation-desconto">Desconto SolarInvest (%)</label>
                <input
                  id="simulation-desconto"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={activeScenario.desconto}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'desconto', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.desconto)}
                />
                {errors[activeScenario.id]?.desconto ? (
                  <span className="field-error">{errors[activeScenario.id]?.desconto}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-capex">CAPEX SolarInvest (R$)</label>
                <input
                  id="simulation-capex"
                  type="number"
                  min={0}
                  step="100"
                  value={activeScenario.capex}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'capex', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.capex)}
                />
                {errors[activeScenario.id]?.capex ? (
                  <span className="field-error">{errors[activeScenario.id]?.capex}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-anos">Prazo (anos)</label>
                <input
                  id="simulation-anos"
                  type="number"
                  min={1}
                  step="1"
                  value={activeScenario.anos}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'anos', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.anos)}
                />
                {errors[activeScenario.id]?.anos ? (
                  <span className="field-error">{errors[activeScenario.id]?.anos}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-inflacao-energetica">Inflação energética anual (% a.a.)</label>
                <input
                  id="simulation-inflacao-energetica"
                  type="number"
                  min={0}
                  step="0.1"
                  value={activeScenario.inflacaoEnergeticaAA}
                  onChange={(event) =>
                    handleUpdateScenario(activeScenario.id, 'inflacaoEnergeticaAA', event.target.value)
                  }
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.inflacaoEnergeticaAA)}
                />
                {errors[activeScenario.id]?.inflacaoEnergeticaAA ? (
                  <span className="field-error">{errors[activeScenario.id]?.inflacaoEnergeticaAA}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-ipca">Inflação IPCA anual (% a.a.)</label>
                <input
                  id="simulation-ipca"
                  type="number"
                  min={0}
                  step="0.1"
                  value={activeScenario.ipcaAA}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'ipcaAA', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.ipcaAA)}
                />
                {errors[activeScenario.id]?.ipcaAA ? (
                  <span className="field-error">{errors[activeScenario.id]?.ipcaAA}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-tarifa-cheia">Tarifa cheia (R$/kWh)</label>
                <input
                  id="simulation-tarifa-cheia"
                  type="number"
                  min={0}
                  step="0.001"
                  value={activeScenario.tarifaCheiaInicial}
                  onChange={(event) =>
                    handleUpdateScenario(activeScenario.id, 'tarifaCheiaInicial', event.target.value)
                  }
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.tarifaCheiaInicial)}
                />
                {errors[activeScenario.id]?.tarifaCheiaInicial ? (
                  <span className="field-error">{errors[activeScenario.id]?.tarifaCheiaInicial}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-tarifa-desconto">Tarifa com desconto (R$/kWh)</label>
                <input
                  id="simulation-tarifa-desconto"
                  type="number"
                  min={0}
                  step="0.001"
                  value={activeScenario.tarifaComDesconto}
                  onChange={(event) =>
                    handleUpdateScenario(activeScenario.id, 'tarifaComDesconto', event.target.value)
                  }
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.tarifaComDesconto)}
                  placeholder="Se vazio, usa tarifa cheia - desconto"
                />
                {errors[activeScenario.id]?.tarifaComDesconto ? (
                  <span className="field-error">{errors[activeScenario.id]?.tarifaComDesconto}</span>
                ) : null}
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={activeScenario.indexarTarifaComDesconto}
                    onChange={(event) =>
                      handleUpdateScenario(activeScenario.id, 'indexarTarifaComDesconto', event.target.checked)
                    }
                  />
                  Indexar tarifa com desconto pelos reajustes anuais
                </label>
              </div>

              <div className="field">
                <label htmlFor="simulation-kc">Energia contratada Kc (kWh/mês)</label>
                <input
                  id="simulation-kc"
                  type="number"
                  min={0}
                  step="1"
                  value={activeScenario.kcKWhMes}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'kcKWhMes', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.kcKWhMes)}
                />
                {errors[activeScenario.id]?.kcKWhMes ? (
                  <span className="field-error">{errors[activeScenario.id]?.kcKWhMes}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-om">O&amp;M mensal (R$/mês)</label>
                <input
                  id="simulation-om"
                  type="number"
                  min={0}
                  step="10"
                  value={activeScenario.omMensal}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'omMensal', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.omMensal)}
                />
                {errors[activeScenario.id]?.omMensal ? (
                  <span className="field-error">{errors[activeScenario.id]?.omMensal}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-seguro">Seguro mensal (R$/mês)</label>
                <input
                  id="simulation-seguro"
                  type="number"
                  min={0}
                  step="10"
                  value={activeScenario.seguroMensal}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'seguroMensal', event.target.value)}
                  onFocus={selectNumberInputOnFocus}
                  aria-invalid={Boolean(errors[activeScenario.id]?.seguroMensal)}
                />
                {errors[activeScenario.id]?.seguroMensal ? (
                  <span className="field-error">{errors[activeScenario.id]?.seguroMensal}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="simulation-inicio">Data de início (AAAA-MM)</label>
                <input
                  id="simulation-inicio"
                  type="month"
                  value={activeScenario.inicioYYYYMM}
                  onChange={(event) => handleUpdateScenario(activeScenario.id, 'inicioYYYYMM', event.target.value)}
                  aria-invalid={Boolean(errors[activeScenario.id]?.inicioYYYYMM)}
                />
                {errors[activeScenario.id]?.inicioYYYYMM ? (
                  <span className="field-error">{errors[activeScenario.id]?.inicioYYYYMM}</span>
                ) : null}
              </div>
            </div>

            <div className="simulations-actions">
              <button type="button" className="primary" onClick={handleRun}>
                Rodar simulação
              </button>
              <button type="button" className="secondary" onClick={handleReset}>
                Limpar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {activeResult ? (
        <div className="simulations-results">
          <div className="simulations-kpi-cards">
            <div className="simulations-kpi-card">
              <span>Receita bruta total</span>
              <strong>{formatMoneyBR(activeResult.kpi.receitaTotal)}</strong>
            </div>
            <div className="simulations-kpi-card">
              <span>Lucro líquido do projeto</span>
              <strong>{formatMoneyBR(activeResult.kpi.lucroLiquido)}</strong>
            </div>
            <div className="simulations-kpi-card">
              <span>ROI do projeto</span>
              <strong>{toPercentDisplay(activeResult.kpi.roiPercent)}</strong>
            </div>
            <div className="simulations-kpi-card">
              <span>Payback estimado</span>
              <strong>
                {formatMonthLabel(activeResult.kpi.paybackMeses, activeResult.meses.length)}
              </strong>
            </div>
            <div className="simulations-kpi-card">
              <span>Retorno bruto ao mês</span>
              <strong>{toPercentDisplay(activeResult.kpi.retornoMesBrutoPercent)}</strong>
            </div>
            <div className="simulations-kpi-card">
              <span>Economia cliente (mês 1)</span>
              <strong>{formatEconomiaLabel(activeResult.kpi.economiaClienteMes1)}</strong>
            </div>
            <div className="simulations-kpi-card">
              <span>Economia acumulada (prazo)</span>
              <strong>{formatEconomiaLabel(activeResult.kpi.economiaClienteAcumulada)}</strong>
            </div>
            <div className="simulations-kpi-card">
              <span>Encargo TUSD estimado</span>
              <strong>{formatMoneyBR(activeResult.kpi.tusdTotal)}</strong>
            </div>
          </div>

          <div className="simulations-chart">
            <header>
              <h5>Fluxos mensais</h5>
              <p>
                Receita bruta, custos variáveis (O&amp;M/seguro) e fluxo líquido acumulado para o
                cenário selecionado.
              </p>
            </header>
            {chartData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="mes" tickFormatter={monthFormatter} stroke="#cbd5f5" />
                    <YAxis tickFormatter={formatAxis} stroke="#cbd5f5" width={100} />
                    <Tooltip content={<SimulationTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="receita" stroke="#22d3ee" dot={false} name="Receita" />
                    <Line type="monotone" dataKey="custos" stroke="#f97316" dot={false} name="Custos" />
                    <Line
                      type="monotone"
                      dataKey="acumulado"
                      stroke="#a855f7"
                      dot={false}
                      name="Fluxo acumulado"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="muted">Rodando a simulação exibe o comportamento mensal aqui.</p>
            )}
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="simulations-table">
          <div className="simulations-table-header">
            <div>
              <h5>Comparativo de cenários</h5>
              <p>Ordene pelo indicador desejado e exporte para CSV.</p>
            </div>
            <div className="simulations-table-actions">
              <label htmlFor="simulation-sort">Ordenar por</label>
              <select
                id="simulation-sort"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary" onClick={handleExportCsv}>
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cenário</th>
                  <th>Desconto</th>
                  <th>Prazo (meses)</th>
                  <th>Kc (kWh/mês)</th>
                  <th>Tarifa cheia (mês 1)</th>
                  <th>Tarifa com desconto (mês 1)</th>
                  <th>Receita total</th>
                  <th>Custos variáveis</th>
                  <th>Lucro líquido</th>
                  <th>ROI</th>
                  <th>Payback</th>
                  <th>Retorno a.m. bruto</th>
                  <th>Economia cliente (mês 1)</th>
                  <th>Economia acumulada</th>
                  <th>Encargo TUSD</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((result) => {
                  const mesesTotais = result.meses.length
                  const tarifaDescontoMes1 = result.meses[0]?.tarifaDesconto ?? 0
                  const isActive = result.input.id === activeScenario?.id
                  return (
                    <tr key={result.input.id} className={isActive ? 'active' : undefined}>
                      <td>{sanitizeLabel(result.input.label ?? '', 'Cenário')}</td>
                      <td>{toPercentDisplay(result.input.desconto * 100)}</td>
                      <td>
                        {formatNumberBRWithOptions(mesesTotais, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td>{formatNumberBR(result.input.kcKWhMes)}</td>
                      <td>{formatMoneyBR(result.input.tarifaCheiaInicial)}</td>
                      <td>{formatMoneyBR(tarifaDescontoMes1)}</td>
                      <td>{formatMoneyBR(result.kpi.receitaTotal)}</td>
                      <td>{formatMoneyBR(result.kpi.custosVariaveisTotais)}</td>
                      <td>{formatMoneyBR(result.kpi.lucroLiquido)}</td>
                      <td>{toPercentDisplay(result.kpi.roiPercent)}</td>
                      <td>{toMonthsDisplay(result.kpi.paybackMeses, mesesTotais)}</td>
                      <td>{toPercentDisplay(result.kpi.retornoMesBrutoPercent)}</td>
                      <td>{formatMoneyBR(result.kpi.economiaClienteMes1)}</td>
                      <td>{formatMoneyBR(result.kpi.economiaClienteAcumulada)}</td>
                      <td>{formatMoneyBR(result.kpi.tusdTotal)}</td>
                      <td>{formatObservacoes(result)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="muted simulations-empty">Inclua um ou mais cenários e rode a simulação para ver o comparativo.</p>
      )}
    </div>
  )
}

