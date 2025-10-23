import React, { useEffect, useMemo, useRef, useState } from 'react'
import { labelWithTooltip } from '../InfoTooltip'

import {
  calcEconomiaContrato,
  calcEconomiaHorizonte,
  calcKPIs,
  calcSimulacaoDetalhesMensais,
  calcTarifaComDesconto,
  calcTusdEncargo,
  calcValorMercado,
  defaultTUSD,
  makeSimId,
  projectTarifaCheia,
  type PerfilConsumo,
  type Simulacao,
  type SimulationMonthlyDetail,
} from '../../lib/finance/simulation'
import type { TipoSistema } from '../../lib/finance/roi'
import {
  formatMoneyBR,
  formatNumberBR,
  formatNumberBRWithOptions,
  formatPercentBR,
  toNumberFlexible,
} from '../../lib/locale/br-number'
import { selectNumberInputOnFocus } from '../../utils/focusHandlers'
import { simulationsSelectors, useSimulationsStore } from '../../store/useSimulationsStore'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const TIPO_SISTEMA_OPTIONS: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID']
const TIPO_SISTEMA_LABELS: Record<TipoSistema, string> = {
  ON_GRID: 'On-grid',
  HIBRIDO: 'Híbrido',
  OFF_GRID: 'Off-grid',
}

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

type SimulacoesTabProps = {
  consumoKwhMes: number
  valorInvestimento: number
  tipoSistema: TipoSistema
  prazoLeasingAnos: number
}

export function SimulacoesTab({
  consumoKwhMes,
  valorInvestimento,
  tipoSistema,
  prazoLeasingAnos,
}: SimulacoesTabProps): JSX.Element {
  const simulations = useSimulationsStore(simulationsSelectors.list)
  const itemsById = useSimulationsStore((state) => state.items)
  const selectedIds = useSimulationsStore((state) => state.selectedIds)
  const addSimulation = useSimulationsStore((state) => state.add)
  const updateSimulation = useSimulationsStore((state) => state.update)
  const removeSimulation = useSimulationsStore((state) => state.remove)
  const duplicateSimulation = useSimulationsStore((state) => state.duplicate)
  const selectSimulations = useSimulationsStore((state) => state.select)
  const clearSelection = useSimulationsStore((state) => state.clearSelection)

  const [current, setCurrent] = useState<Simulacao>(() =>
    createDefaultSimulation({
      consumoKwhMes,
      valorInvestimento,
      prazoLeasingAnos,
      tipoSistema,
    }),
  )
  const [tusdTouched, setTusdTouched] = useState(false)
  const [comparisonHorizon, setComparisonHorizon] = useState<number>(30)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const defaultsRef = useRef(
    normalizeSimulationDefaults({ consumoKwhMes, valorInvestimento, prazoLeasingAnos, tipoSistema }),
  )

  const isSaved = Boolean(itemsById[current.id])

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

      return { ...prev, ...patch }
    })
  }, [consumoKwhMes, valorInvestimento, prazoLeasingAnos, tipoSistema, isSaved])

  const valorMercado = useMemo(() => calcValorMercado(current.capex_solarinvest), [current.capex_solarinvest])
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

  const comparisonRows = useMemo(() => {
    return selectedSimulations.map((sim) => {
      const tarifaDesconto = calcTarifaComDesconto(sim.tarifa_cheia_r_kwh_m1, sim.desconto_pct)
      const tusdResumo = calcTusdEncargo(sim, 1)
      const encargoTusd = tusdResumo.custoTUSD_Mes_R
      const indicadores = calcKPIs(sim)
      const economiaContratoSim = calcEconomiaContrato(sim)
      const economiaHorizon = calcEconomiaHorizonte(sim, comparisonHorizon)
      const detalhesMensais = calcSimulacaoDetalhesMensais(sim)
      return {
        sim,
        tarifaDesconto,
        encargoTusd,
        tusdResumo,
        indicadores,
        economiaContratoSim,
        economiaHorizon,
        detalhesMensais,
      }
    })
  }, [comparisonHorizon, selectedSimulations])

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

  const handleNewSimulation = () => {
    setCurrent(
      createDefaultSimulation({
        consumoKwhMes,
        valorInvestimento,
        prazoLeasingAnos,
        tipoSistema,
      }),
    )
    setTusdTouched(false)
  }

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
    } else {
      const payload = { ...sanitized, createdAt: now }
      addSimulation(payload)
      setCurrent(payload)
    }
  }

  const handleReset = () => {
    if (isSaved) {
      const stored = itemsById[current.id]
      if (stored) {
        setCurrent(cloneSimulation(stored))
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
      setCurrent(cloneSimulation(fallback))
      setTusdTouched(true)
    } else {
      handleNewSimulation()
    }
  }

  const handleDuplicate = () => {
    if (isSaved) {
      const duplicated = duplicateSimulation(current.id)
      if (duplicated) {
        setCurrent(cloneSimulation(duplicated))
        setTusdTouched(true)
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
    setCurrent(clone)
  }

  const handleLoadSimulation = (id: string) => {
    const stored = itemsById[id]
    if (!stored) {
      return
    }
    setCurrent(cloneSimulation(stored))
    setTusdTouched(true)
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

  return (
    <div className="simulations-tab">
      <div className="simulations-layout">
        <aside className="simulations-sidebar">
          <div className="simulations-sidebar-header">
            <h5>Simulações salvas</h5>
            <p>Gerencie cenários e compare resultados financeiros.</p>
          </div>
          <div className="simulations-scenario-list">
            {simulations.length === 0 ? (
              <p className="muted">Nenhuma simulação salva até o momento.</p>
            ) : (
              simulations.map((sim) => {
                const isActive = sim.id === current.id
                const isSelected = selectedIds.includes(sim.id)
                const displayName = sim.nome?.trim() || sim.id
                return (
                  <div key={sim.id} className={`simulations-scenario-card${isActive ? ' active' : ''}`}>
                    <button
                      type="button"
                      className="simulations-scenario-button"
                      onClick={() => handleLoadSimulation(sim.id)}
                    >
                      <strong>{displayName}</strong>
                      <small>Atualizado em {formatUpdatedAt(sim.updatedAt)}</small>
                    </button>
                    <label className={`simulations-select${isSelected ? ' checked' : ''}`}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelection(sim.id)}
                      />
                      <span>Comparar</span>
                    </label>
                  </div>
                )
              })
            )}
          </div>
          <div className="simulations-sidebar-actions">
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
        </aside>

        <div className="simulations-form-area">
          <section className="simulations-form-card">
            <header>
              <h4>Configurações da simulação</h4>
            </header>
            <div className="simulations-form-grid">
              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-nome">
                  {labelWithTooltip(
                    'Nome do cenário',
                    'Identificação do cenário exibida na lista lateral e no comparativo de resultados.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-nome"
                    type="text"
                    maxLength={80}
                    value={current.nome ?? ''}
                    onChange={handleTextChange('nome')}
                    placeholder="Ex.: Residencial | 60 meses"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-desconto">
                  {labelWithTooltip(
                    'Desconto SolarInvest (%)',
                    'Percentual de abatimento aplicado sobre a tarifa cheia. Tarifa com desconto = Tarifa cheia × (1 - desconto ÷ 100).',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-desconto"
                    type="number"
                    value={current.desconto_pct}
                    onChange={handleNumberChange('desconto_pct')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    max={100}
                    step="0.1"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-capex">
                  {labelWithTooltip(
                    'CAPEX SolarInvest (R$)',
                    'Investimento total previsto para o projeto. Valor de mercado estimado = CAPEX × 1,29.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-capex"
                    type="number"
                    value={current.capex_solarinvest}
                    onChange={handleNumberChange('capex_solarinvest')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    step="100"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-anos">
                  {labelWithTooltip(
                    'Anos de contrato',
                    'Prazo do contrato em anos. Meses simulados = Anos de contrato × 12.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-anos"
                    type="number"
                    value={current.anos_contrato}
                    onChange={handleNumberChange('anos_contrato')}
                    onFocus={selectNumberInputOnFocus}
                    min={1}
                    step="0.5"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-inflacao-energetica">
                  {labelWithTooltip(
                    'Inflação energética anual (% a.a.)',
                    'Reajuste esperado para a tarifa cheia. Tarifa projetada no mês m = Tarifa cheia mês 1 × (1 + inflação)^{(m-1)/12}.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-inflacao-energetica"
                    type="number"
                    value={current.inflacao_energetica_pct}
                    onChange={handleNumberChange('inflacao_energetica_pct')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    step="0.1"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-inflacao-ipca">
                  {labelWithTooltip(
                    'Inflação IPCA anual (% a.a.)',
                    'Premissa macroeconômica registrada junto ao cenário para análises externas e exportações. Valor informativo, sem impacto direto nos cálculos automáticos.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-inflacao-ipca"
                    type="number"
                    value={current.inflacao_ipca_pct}
                    onChange={handleNumberChange('inflacao_ipca_pct')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    step="0.1"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-tarifa-cheia">
                  {labelWithTooltip(
                    'Tarifa cheia (R$/kWh) - Mês 1',
                    'Tarifa sem desconto considerada no primeiro mês da simulação; ponto de partida para reajustes e cálculos de economia.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-tarifa-cheia"
                    type="number"
                    value={current.tarifa_cheia_r_kwh_m1}
                    onChange={handleNumberChange('tarifa_cheia_r_kwh_m1')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-consumo">
                  {labelWithTooltip(
                    'Consumo (kWh/mês)',
                    'Consumo médio mensal compensado pelo leasing. Receita mensal = Consumo × Tarifa com desconto; economia bruta = Consumo × (Tarifa cheia - Tarifa com desconto).',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-consumo"
                    type="number"
                    value={current.kc_kwh_mes}
                    onChange={handleNumberChange('kc_kwh_mes')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    step="10"
                  />
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-tipo-sistema">
                  {labelWithTooltip(
                    'Tipo de sistema',
                    'Classificação técnica do projeto (on-grid, híbrido ou off-grid). Ajuda a definir parâmetros de TUSD e regras de compensação.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <select className="cfg-input"
                    id="sim-tipo-sistema"
                    value={tipoSistemaAtual}
                    onChange={(event) =>
                      handleTipoSistemaChange(event.target.value as TipoSistema)
                    }
                  >
                    {TIPO_SISTEMA_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {TIPO_SISTEMA_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label">
                  {labelWithTooltip(
                    'Perfil de consumo',
                    'Categoria da unidade consumidora. Define o TUSD padrão sugerido e influencia simultaneidade e fator ano na TUSD.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <div className="radio-group">
                    <label>
                      <input 
                        type="radio"
                        name="perfil-consumo"
                        value="residencial"
                        checked={current.perfil_consumo === 'residencial'}
                        onChange={() => handlePerfilChange('residencial')}
                      />
                      Residencial
                    </label>
                    <label>
                      <input 
                        type="radio"
                        name="perfil-consumo"
                        value="comercial"
                        checked={current.perfil_consumo === 'comercial'}
                        onChange={() => handlePerfilChange('comercial')}
                      />
                      Comercial
                    </label>
                  </div>
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-tusd">
                  {labelWithTooltip(
                    'TUSD (%)',
                    'Percentual do fio B aplicado sobre a energia compensada. Encargo TUSD ≈ Consumo × Tarifa cheia × (TUSD ÷ 100) ajustado por simultaneidade e fator ano.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <div className="inline-field">
                    <input className="cfg-input"
                      id="sim-tusd"
                      type="number"
                      value={current.tusd_pct}
                      onChange={handleNumberChange('tusd_pct')}
                      onFocus={selectNumberInputOnFocus}
                      min={0}
                      step="0.1"
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setCurrent((prev) => ({ ...prev, tusd_pct: defaultTUSD(prev.perfil_consumo) }))
                        setTusdTouched(false)
                      }}
                    >
                      Aplicar padrão
                    </button>
                  </div>
                </div>
              </div>

              <div className="field cfg-field">
                <label className="field-label cfg-label" htmlFor="sim-seguro">
                  {labelWithTooltip(
                    'Seguro anual (% valor de mercado)',
                    'Percentual aplicado sobre o valor de mercado estimado. Seguro anual = Valor de mercado × (% ÷ 100); seguro mensal é rateado em 12 meses com reajuste de 1,2% a.a.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <input className="cfg-input"
                    id="sim-seguro"
                    type="number"
                    value={current.seguro_pct}
                    onChange={handleNumberChange('seguro_pct')}
                    onFocus={selectNumberInputOnFocus}
                    min={0}
                    step="0.1"
                  />
                </div>
              </div>

              <div className="field cfg-field field-textarea">
                <label className="field-label cfg-label" htmlFor="sim-obs">
                  {labelWithTooltip(
                    'Observações',
                    'Notas internas exibidas na tabela comparativa para contextualizar o cenário.',
                  )}
                </label>
                <div className="field-control cfg-control">
                  <textarea className="cfg-input"
                    id="sim-obs"
                    value={current.obs ?? ''}
                    onChange={handleTextChange('obs')}
                    rows={3}
                    placeholder="Informações adicionais sobre o cenário"
                  />
                </div>
              </div>
            </div>

            <div className="simulations-toggles">
              <label className="checkbox">
                <input 
                  type="checkbox"
                  checked={current.subtrair_tusd_contrato !== false}
                  onChange={handleToggle('subtrair_tusd_contrato')}
                />
                <span>
                  {labelWithTooltip(
                    'Subtrair TUSD da economia durante o contrato',
                    'Quando ativo, a economia líquida mensal considera Encargo TUSD = Economia bruta - Encargo TUSD calculado para cada mês do contrato.',
                  )}
                </span>
              </label>
              <label className="checkbox">
                <input 
                  type="checkbox"
                  checked={current.subtrair_tusd_pos_contrato !== false}
                  onChange={handleToggle('subtrair_tusd_pos_contrato')}
                />
                <span>
                  {labelWithTooltip(
                    'Subtrair TUSD no pós-contrato',
                    'Define se o comparativo após o término do leasing deduz a TUSD projetada (Economia pós-contrato = Consumo × Tarifa cheia - TUSD quando marcado).',
                  )}
                </span>
              </label>
            </div>
          </section>

          <section className="simulations-summary">
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
                    'Estimativa para recompra ao fim do contrato: Valor de mercado = CAPEX × 1,29.',
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
                  Simultaneidade {formatPercentBR(tusdResumoMes1.simultaneidadeUsada)} • Fator ano{' '}
                  {formatPercentBR(tusdResumoMes1.fatorAno)} •{' '}
                  {formatNumberBR(tusdResumoMes1.kWhCompensado)} kWh compensados
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

          <section className="simulations-economy">
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

          <section className="simulations-kpis">
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
                <span>
                  {labelWithTooltip('ROI', 'Retorno sobre o investimento: ROI = Lucro líquido ÷ CAPEX.')}
                </span>
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
        </div>
      </div>

      <section className="simulations-table">
        <div className="simulations-table-header">
          <div>
            <h5>Comparativo de cenários</h5>
            <p>Selecione os cenários desejados para gerar o comparativo.</p>
          </div>
          <div className="simulations-table-actions">
            <label htmlFor="economy-horizon">
              {labelWithTooltip(
                'Economia (anos)',
                'Seleciona o horizonte usado para calcular a coluna "Economia (N anos)" no comparativo.',
              )}
            </label>
            <select className="cfg-input"
              id="economy-horizon"
              value={comparisonHorizon}
              onChange={(event) => setComparisonHorizon(Number(event.target.value))}
            >
              {ECONOMIA_ANOS_OPTIONS.map((anos) => (
                <option key={anos} value={anos}>
                  {anos} anos
                </option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={clearSelection} disabled={selectedIds.length === 0}>
              Limpar seleção
            </button>
          </div>
        </div>

        {comparisonRows.length === 0 ? (
          <p className="muted simulations-empty">Selecione ao menos uma simulação salva para comparar.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="simulations-expand-header" aria-label="Expandir" />
                  <th>{labelWithTooltip('Cenário', 'Nome do cenário salvo usado para identificar cada linha do comparativo.')}</th>
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
                  <th>
                    {labelWithTooltip('Encargo TUSD', 'Encargo TUSD projetado para o primeiro mês da simulação.')}
                  </th>
                  <th>
                    {labelWithTooltip('Custos variáveis', 'Total de OPEX do cenário, composto principalmente pelo seguro.')}
                  </th>
                  <th>
                    {labelWithTooltip('Receita total', 'Soma das receitas mensais obtidas com a venda de energia.')}
                  </th>
                  <th>
                    {labelWithTooltip('Lucro líquido', 'Lucro líquido = Receita total - CAPEX - Custos variáveis.')}
                  </th>
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
                {comparisonRows.map(
                  ({
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
                        <tr className={isExpanded ? 'expanded' : undefined}>
                          <td className="simulations-expand-cell">
                            <button
                              type="button"
                              className="simulations-expand-button"
                              onClick={() => toggleExpandedRow(sim.id)}
                              aria-expanded={isExpanded}
                              aria-controls={detailRowId}
                              aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} cenário`}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="simulations-scenario-cell">{sim.nome?.trim() || sim.id}</td>
                          <td>{formatPercentBR(sim.desconto_pct / 100)}</td>
                          <td>
                            {formatNumberBRWithOptions(prazo, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td>{formatNumberBR(sim.kc_kwh_mes)}</td>
                          <td>{formatMoneyBR(tarifaCheia)}</td>
                          <td>{formatMoneyBR(tarifaDesconto)}</td>
                          <td>{formatMoneyBR(encargoTusd)}</td>
                          <td>{formatMoneyBR(indicadores.custosVariaveis)}</td>
                          <td>{formatMoneyBR(indicadores.receitaTotal)}</td>
                          <td>{formatMoneyBR(indicadores.lucroLiquido)}</td>
                          <td>{formatPercentValue(indicadores.roi)}</td>
                          <td>{formatPayback(indicadores.paybackMeses)}</td>
                          <td>{formatPercentValue(indicadores.retornoMensalBruto)}</td>
                          <td>{formatMoneyBR(economiaHorizon)}</td>
                          <td>{formatMoneyBR(economiaContratoSim)}</td>
                          <td>{sim.obs?.trim() || '—'}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="simulation-details-row">
                            <td className="simulations-expand-cell" />
                            <td colSpan={16} id={detailRowId}>
                              <SimulationDetailsTable detalhes={detalhesMensais} prazo={prazo} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

type SimulationDetailsTableProps = {
  detalhes: SimulationMonthlyDetail[]
  prazo: number
}

function SimulationDetailsTable({ detalhes, prazo }: SimulationDetailsTableProps): JSX.Element {
  const prazoLabel = formatNumberBRWithOptions(prazo, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  if (detalhes.length === 0) {
    return (
      <div className="simulation-details">
        <p className="simulation-details-empty">{`Nenhum mês disponível para o prazo de ${prazoLabel} meses.`}</p>
      </div>
    )
  }

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
        <table className="simulation-details-table">
          <thead>
            <tr>
              <th>{labelWithTooltip('Mês', 'Número sequencial do mês desde o início do contrato.')}</th>
              <th>
                {labelWithTooltip('Tarifa cheia', 'Tarifa projetada do mês considerando o reajuste energético informado.')}
              </th>
              <th>
                {labelWithTooltip('Tarifa c/ desconto', 'Tarifa cheia do mês × (1 - desconto ÷ 100).')}
              </th>
              <th>
                {labelWithTooltip('Encargo TUSD', 'Encargo TUSD calculado para o mês correspondente.')}
              </th>
              <th>
                {labelWithTooltip('Receita', 'Receita mensal = Consumo × Tarifa com desconto do mês.')}
              </th>
              <th>
                {labelWithTooltip('Custos variáveis', 'OPEX mensal, principalmente o seguro reajustado proporcionalmente.')}
              </th>
              <th>
                {labelWithTooltip('Economia bruta', 'Economia bruta = Consumo × (Tarifa cheia - Tarifa com desconto).')}
              </th>
              <th>
                {labelWithTooltip(
                  'Economia líquida',
                  'Economia líquida = Economia bruta - Encargo TUSD (quando o desconto de TUSD está habilitado).',
                )}
              </th>
              <th>
                {labelWithTooltip(
                  'Economia líquida acumulada',
                  'Somatório da economia líquida mês a mês até o período em questão.',
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {detalhes.map((detalhe) => (
              <tr key={detalhe.mes}>
                <td>
                  {formatNumberBRWithOptions(detalhe.mes, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td>{formatMoneyBR(detalhe.tarifaCheia)}</td>
                <td>{formatMoneyBR(detalhe.tarifaComDesconto)}</td>
                <td>{formatMoneyBR(detalhe.encargoTusd)}</td>
                <td>{formatMoneyBR(detalhe.receita)}</td>
                <td>{formatMoneyBR(detalhe.custosVariaveis)}</td>
                <td>{formatMoneyBR(detalhe.economiaBruta)}</td>
                <td>{formatMoneyBR(detalhe.economiaLiquida)}</td>
                <td>{formatMoneyBR(detalhe.economiaLiquidaAcumulada)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
