import React, { useEffect, useMemo, useState } from 'react'

import {
  calcEconomiaContrato,
  calcEconomiaHorizonte,
  calcKPIs,
  calcTarifaComDesconto,
  calcTUSDValue,
  calcValorMercado,
  defaultTUSD,
  makeSimId,
  projectTarifaCheia,
  type PerfilConsumo,
  type Simulacao,
} from '../../lib/finance/simulation'
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

const createDefaultSimulation = (): Simulacao => {
  const now = Date.now()
  const perfil: PerfilConsumo = 'residencial'
  return {
    id: makeSimId(),
    nome: 'Nova simulação',
    createdAt: now,
    updatedAt: now,
    desconto_pct: 20,
    capex_solarinvest: 40000,
    anos_contrato: 5,
    inflacao_energetica_pct: 8,
    inflacao_ipca_pct: 4,
    tarifa_cheia_r_kwh_m1: 1,
    kc_kwh_mes: 400,
    perfil_consumo: perfil,
    tusd_pct: defaultTUSD(perfil),
    seguro_pct: 0.8,
    obs: '',
    subtrair_tusd_contrato: true,
    subtrair_tusd_pos_contrato: true,
  }
}

const cloneSimulation = (sim: Simulacao): Simulacao => ({ ...sim })

const ECONOMIA_ANOS_OPTIONS = [15, 20, 30] as const

export function SimulacoesTab(): JSX.Element {
  const simulations = useSimulationsStore(simulationsSelectors.list)
  const itemsById = useSimulationsStore((state) => state.items)
  const selectedIds = useSimulationsStore((state) => state.selectedIds)
  const addSimulation = useSimulationsStore((state) => state.add)
  const updateSimulation = useSimulationsStore((state) => state.update)
  const removeSimulation = useSimulationsStore((state) => state.remove)
  const duplicateSimulation = useSimulationsStore((state) => state.duplicate)
  const selectSimulations = useSimulationsStore((state) => state.select)
  const clearSelection = useSimulationsStore((state) => state.clearSelection)

  const [current, setCurrent] = useState<Simulacao>(() => createDefaultSimulation())
  const [tusdTouched, setTusdTouched] = useState(false)
  const [comparisonHorizon, setComparisonHorizon] = useState<number>(30)

  const isSaved = Boolean(itemsById[current.id])

  useEffect(() => {
    if (!tusdTouched && (!current.tusd_pct || current.tusd_pct <= 0)) {
      setCurrent((prev) => ({ ...prev, tusd_pct: defaultTUSD(prev.perfil_consumo) }))
    }
  }, [current.perfil_consumo, current.tusd_pct, tusdTouched])

  const valorMercado = useMemo(() => calcValorMercado(current.capex_solarinvest), [current.capex_solarinvest])
  const tarifaComDesconto = useMemo(
    () => calcTarifaComDesconto(current.tarifa_cheia_r_kwh_m1, current.desconto_pct),
    [current.tarifa_cheia_r_kwh_m1, current.desconto_pct],
  )
  const encargoTusdMes1 = useMemo(
    () => calcTUSDValue(current.kc_kwh_mes, current.tarifa_cheia_r_kwh_m1, current.tusd_pct),
    [current.kc_kwh_mes, current.tarifa_cheia_r_kwh_m1, current.tusd_pct],
  )
  const seguroMensal = useMemo(
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
      const encargoTusd = calcTUSDValue(sim.kc_kwh_mes, sim.tarifa_cheia_r_kwh_m1, sim.tusd_pct)
      const indicadores = calcKPIs(sim)
      const economiaContratoSim = calcEconomiaContrato(sim)
      const economiaHorizon = calcEconomiaHorizonte(sim, comparisonHorizon)
      return {
        sim,
        tarifaDesconto,
        encargoTusd,
        indicadores,
        economiaContratoSim,
        economiaHorizon,
      }
    })
  }, [comparisonHorizon, selectedSimulations])

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

  const handleToggle = (field: 'subtrair_tusd_contrato' | 'subtrair_tusd_pos_contrato') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setCurrent((prev) => ({
        ...prev,
        [field]: event.target.checked,
      }))
    }

  const handleNewSimulation = () => {
    setCurrent(createDefaultSimulation())
    setTusdTouched(false)
  }

  const sanitizeSimulationForSave = (sim: Simulacao, timestamp: number): Simulacao => {
    const nome = sim.nome?.trim()
    const obs = sim.obs?.trim()
    return {
      ...sim,
      nome: nome ? nome : undefined,
      obs: obs ? obs : undefined,
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
    const clone: Simulacao = {
      ...current,
      id: makeSimId(),
      nome: current.nome ? `${current.nome} (cópia)` : current.nome,
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
                    <label className="simulations-select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelection(sim.id)}
                      />
                      Comparar
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
              <div className="field">
                <label htmlFor="sim-nome">Nome do cenário</label>
                <input
                  id="sim-nome"
                  type="text"
                  maxLength={80}
                  value={current.nome ?? ''}
                  onChange={handleTextChange('nome')}
                  placeholder="Ex.: Residencial | 60 meses"
                />
              </div>

              <div className="field">
                <label htmlFor="sim-desconto">Desconto SolarInvest (%)</label>
                <input
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

              <div className="field">
                <label htmlFor="sim-capex">CAPEX SolarInvest (R$)</label>
                <input
                  id="sim-capex"
                  type="number"
                  value={current.capex_solarinvest}
                  onChange={handleNumberChange('capex_solarinvest')}
                  onFocus={selectNumberInputOnFocus}
                  min={0}
                  step="100"
                />
              </div>

              <div className="field">
                <label htmlFor="sim-anos">Anos de contrato</label>
                <input
                  id="sim-anos"
                  type="number"
                  value={current.anos_contrato}
                  onChange={handleNumberChange('anos_contrato')}
                  onFocus={selectNumberInputOnFocus}
                  min={1}
                  step="1"
                />
              </div>

              <div className="field">
                <label htmlFor="sim-inflacao-energetica">Inflação energética anual (% a.a.)</label>
                <input
                  id="sim-inflacao-energetica"
                  type="number"
                  value={current.inflacao_energetica_pct}
                  onChange={handleNumberChange('inflacao_energetica_pct')}
                  onFocus={selectNumberInputOnFocus}
                  min={0}
                  step="0.1"
                />
              </div>

              <div className="field">
                <label htmlFor="sim-inflacao-ipca">Inflação IPCA anual (% a.a.)</label>
                <input
                  id="sim-inflacao-ipca"
                  type="number"
                  value={current.inflacao_ipca_pct}
                  onChange={handleNumberChange('inflacao_ipca_pct')}
                  onFocus={selectNumberInputOnFocus}
                  min={0}
                  step="0.1"
                />
              </div>

              <div className="field">
                <label htmlFor="sim-tarifa-cheia">Tarifa cheia (R$/kWh) - Mês 1</label>
                <input
                  id="sim-tarifa-cheia"
                  type="number"
                  value={current.tarifa_cheia_r_kwh_m1}
                  onChange={handleNumberChange('tarifa_cheia_r_kwh_m1')}
                  onFocus={selectNumberInputOnFocus}
                  min={0}
                  step="0.01"
                />
              </div>

              <div className="field">
                <label htmlFor="sim-kc">KC (kWh/mês)</label>
                <input
                  id="sim-kc"
                  type="number"
                  value={current.kc_kwh_mes}
                  onChange={handleNumberChange('kc_kwh_mes')}
                  onFocus={selectNumberInputOnFocus}
                  min={0}
                  step="10"
                />
              </div>

              <div className="field">
                <label>Perfil de consumo</label>
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

              <div className="field">
                <label htmlFor="sim-tusd">TUSD (%)</label>
                <div className="inline-field">
                  <input
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

              <div className="field">
                <label htmlFor="sim-seguro">Seguro mensal (% valor de mercado)</label>
                <input
                  id="sim-seguro"
                  type="number"
                  value={current.seguro_pct}
                  onChange={handleNumberChange('seguro_pct')}
                  onFocus={selectNumberInputOnFocus}
                  min={0}
                  step="0.1"
                />
              </div>

              <div className="field field-textarea">
                <label htmlFor="sim-obs">Observações</label>
                <textarea
                  id="sim-obs"
                  value={current.obs ?? ''}
                  onChange={handleTextChange('obs')}
                  rows={3}
                  placeholder="Informações adicionais sobre o cenário"
                />
              </div>
            </div>

            <div className="simulations-toggles">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={current.subtrair_tusd_contrato !== false}
                  onChange={handleToggle('subtrair_tusd_contrato')}
                />
                Subtrair TUSD da economia durante o contrato
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={current.subtrair_tusd_pos_contrato !== false}
                  onChange={handleToggle('subtrair_tusd_pos_contrato')}
                />
                Subtrair TUSD no pós-contrato
              </label>
            </div>
          </section>

          <section className="simulations-summary">
            <header>
              <h4>Resumo financeiro</h4>
            </header>
            <div className="simulations-summary-grid">
              <div className="simulations-summary-card">
                <span>Tarifa cheia (mês 1)</span>
                <strong>{formatMoneyBR(tarifaCheiaMes1)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Tarifa com desconto (mês 1)</span>
                <strong>{formatMoneyBR(tarifaComDesconto)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Valor de mercado</span>
                <strong>{formatMoneyBR(valorMercado)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Seguro mensal</span>
                <strong>{formatMoneyBR(seguroMensal)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Encargo TUSD (mês 1)</span>
                <strong>{formatMoneyBR(encargoTusdMes1)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Economia acumulada no contrato</span>
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
                <span>Economia em 15 anos</span>
                <strong>{formatMoneyBR(economia15)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Economia em 20 anos</span>
                <strong>{formatMoneyBR(economia20)}</strong>
              </div>
              <div className="simulations-summary-card">
                <span>Economia em 30 anos</span>
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
                <span>Receita total</span>
                <strong>{formatMoneyBR(kpis.receitaTotal)}</strong>
              </div>
              <div className="simulations-kpi-card">
                <span>Custos variáveis (OPEX)</span>
                <strong>{formatMoneyBR(kpis.custosVariaveis)}</strong>
              </div>
              <div className="simulations-kpi-card">
                <span>Lucro líquido</span>
                <strong>{formatMoneyBR(kpis.lucroLiquido)}</strong>
              </div>
              <div className="simulations-kpi-card">
                <span>ROI</span>
                <strong>{formatPercentValue(kpis.roi)}</strong>
              </div>
              <div className="simulations-kpi-card">
                <span>Payback (meses)</span>
                <strong>{formatPayback(kpis.paybackMeses)}</strong>
              </div>
              <div className="simulations-kpi-card">
                <span>Retorno a.m. bruto</span>
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
            <label htmlFor="economy-horizon">Economia (anos)</label>
            <select
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
                  <th>Cenário</th>
                  <th>Desconto</th>
                  <th>Prazo (meses)</th>
                  <th>KC (kWh/mês)</th>
                  <th>Tarifa cheia (mês 1)</th>
                  <th>Tarifa com desconto (mês 1)</th>
                  <th>Encargo TUSD</th>
                  <th>Custos variáveis</th>
                  <th>Receita total</th>
                  <th>Lucro líquido</th>
                  <th>ROI</th>
                  <th>Payback</th>
                  <th>Retorno a.m. bruto</th>
                  <th>{`Economia (${comparisonHorizon} anos)`}</th>
                  <th>Economia acumulada</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ sim, tarifaDesconto, encargoTusd, indicadores, economiaContratoSim, economiaHorizon }) => {
                  const prazo = Math.max(0, Math.round(sim.anos_contrato * 12))
                  const tarifaCheia = projectTarifaCheia(sim.tarifa_cheia_r_kwh_m1, sim.inflacao_energetica_pct, 1)
                  return (
                    <tr key={sim.id}>
                      <td>{sim.nome?.trim() || sim.id}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
