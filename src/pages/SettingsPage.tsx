import { useId } from 'react'
import React from 'react'
import { labelWithTooltip } from '../components/InfoTooltip'
import { AdminUsersPage } from '../features/admin-users/AdminUsersPage'
import { SETTINGS_TABS, type EntradaModoLabel, type SeguroModo, type SettingsTabKey } from '../app/config'
import { type DensityMode } from '../constants/ui'
import type { BuyoutRow } from '../types/printableProposal'
import { currency } from '../utils/formatters'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import type { useBRNumberField } from '../lib/locale/useBRNumberField'
import {
  VendasParametrosInternosSettings,
  type VendasParametrosInternosSettingsProps,
} from './settings/VendasParametrosInternosSettings'

// ---------------------------------------------------------------------------
// Local Field component — mirrors the settings Field defined in App.tsx
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: React.ReactNode
  children: React.ReactNode
  hint?: React.ReactNode
  htmlFor?: string
}) {
  const generatedId = useId()
  let firstControlId: string | undefined

  const enhancedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) {
      return child
    }

    if (typeof child.type === 'string') {
      if (child.type === 'input') {
        const inputType = (child.props as { type?: string }).type
        if (inputType === 'checkbox' || inputType === 'radio') {
          return child
        }
      }

      if (child.type === 'input' || child.type === 'select' || child.type === 'textarea') {
        const existingProps = child.props as {
          className?: string
          id?: string
          name?: string
        }
        const existingClassName = existingProps.className ?? ''
        const classes = existingClassName.split(' ').filter(Boolean)
        if (!classes.includes('cfg-input')) {
          classes.push('cfg-input')
        }
        const resolvedId =
          existingProps.id ?? (index === 0 ? generatedId : `${generatedId}-${index}`)
        if (!firstControlId) {
          firstControlId = resolvedId
        }
        return React.cloneElement(child, {
          className: classes.join(' '),
          id: existingProps.id ?? resolvedId,
          name: existingProps.name ?? resolvedId,
        })
      }
    }

    return child
  })

  const labelHtmlFor = htmlFor ?? firstControlId

  return (
    <div className="field cfg-field">
      <label className="field-label cfg-label" {...(labelHtmlFor ? { htmlFor: labelHtmlFor } : undefined)}>
        {label}
      </label>
      <div className="field-control cfg-control">
        {enhancedChildren}
        {hint ? <small className="cfg-help">{hint}</small> : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BRNumberField type (local alias, matches useBRNumberField return type)
// ---------------------------------------------------------------------------
type BRNumberField = ReturnType<typeof useBRNumberField>

// ---------------------------------------------------------------------------
// SettingsPageProps
// ---------------------------------------------------------------------------

export interface SettingsPageProps {
  voltarParaPaginaPrincipal: () => void
  canSeeUsersEffective: boolean
  settingsTab: SettingsTabKey
  setSettingsTab: (tab: SettingsTabKey) => void
  inflacaoAa: number
  setInflacaoAa: (val: number) => void
  precoPorKwp: number
  setPrecoPorKwp: (val: number) => void
  irradiacao: number
  eficiencia: number
  setEficiencia: (val: number) => void
  handleEficienciaInput: (val: number) => void
  diasMes: number
  setDiasMes: (val: number) => void
  // VendasParametrosInternosSettings props
  vendasConfig: VendasParametrosInternosSettingsProps['vendasConfig']
  tipoInstalacao: VendasParametrosInternosSettingsProps['tipoInstalacao']
  composicaoTelhadoCalculo: VendasParametrosInternosSettingsProps['composicaoTelhadoCalculo']
  composicaoSoloCalculo: VendasParametrosInternosSettingsProps['composicaoSoloCalculo']
  composicaoTelhado: VendasParametrosInternosSettingsProps['composicaoTelhado']
  composicaoSolo: VendasParametrosInternosSettingsProps['composicaoSolo']
  descontosValor: number
  aprovadoresResumo: string
  capexBaseResumoSettingsField: BRNumberField
  capexBaseResumoValor: number
  capexBaseManualValor: number | undefined
  margemOperacionalResumoSettingsField: BRNumberField
  margemManualAtiva: boolean
  impostosOverridesDraft: VendasParametrosInternosSettingsProps['impostosOverridesDraft']
  aprovadoresText: string
  custoImplantacaoReferencia: number | null
  updateVendasConfig: VendasParametrosInternosSettingsProps['updateVendasConfig']
  onUpdateResumoProposta: VendasParametrosInternosSettingsProps['onUpdateResumoProposta']
  onComposicaoTelhadoChange: VendasParametrosInternosSettingsProps['onComposicaoTelhadoChange']
  onComposicaoSoloChange: VendasParametrosInternosSettingsProps['onComposicaoSoloChange']
  setImpostosOverridesDraft: VendasParametrosInternosSettingsProps['setImpostosOverridesDraft']
  setAprovadoresText: React.Dispatch<React.SetStateAction<string>>
  prazoMeses: number
  setPrazoMeses: (val: number) => void
  bandeiraEncargo: number
  setBandeiraEncargo: (val: number) => void
  cipEncargo: number
  setCipEncargo: (val: number) => void
  entradaModo: EntradaModoLabel
  setEntradaModo: (val: EntradaModoLabel) => void
  parcelasSolarInvest: {
    margemMinima: number
    totalPago: number
    lista: { mes: number; mensalidade: number; tusd: number }[]
  }
  mostrarTabelaParcelasConfig: boolean
  setMostrarTabelaParcelasConfig: React.Dispatch<React.SetStateAction<boolean>>
  jurosFinAa: number
  setJurosFinAa: (val: number) => void
  prazoFinMeses: number
  setPrazoFinMeses: (val: number) => void
  entradaFinPct: number
  setEntradaFinPct: (val: number) => void
  cashbackPct: number
  setCashbackPct: (val: number) => void
  depreciacaoAa: number
  setDepreciacaoAa: (val: number) => void
  inadimplenciaAa: number
  setInadimplenciaAa: (val: number) => void
  tributosAa: number
  setTributosAa: (val: number) => void
  ipcaAa: number
  setIpcaAa: (val: number) => void
  custosFixosM: number
  setCustosFixosM: (val: number) => void
  opexM: number
  setOpexM: (val: number) => void
  seguroM: number
  setSeguroM: (val: number) => void
  duracaoMeses: number
  setDuracaoMeses: (val: number) => void
  pagosAcumAteM: number
  setPagosAcumAteM: (val: number) => void
  mostrarTabelaBuyoutConfig: boolean
  setMostrarTabelaBuyoutConfig: React.Dispatch<React.SetStateAction<boolean>>
  buyoutReceitaRows: BuyoutRow[]
  buyoutAceiteFinal: BuyoutRow | undefined
  buyoutMesAceiteFinal: number
  oemBase: number
  setOemBase: (val: number) => void
  oemInflacao: number
  setOemInflacao: (val: number) => void
  seguroReajuste: number
  setSeguroReajuste: (val: number) => void
  seguroModo: SeguroModo
  setSeguroModo: (val: SeguroModo) => void
  seguroValorA: number
  setSeguroValorA: (val: number) => void
  seguroPercentualB: number
  setSeguroPercentualB: (val: number) => void
  density: DensityMode
  setDensity: (val: DensityMode) => void
  mostrarGrafico: boolean
  setMostrarGrafico: (val: boolean) => void
  useBentoGridPdf: boolean
  setUseBentoGridPdf: (val: boolean) => void
  mostrarFinanciamento: boolean
  setMostrarFinanciamento: (val: boolean) => void
  mobileSimpleView: boolean
  setMobileSimpleView: (val: boolean) => void
  desktopSimpleView: boolean
  setDesktopSimpleView: (val: boolean) => void
}

// ---------------------------------------------------------------------------
// SettingsPage component
// ---------------------------------------------------------------------------

export function SettingsPage({
  voltarParaPaginaPrincipal,
  canSeeUsersEffective,
  settingsTab,
  setSettingsTab,
  inflacaoAa,
  setInflacaoAa,
  precoPorKwp,
  setPrecoPorKwp,
  irradiacao,
  eficiencia,
  setEficiencia,
  handleEficienciaInput,
  diasMes,
  setDiasMes,
  vendasConfig,
  tipoInstalacao,
  composicaoTelhadoCalculo,
  composicaoSoloCalculo,
  composicaoTelhado,
  composicaoSolo,
  descontosValor,
  aprovadoresResumo,
  capexBaseResumoSettingsField,
  capexBaseResumoValor,
  capexBaseManualValor,
  margemOperacionalResumoSettingsField,
  margemManualAtiva,
  impostosOverridesDraft,
  aprovadoresText,
  custoImplantacaoReferencia,
  updateVendasConfig,
  onUpdateResumoProposta,
  onComposicaoTelhadoChange,
  onComposicaoSoloChange,
  setImpostosOverridesDraft,
  setAprovadoresText,
  prazoMeses,
  setPrazoMeses,
  bandeiraEncargo,
  setBandeiraEncargo,
  cipEncargo,
  setCipEncargo,
  entradaModo,
  setEntradaModo,
  parcelasSolarInvest,
  mostrarTabelaParcelasConfig,
  setMostrarTabelaParcelasConfig,
  jurosFinAa,
  setJurosFinAa,
  prazoFinMeses,
  setPrazoFinMeses,
  entradaFinPct,
  setEntradaFinPct,
  cashbackPct,
  setCashbackPct,
  depreciacaoAa,
  setDepreciacaoAa,
  inadimplenciaAa,
  setInadimplenciaAa,
  tributosAa,
  setTributosAa,
  ipcaAa,
  setIpcaAa,
  custosFixosM,
  setCustosFixosM,
  opexM,
  setOpexM,
  seguroM,
  setSeguroM,
  duracaoMeses,
  setDuracaoMeses,
  pagosAcumAteM,
  setPagosAcumAteM,
  mostrarTabelaBuyoutConfig,
  setMostrarTabelaBuyoutConfig,
  buyoutReceitaRows,
  buyoutAceiteFinal,
  buyoutMesAceiteFinal,
  oemBase,
  setOemBase,
  oemInflacao,
  setOemInflacao,
  seguroReajuste,
  setSeguroReajuste,
  seguroModo,
  setSeguroModo,
  seguroValorA,
  setSeguroValorA,
  seguroPercentualB,
  setSeguroPercentualB,
  density,
  setDensity,
  mostrarGrafico,
  setMostrarGrafico,
  useBentoGridPdf,
  setUseBentoGridPdf,
  mostrarFinanciamento,
  setMostrarFinanciamento,
  mobileSimpleView,
  setMobileSimpleView,
  desktopSimpleView,
  setDesktopSimpleView,
}: SettingsPageProps) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h2>Preferências</h2>
          <p>Configure parâmetros de mercado e vendas para personalizar as propostas.</p>
        </div>
        <button type="button" className="ghost" onClick={voltarParaPaginaPrincipal}>
          Voltar
        </button>
      </div>
      <div className="config-page">
        <div className="cfg-tabs" role="tablist" aria-label="Seções de Configuração">
          {SETTINGS_TABS.filter((tab) => tab.id !== 'usuarios' || canSeeUsersEffective).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`cfg-tab-${tab.id}`}
              aria-selected={settingsTab === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              className={`cfg-tab${settingsTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="config-panels">
          {canSeeUsersEffective ? (
            <section
              id="settings-panel-usuarios"
              role="tabpanel"
              aria-labelledby="cfg-tab-usuarios"
              className={`settings-panel config-card${settingsTab === 'usuarios' ? ' active' : ''}`}
              hidden={settingsTab !== 'usuarios'}
              aria-hidden={settingsTab !== 'usuarios'}
            >
              <AdminUsersPage embedded />
            </section>
          ) : null}
          <section
            id="settings-panel-mercado"
            role="tabpanel"
            aria-labelledby="cfg-tab-mercado"
            className={`settings-panel config-card${settingsTab === 'mercado' ? ' active' : ''}`}
            hidden={settingsTab !== 'mercado'}
            aria-hidden={settingsTab !== 'mercado'}
          >
            <div className="cfg-panel-header">
              <h2 className="cfg-section-title">Mercado & energia</h2>
              <p className="settings-panel-description cfg-section-subtitle">
                Ajuste as premissas macroeconômicas da projeção.
              </p>
            </div>
            <div className="grid g2">
              <Field
                label={labelWithTooltip(
                  'Inflação energética (%)',
                  'Percentual anual de reajuste tarifário. Tarifa projetada = Tarifa base × (1 + inflação)^ano.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  value={inflacaoAa}
                  onChange={(e) => setInflacaoAa(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Preço por kWp (R$)',
                  'Preço médio de investimento por kWp. CAPEX estimado = Potência (kWp) × Preço por kWp.',
                )}
              >
                <input
                  type="number"
                  value={precoPorKwp}
                  onChange={(e) => setPrecoPorKwp(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Irradiação média (kWh/m²/dia)',
                  'Valor médio diário usado na estimativa: Geração = kWp × Irradiação × Eficiência × dias.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  min={0.01}
                  value={irradiacao}
                  readOnly
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Eficiência do sistema',
                  'Performance ratio global (PR). Impacta diretamente a geração estimada na fórmula acima.',
                )}
              >
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={eficiencia}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      setEficiencia(0)
                      return
                    }
                    handleEficienciaInput(Number(e.target.value))
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Dias no mês (cálculo)',
                  'Quantidade de dias considerada por mês na estimativa de geração (padrão: 30).',
                )}
              >
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={diasMes > 0 ? diasMes : ''}
                  onChange={(e) => {
                    const { value } = e.target
                    if (value === '') {
                      setDiasMes(0)
                      return
                    }
                    const parsed = Number(value)
                    setDiasMes(Number.isFinite(parsed) ? parsed : 0)
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
            </div>
          </section>
          <section
            id="settings-panel-vendas"
            role="tabpanel"
            aria-labelledby="cfg-tab-vendas"
            className={`settings-panel config-card${settingsTab === 'vendas' ? ' active' : ''}`}
            hidden={settingsTab !== 'vendas'}
            aria-hidden={settingsTab !== 'vendas'}
          >
            <div className="cfg-panel-header">
              <h2 className="cfg-section-title">Parâmetros de vendas</h2>
              <p className="settings-panel-description cfg-section-subtitle">
                Configure custos, margens e impostos utilizados nos cálculos comerciais.
              </p>
            </div>
            <VendasParametrosInternosSettings
                vendasConfig={vendasConfig}
                tipoInstalacao={tipoInstalacao}
                composicaoTelhadoCalculo={composicaoTelhadoCalculo}
                composicaoSoloCalculo={composicaoSoloCalculo}
                composicaoTelhado={composicaoTelhado}
                composicaoSolo={composicaoSolo}
                descontosValor={descontosValor}
                aprovadoresResumo={aprovadoresResumo}
                capexBaseResumoSettingsField={capexBaseResumoSettingsField}
                capexBaseResumoValor={capexBaseResumoValor}
                capexBaseManualValor={capexBaseManualValor}
                margemOperacionalResumoSettingsField={margemOperacionalResumoSettingsField}
                margemManualAtiva={margemManualAtiva}
                impostosOverridesDraft={impostosOverridesDraft}
                aprovadoresText={aprovadoresText}
                custoImplantacaoReferencia={custoImplantacaoReferencia}
                updateVendasConfig={updateVendasConfig}
                onUpdateResumoProposta={onUpdateResumoProposta}
                onComposicaoTelhadoChange={onComposicaoTelhadoChange}
                onComposicaoSoloChange={onComposicaoSoloChange}
                setImpostosOverridesDraft={setImpostosOverridesDraft}
                setAprovadoresText={setAprovadoresText}
              />
          </section>
          <section
            id="settings-panel-leasing"
            role="tabpanel"
            aria-labelledby="cfg-tab-leasing"
            className={`settings-panel config-card${settingsTab === 'leasing' ? ' active' : ''}`}
            hidden={settingsTab !== 'leasing'}
            aria-hidden={settingsTab !== 'leasing'}
          >
            <div className="cfg-panel-header">
              <h2 className="cfg-section-title">Leasing parâmetros</h2>
              <p className="settings-panel-description cfg-section-subtitle">
                Personalize as condições do contrato de leasing.
              </p>
            </div>
            <div className="grid g3">
              <Field
                label={labelWithTooltip(
                  'Prazo contratual (meses)',
                  'Quantidade de meses do contrato de leasing. Utilizada no cálculo das parcelas.',
                )}
              >
                <input
                  type="number"
                  min={1}
                  value={prazoMeses}
                  onChange={(e) => {
                    const parsed = Number(e.target.value)
                    setPrazoMeses(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Bandeira tarifária (R$)',
                  'Valor adicional por kWh conforme bandeira vigente. Aplicado às tarifas projetadas.',
                )}
              >
                <input
                  type="number"
                  value={bandeiraEncargo}
                  onChange={(e) => {
                    const parsed = Number(e.target.value)
                    setBandeiraEncargo(Number.isFinite(parsed) ? parsed : 0)
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Contribuição CIP (R$)',
                  'Valor mensal da Contribuição de Iluminação Pública considerado no cenário.',
                )}
              >
                <input
                  type="number"
                  value={cipEncargo}
                  onChange={(e) => {
                    const parsed = Number(e.target.value)
                    setCipEncargo(Number.isFinite(parsed) ? parsed : 0)
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Uso da entrada',
                  'Define se a entrada gera crédito mensal ou reduz o piso contratado do cliente.',
                )}
              >
                <select value={entradaModo} onChange={(e) => setEntradaModo(e.target.value as EntradaModoLabel)}>
                  <option value="Crédito mensal">Crédito mensal</option>
                  <option value="Reduz piso contratado">Reduz piso contratado</option>
                </select>
              </Field>
            </div>
            <div className="info-inline">
              <span className="pill">
                Margem mínima: <strong>{currency(parcelasSolarInvest.margemMinima)}</strong>
              </span>
              <span className="pill">
                Total pago no prazo: <strong>{currency(parcelasSolarInvest.totalPago)}</strong>
              </span>
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">Parcelas — Total pago acumulado</p>
              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaParcelasConfig((prev) => !prev)}
                  aria-expanded={mostrarTabelaParcelasConfig}
                  aria-controls="config-parcelas-total"
                >
                  {mostrarTabelaParcelasConfig
                    ? 'Ocultar tabela de parcelas (configurações)'
                    : 'Exibir tabela de parcelas (configurações)'}
                </button>
              </div>
              {mostrarTabelaParcelasConfig ? (
                <div className="table-wrapper">
                  <table id="config-parcelas-total">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Mensalidade projetada</th>
                        <th>TUSD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasSolarInvest.lista.length > 0 ? (
                        parcelasSolarInvest.lista.map((row) => (
                          <tr key={`config-parcela-${row.mes}`}>
                            <td>{row.mes}</td>
                            <td>{currency(row.mensalidade)}</td>
                            <td>{currency(row.tusd)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="muted">
                            Defina um prazo contratual para visualizar a tabela configurável de parcelas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">Financiamento</p>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Juros anuais (%)',
                    'Taxa de juros anual aplicada na simulação de financiamento para comparação.',
                  )}
                >
                  <input
                    type="number"
                    step="0.1"
                    value={jurosFinAa}
                    onChange={(e) => setJurosFinAa(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Prazo financiamento (meses)',
                    'Quantidade de meses considerados no cenário de financiamento.',
                  )}
                >
                  <input
                    type="number"
                    value={prazoFinMeses}
                    onChange={(e) => setPrazoFinMeses(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Entrada (%)',
                    'Percentual de entrada considerado no cenário financiado (Entrada = CAPEX × %).',
                  )}
                >
                  <input
                    type="number"
                    step="0.1"
                    value={entradaFinPct}
                    onChange={(e) => setEntradaFinPct(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>
            </div>
          </section>
          <section
            id="settings-panel-buyout"
            role="tabpanel"
            aria-labelledby="cfg-tab-buyout"
            className={`settings-panel config-card${settingsTab === 'buyout' ? ' active' : ''}`}
            hidden={settingsTab !== 'buyout'}
            aria-hidden={settingsTab !== 'buyout'}
          >
            <div className="cfg-panel-header">
              <h2 className="cfg-section-title">Buyout parâmetros</h2>
              <p className="settings-panel-description cfg-section-subtitle">
                Configure premissas de recompra e fluxo residual.
              </p>
            </div>
            <div className="grid g3">
              <Field
                label={labelWithTooltip(
                  'Cashback (%)',
                  'Percentual devolvido ao cliente em caso de compra antecipada.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  value={cashbackPct}
                  onChange={(e) => setCashbackPct(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Depreciação (%)',
                  'Taxa anual de depreciação dos ativos considerados no buyout.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  value={depreciacaoAa}
                  onChange={(e) => setDepreciacaoAa(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Inadimplência (%)',
                  'Percentual anual de inadimplência considerado na projeção.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  value={inadimplenciaAa}
                  onChange={(e) => setInadimplenciaAa(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Tributos (%)',
                  'Percentual de tributos incidentes sobre o fluxo financeiro do buyout.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  value={tributosAa}
                  onChange={(e) => setTributosAa(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'IPCA (%)',
                  'Inflação geral (IPCA) para atualizar valores reais ao longo do tempo.',
                )}
              >
                <input
                  type="number"
                  step="0.1"
                  value={ipcaAa}
                  onChange={(e) => setIpcaAa(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Custos fixos (R$)',
                  'Custos fixos mensais associados à operação no cenário buyout.',
                )}
              >
                <input
                  type="number"
                  value={custosFixosM}
                  onChange={(e) => setCustosFixosM(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'OPEX (R$)',
                  'Despesas operacionais mensais (manutenção, monitoramento etc.).',
                )}
              >
                <input
                  type="number"
                  value={opexM}
                  onChange={(e) => setOpexM(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Seguro (R$)',
                  'Prêmio mensal de seguro considerado na simulação.',
                )}
              >
                <input
                  type="number"
                  value={seguroM}
                  onChange={(e) => setSeguroM(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Duração (meses)',
                  'Janela de tempo analisada para o fluxo residual e compra antecipada.',
                )}
              >
                <input
                  type="number"
                  value={duracaoMeses}
                  onChange={(e) => setDuracaoMeses(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Receita acumulada (R$) — referência',
                  'Campo de referência histórica. O cálculo do VEC contratual não usa parcelas pagas como redutor.',
                )}
              >
                <input
                  type="number"
                  value={pagosAcumAteM}
                  onChange={(e) => setPagosAcumAteM(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">Buyout — Receita acumulada</p>
              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaBuyoutConfig((prev) => !prev)}
                  aria-expanded={mostrarTabelaBuyoutConfig}
                  aria-controls="config-buyout-receita"
                >
                  {mostrarTabelaBuyoutConfig ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                </button>
              </div>
              {mostrarTabelaBuyoutConfig ? (
                <div className="table-wrapper">
                  <table id="config-buyout-receita">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Receita acumulada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyoutReceitaRows.length > 0 ? (
                        buyoutReceitaRows.map((row) => (
                          <tr key={`config-buyout-${row.mes}`}>
                            <td>{row.mes}</td>
                            <td>{currency(row.prestacaoAcum)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="muted">
                            Defina os parâmetros para visualizar a receita acumulada.
                          </td>
                        </tr>
                      )}
                      {buyoutAceiteFinal ? (
                        <tr>
                          <td>{buyoutMesAceiteFinal}</td>
                          <td>{currency(buyoutAceiteFinal.prestacaoAcum)}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>
          <section
            id="settings-panel-outros"
            role="tabpanel"
            aria-labelledby="cfg-tab-outros"
            className={`settings-panel config-card${settingsTab === 'outros' ? ' active' : ''}`}
            hidden={settingsTab !== 'outros'}
            aria-hidden={settingsTab !== 'outros'}
          >
            <div className="cfg-panel-header">
              <h2 className="cfg-section-title">Outros</h2>
              <p className="settings-panel-description cfg-section-subtitle">
                Controles complementares de operação e apresentação.
              </p>
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">O&M e seguro</p>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'O&M base (R$/kWp)',
                    'Valor base de contrato de operação e manutenção por kWp instalado.',
                  )}
                >
                  <input
                    type="number"
                    value={oemBase}
                    onChange={(e) => setOemBase(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Inflação O&M (%)',
                    'Reajuste anual do contrato de operação e manutenção.',
                  )}
                >
                  <input
                    type="number"
                    step="0.1"
                    value={oemInflacao}
                    onChange={(e) => setOemInflacao(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Reajuste seguro (%)',
                    'Percentual anual de reajuste do seguro quando o modo percentual está ativo.',
                  )}
                >
                  <input
                    type="number"
                    step="0.1"
                    value={seguroReajuste}
                    onChange={(e) => setSeguroReajuste(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Modo de seguro',
                    'Escolha entre valor fixo por kWp (Modo A) ou percentual do valor de mercado (Modo B).',
                  )}
                >
                  <select value={seguroModo} onChange={(e) => setSeguroModo(e.target.value as SeguroModo)}>
                    <option value="A">Modo A — Potência (R$)</option>
                    <option value="B">Modo B — % Valor de mercado</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Base seguro modo A (R$/kWp)',
                    'Valor aplicado por kWp quando o seguro está configurado no modo A.',
                  )}
                >
                  <input
                    type="number"
                    value={seguroValorA}
                    onChange={(e) => setSeguroValorA(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Seguro modo B (%)',
                    'Percentual aplicado sobre o valor de mercado quando o modo B está ativo.',
                  )}
                >
                  <input
                    type="number"
                    step="0.01"
                    value={seguroPercentualB}
                    onChange={(e) => setSeguroPercentualB(Number(e.target.value) || 0)}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
              </div>
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">Exibição</p>
              <div className="grid g2">
                <Field
                  label={labelWithTooltip(
                    'Densidade da interface',
                    'Ajuste visual dos espaçamentos da interface (compacto, acolhedor ou confortável).',
                  )}
                >
                  <select value={density} onChange={(event) => setDensity(event.target.value as DensityMode)}>
                    <option value="compact">Compacto</option>
                    <option value="cozy">Acolhedor</option>
                    <option value="comfortable">Confortável</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Mostrar gráfico ROI',
                    'Liga ou desliga a visualização do gráfico de retorno sobre investimento.',
                  )}
                >
                  <select value={mostrarGrafico ? '1' : '0'} onChange={(e) => setMostrarGrafico(e.target.value === '1')}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'PDF Bento Grid (Leasing)',
                    'Ativa o layout premium com cards Bento Grid para propostas de leasing. Desabilite para usar o formato legado.',
                  )}
                >
                  <select value={useBentoGridPdf ? '1' : '0'} onChange={(e) => setUseBentoGridPdf(e.target.value === '1')}>
                    <option value="1">Ativado (Premium)</option>
                    <option value="0">Desativado (leagado)</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Mostrar coluna financiamento',
                    'Exibe ou oculta a coluna de comparação com financiamento na tela principal.',
                  )}
                >
                  <select
                    value={mostrarFinanciamento ? '1' : '0'}
                    onChange={(e) => setMostrarFinanciamento(e.target.value === '1')}
                  >
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">Visualização simplificada</p>
              <div className="grid g2">
                <Field
                  label={labelWithTooltip(
                    'Mobile view simples',
                    'Oculta blocos avançados no formulário de Leasing em dispositivos móveis para simplificar a interface.',
                  )}
                >
                  <select
                    value={mobileSimpleView ? '1' : '0'}
                    onChange={(e) => setMobileSimpleView(e.target.value === '1')}
                  >
                    <option value="1">Ativado</option>
                    <option value="0">Desativado</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Desktop view simples',
                    'Oculta blocos avançados no formulário de Leasing e simplifica o menu lateral em desktop.',
                  )}
                >
                  <select
                    value={desktopSimpleView ? '1' : '0'}
                    onChange={(e) => setDesktopSimpleView(e.target.value === '1')}
                  >
                    <option value="1">Ativado</option>
                    <option value="0">Desativado</option>
                  </select>
                </Field>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
