import React from 'react'
import { formatNumberBRWithOptions, formatPercentBRWithDigits } from '../lib/locale/br-number'
import { currency, formatKwhWithUnit, tarifaCurrency } from '../utils/formatters'
import type { VendaForm } from '../lib/finance/roi'
import type { TipoClienteTUSD } from '../lib/finance/tusd'
import type { SegmentoCliente } from '../lib/finance/roi'
import type { MultiUcRateioModo, MultiUcRowState } from '../app/config'
import type { MultiUcCalculoResultado, MultiUcCalculoUcResultado } from '../utils/multiUc'
import { MULTI_UC_CLASSES, MULTI_UC_CLASS_LABELS, type MultiUcClasse } from '../types/multiUc'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import { CheckboxSmall } from './CheckboxSmall'
import { labelWithTooltip, InfoTooltip } from './InfoTooltip'
import { Field } from './ui/Field'
import { Switch } from './ui/switch'
import { TusdParametersSection } from './TusdParametersSection'

export interface TarifaCheiaFieldHandlers {
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
  onFocus: React.FocusEventHandler<HTMLInputElement>
  onBlur: React.FocusEventHandler<HTMLInputElement> | (() => void)
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>
}

export interface ParametrosPrincipaisSectionProps {
  // ── Parâmetros principais ──────────────────────────────────────────────────
  kcKwhMes: number
  tipoRedeLabel: string
  vendaForm: VendaForm
  tarifaCheiaField: TarifaCheiaFieldHandlers
  taxaMinimaInputEmpty: boolean
  taxaMinima: number
  encargosFixosExtras: number
  baseIrradiacao: number
  shouldHideSimpleViewItems: boolean

  // ── TUSD options (passed through to TusdParametersSection) ────────────────
  tusdPercent: number
  tusdTipoCliente: TipoClienteTUSD
  tusdSubtipo: string
  tusdSimultaneidade: number | null
  tusdTarifaRkwh: number | null
  tusdAnoReferencia: number
  tusdOpcoesExpandidas: boolean
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
  tusdOptionsTitleId: string
  tusdOptionsToggleId: string
  tusdOptionsContentId: string

  // ── Multi-UC ───────────────────────────────────────────────────────────────
  multiUcAtivo: boolean
  multiUcRateioModo: MultiUcRateioModo
  multiUcEnergiaGeradaKWh: number
  multiUcEnergiaGeradaTouched: boolean
  multiUcAnoVigencia: number
  multiUcOverrideEscalonamento: boolean
  multiUcEscalonamentoCustomPercent: number | null
  multiUcEscalonamentoPadrao: Record<number, number>
  multiUcEscalonamentoPercentual: number
  multiUcEscalonamentoTabela: Array<{ ano: number; valor: number }>
  multiUcRows: MultiUcRowState[]
  multiUcResultado: MultiUcCalculoResultado | null
  multiUcResultadoPorId: Map<string, MultiUcCalculoUcResultado>
  multiUcRateioPercentualTotal: number
  multiUcRateioManualTotal: number
  multiUcErrors: string[]
  multiUcWarnings: string[]
  distribuidoraAneelEfetiva: string | null | undefined
  initialMultiUcAnoVigencia: number

  // ── Callbacks — parâmetros principais ────────────────────────────────────
  onSetKcKwhMes: (value: number, origin: 'auto' | 'user') => void
  onApplyVendaUpdates: (updates: Partial<VendaForm>) => void
  onNormalizeTaxaMinimaInputValue: (value: string) => void
  onSetEncargosFixosExtras: (value: number) => void

  // ── Callbacks — TUSD ─────────────────────────────────────────────────────
  onTusdPercentChange: (value: number) => void
  onTusdTipoClienteChange: (value: TipoClienteTUSD) => void
  onTusdSubtipoChange: (value: string) => void
  onTusdSimultaneidadeChange: (value: number | null) => void
  onTusdTarifaRkwhChange: (value: number | null) => void
  onTusdAnoReferenciaChange: (value: number) => void
  onTusdOpcoesExpandidasChange: (checked: boolean) => void
  onTipoEdificacaoOutroChange: (value: string) => void

  // ── Callbacks — Multi-UC ─────────────────────────────────────────────────
  onHandleMultiUcToggle: (checked: boolean) => void
  onHandleMultiUcQuantidadeChange: (qty: number) => void
  onSetMultiUcEnergiaGeradaKWh: (value: number, origin: 'auto' | 'user') => void
  onHandleMultiUcRateioModoChange: (modo: MultiUcRateioModo) => void
  onSetMultiUcAnoVigencia: (value: number) => void
  onSetMultiUcOverrideEscalonamento: (checked: boolean) => void
  onSetMultiUcEscalonamentoCustomPercent: (value: number | null) => void
  onHandleMultiUcClasseChange: (id: string, classe: MultiUcClasse) => void
  onHandleMultiUcConsumoChange: (id: string, value: number) => void
  onHandleMultiUcRateioPercentualChange: (id: string, value: number) => void
  onHandleMultiUcManualRateioChange: (id: string, value: number) => void
  onHandleMultiUcTeChange: (id: string, value: number) => void
  onHandleMultiUcTusdTotalChange: (id: string, value: number) => void
  onHandleMultiUcTusdFioBChange: (id: string, value: number) => void
  onHandleMultiUcObservacoesChange: (id: string, value: string) => void
  onHandleMultiUcAdicionar: () => void
  onHandleMultiUcRecarregarTarifas: () => void
  onHandleMultiUcRemover: (id: string) => void
}

export function ParametrosPrincipaisSection({
  kcKwhMes,
  tipoRedeLabel,
  vendaForm,
  tarifaCheiaField,
  taxaMinimaInputEmpty,
  taxaMinima,
  encargosFixosExtras,
  baseIrradiacao,
  shouldHideSimpleViewItems,
  tusdPercent,
  tusdTipoCliente,
  tusdSubtipo,
  tusdSimultaneidade,
  tusdTarifaRkwh,
  tusdAnoReferencia,
  tusdOpcoesExpandidas,
  segmentoCliente,
  tipoEdificacaoOutro,
  tusdOptionsTitleId,
  tusdOptionsToggleId,
  tusdOptionsContentId,
  multiUcAtivo,
  multiUcRateioModo,
  multiUcEnergiaGeradaKWh,
  multiUcEnergiaGeradaTouched,
  multiUcAnoVigencia,
  multiUcOverrideEscalonamento,
  multiUcEscalonamentoCustomPercent,
  multiUcEscalonamentoPadrao,
  multiUcEscalonamentoPercentual,
  multiUcEscalonamentoTabela,
  multiUcRows,
  multiUcResultado,
  multiUcResultadoPorId,
  multiUcRateioPercentualTotal,
  multiUcRateioManualTotal,
  multiUcErrors,
  multiUcWarnings,
  distribuidoraAneelEfetiva,
  initialMultiUcAnoVigencia,
  onSetKcKwhMes,
  onApplyVendaUpdates,
  onNormalizeTaxaMinimaInputValue,
  onSetEncargosFixosExtras,
  onTusdPercentChange,
  onTusdTipoClienteChange,
  onTusdSubtipoChange,
  onTusdSimultaneidadeChange,
  onTusdTarifaRkwhChange,
  onTusdAnoReferenciaChange,
  onTusdOpcoesExpandidasChange,
  onTipoEdificacaoOutroChange,
  onHandleMultiUcToggle,
  onHandleMultiUcQuantidadeChange,
  onSetMultiUcEnergiaGeradaKWh,
  onHandleMultiUcRateioModoChange,
  onSetMultiUcAnoVigencia,
  onSetMultiUcOverrideEscalonamento,
  onSetMultiUcEscalonamentoCustomPercent,
  onHandleMultiUcClasseChange,
  onHandleMultiUcConsumoChange,
  onHandleMultiUcRateioPercentualChange,
  onHandleMultiUcManualRateioChange,
  onHandleMultiUcTeChange,
  onHandleMultiUcTusdTotalChange,
  onHandleMultiUcTusdFioBChange,
  onHandleMultiUcObservacoesChange,
  onHandleMultiUcAdicionar,
  onHandleMultiUcRecarregarTarifas,
  onHandleMultiUcRemover,
}: ParametrosPrincipaisSectionProps) {
  const rateioPercentualDiff = Math.abs(multiUcRateioPercentualTotal - 100)
  const rateioPercentualValido =
    !multiUcAtivo || multiUcRateioModo !== 'percentual' || multiUcEnergiaGeradaKWh <= 0
      ? true
      : rateioPercentualDiff <= 0.001
  const rateioManualDiff = Math.abs(multiUcRateioManualTotal - multiUcEnergiaGeradaKWh)
  const rateioManualValido =
    !multiUcAtivo || multiUcRateioModo !== 'manual' || multiUcEnergiaGeradaKWh <= 0
      ? true
      : rateioManualDiff <= 0.001
  const escalonamentoAplicadoTexto = formatPercentBRWithDigits(
    multiUcResultado?.escalonamentoPercentual ?? multiUcEscalonamentoPercentual,
    0,
  )
  const rateioHeader = multiUcRateioModo === 'percentual' ? 'Rateio (%)' : 'Rateio (kWh)'
  const rateioPercentualResumoTexto =
    multiUcRateioModo === 'percentual'
      ? formatPercentBRWithDigits(multiUcRateioPercentualTotal / 100, 2)
      : null
  const rateioManualResumoTexto =
    multiUcRateioModo === 'manual' ? formatKwhWithUnit(multiUcRateioManualTotal) : null
  const energiaGeradaTexto = formatKwhWithUnit(multiUcEnergiaGeradaKWh)
  const energiaCompensadaTexto = formatKwhWithUnit(
    multiUcResultado?.energiaGeradaUtilizadaKWh ?? null,
  )
  const sobraCreditosTexto = formatKwhWithUnit(multiUcResultado?.sobraCreditosKWh ?? null)
  const totalTusdTexto =
    multiUcResultado && Number.isFinite(multiUcResultado.totalTusd)
      ? currency(multiUcResultado.totalTusd)
      : null
  const totalTeTexto =
    multiUcResultado && Number.isFinite(multiUcResultado.totalTe)
      ? currency(multiUcResultado.totalTe)
      : null
  const totalContratoTexto =
    multiUcResultado && Number.isFinite(multiUcResultado.totalContrato)
      ? currency(multiUcResultado.totalContrato)
      : null

  return (
    <section className="card">
      <h2>Parâmetros principais</h2>
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'Consumo (kWh/mês)',
            'Consumo médio mensal histórico da UC principal; serve como base para dimensionar geração e economia.',
          )}
        >
          <input
            data-field="cliente-consumo"
            type="number"
            value={kcKwhMes}
            onChange={(e) => onSetKcKwhMes(Number(e.target.value) || 0, 'user')}
            onFocus={selectNumberInputOnFocus}
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Taxa mínima ({tipoRedeLabel})
            </label>
            <Switch
              checked={vendaForm.aplica_taxa_minima ?? true}
              onCheckedChange={(value) => onApplyVendaUpdates({ aplica_taxa_minima: value })}
            />
            <span className="text-xs text-gray-500">
              {vendaForm.aplica_taxa_minima ?? true
                ? 'Cliente paga taxa mínima (padrão)'
                : 'Cliente isento de taxa mínima'}
            </span>
          </div>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tarifa cheia (R$/kWh)',
            'Valor cobrado por kWh sem descontos; multiplicado pelo consumo projetado para estimar a conta cheia.',
          )}
        >
          <input
            data-field="cliente-tarifaCheia"
            type="text"
            inputMode="decimal"
            value={tarifaCheiaField.value}
            onChange={tarifaCheiaField.onChange}
            onFocus={tarifaCheiaField.onFocus}
            onBlur={tarifaCheiaField.onBlur}
            onKeyDown={tarifaCheiaField.onKeyDown}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Custos Fixos da Conta de Energia (R$/MÊS)',
            'Total de custos fixos cobrados pela distribuidora independentemente da compensação de créditos.',
          )}
        >
          <input
            type="number"
            min={0}
            value={taxaMinimaInputEmpty ? '' : taxaMinima}
            onChange={(event) => {
              onNormalizeTaxaMinimaInputValue(event.target.value)
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Encargos adicionais (R$/mês)',
            'Outras cobranças fixas recorrentes (CIP, iluminação, taxas municipais) adicionadas à conta mensal.',
          )}
        >
          <input
            type="number"
            value={encargosFixosExtras}
            onChange={(e) => onSetEncargosFixosExtras(Number(e.target.value) || 0)}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={
            <>
              Irradiação média (kWh/m²/dia)
              <InfoTooltip text="Irradiação média é preenchida automaticamente a partir da UF/distribuidora ou do valor configurado manualmente." />
            </>
          }
          hint="Atualizado automaticamente conforme a UF ou distribuidora selecionada."
        >
          <input
            readOnly
            value={
              baseIrradiacao > 0
                ? formatNumberBRWithOptions(baseIrradiacao, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ''
            }
          />
        </Field>
      </div>
      {shouldHideSimpleViewItems ? null : (
        <TusdParametersSection
          tusdPercent={tusdPercent}
          tusdTipoCliente={tusdTipoCliente}
          tusdSubtipo={tusdSubtipo}
          tusdSimultaneidade={tusdSimultaneidade}
          tusdTarifaRkwh={tusdTarifaRkwh}
          tusdAnoReferencia={tusdAnoReferencia}
          tusdOpcoesExpandidas={tusdOpcoesExpandidas}
          segmentoCliente={segmentoCliente}
          tipoEdificacaoOutro={tipoEdificacaoOutro}
          tusdOptionsTitleId={tusdOptionsTitleId}
          tusdOptionsToggleId={tusdOptionsToggleId}
          tusdOptionsContentId={tusdOptionsContentId}
          onTusdPercentChange={onTusdPercentChange}
          onTusdTipoClienteChange={onTusdTipoClienteChange}
          onTusdSubtipoChange={onTusdSubtipoChange}
          onTusdSimultaneidadeChange={onTusdSimultaneidadeChange}
          onTusdTarifaRkwhChange={onTusdTarifaRkwhChange}
          onTusdAnoReferenciaChange={onTusdAnoReferenciaChange}
          onTusdOpcoesExpandidasChange={onTusdOpcoesExpandidasChange}
          onTipoEdificacaoOutroChange={onTipoEdificacaoOutroChange}
        />
      )}
      {!shouldHideSimpleViewItems ? (
      <div className="multi-uc-section" id="multi-uc">
        <div className="multi-uc-header">
          <div className="multi-uc-title-row">
            <h3>Cenário de múltiplas unidades consumidoras (Multi-UC)</h3>
            <label className="multi-uc-toggle flex items-center gap-2">
              <CheckboxSmall
                checked={multiUcAtivo}
                onChange={(event) => onHandleMultiUcToggle(event.target.checked)}
              />
              <span className="multi-uc-toggle-indicator" aria-hidden="true" />
              <span className="multi-uc-toggle-text">Ativar modo multi-UC</span>
            </label>
          </div>
          <p>
            Cadastre várias UCs de classes distintas, defina o rateio dos créditos de energia e acompanhe a TUSD não
            compensável escalonada pela Lei 14.300.
          </p>
        </div>
        {multiUcAtivo ? (
          <div className="multi-uc-body">
            <div className="grid g3">
              <Field
                label={labelWithTooltip(
                  'Número de UCs',
                  'Quantidade de unidades consumidoras consideradas no rateio de créditos deste cenário.',
                )}
              >
                <input
                  type="number"
                  min={1}
                  value={multiUcRows.length}
                  onChange={(event) => onHandleMultiUcQuantidadeChange(Number(event.target.value))}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={
                  <>
                    Energia gerada total (kWh/mês)
                    <InfoTooltip text="Valor utilizado para distribuir os créditos entre as UCs." />
                  </>
                }
                hint={
                  multiUcEnergiaGeradaTouched
                    ? undefined
                    : 'Sugestão automática com base na geração estimada.'
                }
              >
                <input
                  type="number"
                  min={0}
                  value={multiUcEnergiaGeradaKWh}
                  onChange={(event) =>
                    onSetMultiUcEnergiaGeradaKWh(Number(event.target.value) || 0, 'user')
                  }
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={
                  <>
                    Modo de rateio dos créditos
                    <InfoTooltip text="Escolha entre ratear por percentuais ou informar valores manuais em kWh por unidade consumidora." />
                  </>
                }
                hint={
                  multiUcRateioModo === 'percentual'
                    ? 'Percentuais devem totalizar 100%.'
                    : 'O somatório em kWh deve ser igual à geração disponível.'
                }
              >
                <div className="toggle-group multi-uc-rateio-toggle">
                  <button
                    type="button"
                    className={`toggle-option${multiUcRateioModo === 'percentual' ? ' active' : ''}`}
                    onClick={() => onHandleMultiUcRateioModoChange('percentual')}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    className={`toggle-option${multiUcRateioModo === 'manual' ? ' active' : ''}`}
                    onClick={() => onHandleMultiUcRateioModoChange('manual')}
                  >
                    Manual (kWh)
                  </button>
                </div>
              </Field>
            </div>
            <div className="grid g3">
              <Field
                label={labelWithTooltip(
                  'Ano de vigência',
                  'Ano-base do contrato utilizado para determinar o percentual de TUSD Fio B escalonado.',
                )}
              >
                <input
                  type="number"
                  min={2023}
                  value={multiUcAnoVigencia}
                  onChange={(event) => {
                    const { value } = event.target
                    if (value === '') {
                      onSetMultiUcAnoVigencia(initialMultiUcAnoVigencia)
                      return
                    }
                    const parsed = Number(value)
                    onSetMultiUcAnoVigencia(
                      Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : initialMultiUcAnoVigencia,
                    )
                  }}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field
                label={
                  <>
                    Escalonamento aplicado
                    <InfoTooltip text="Percentual do Fio B aplicado sobre a energia compensada, conforme Lei 14.300." />
                  </>
                }
              >
                <input readOnly value={escalonamentoAplicadoTexto} />
              </Field>
              <Field
                label={labelWithTooltip(
                  'Personalizar escalonamento',
                  'Habilite para informar manualmente o percentual de TUSD Fio B aplicado no ano selecionado.',
                )}
              >
                <div className="multi-uc-override-control">
                  <label className="multi-uc-checkbox flex items-center gap-2">
                    <CheckboxSmall
                      checked={multiUcOverrideEscalonamento}
                      onChange={(event) => onSetMultiUcOverrideEscalonamento(event.target.checked)}
                    />
                    <span>Habilitar edição manual</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder={`${multiUcEscalonamentoPadrao[multiUcAnoVigencia] ?? 0}`}
                    value={multiUcEscalonamentoCustomPercent ?? ''}
                    onChange={(event) => {
                      const next = event.target.value === '' ? null : Number(event.target.value)
                      if (next === null) {
                        onSetMultiUcEscalonamentoCustomPercent(null)
                        return
                      }
                      if (Number.isFinite(next)) {
                        onSetMultiUcEscalonamentoCustomPercent(Math.max(0, next))
                        return
                      }
                      onSetMultiUcEscalonamentoCustomPercent(null)
                    }}
                    onFocus={selectNumberInputOnFocus}
                    disabled={!multiUcOverrideEscalonamento}
                  />
                </div>
              </Field>
            </div>
            <div className="multi-uc-summary-grid">
              {rateioPercentualResumoTexto ? (
                <div
                  className={`multi-uc-summary-item${multiUcRateioModo === 'percentual' && !rateioPercentualValido ? ' multi-uc-summary-item--error' : ''}`}
                >
                  <span>Soma do rateio (%)</span>
                  <strong>{rateioPercentualResumoTexto}</strong>
                </div>
              ) : null}
              {rateioManualResumoTexto ? (
                <div
                  className={`multi-uc-summary-item${multiUcRateioModo === 'manual' && !rateioManualValido ? ' multi-uc-summary-item--error' : ''}`}
                >
                  <span>Rateio manual (kWh)</span>
                  <strong>{rateioManualResumoTexto}</strong>
                </div>
              ) : null}
              {energiaGeradaTexto ? (
                <div className="multi-uc-summary-item">
                  <span>Energia gerada</span>
                  <strong>{energiaGeradaTexto}</strong>
                </div>
              ) : null}
              {energiaCompensadaTexto ? (
                <div className="multi-uc-summary-item">
                  <span>Energia compensada</span>
                  <strong>{energiaCompensadaTexto}</strong>
                </div>
              ) : null}
              {sobraCreditosTexto ? (
                <div className="multi-uc-summary-item">
                  <span>Sobra de créditos</span>
                  <strong>{sobraCreditosTexto}</strong>
                </div>
              ) : null}
              {totalTusdTexto ? (
                <div className="multi-uc-summary-item">
                  <span>TUSD mensal total</span>
                  <strong>{totalTusdTexto}</strong>
                </div>
              ) : null}
              {totalTeTexto ? (
                <div className="multi-uc-summary-item">
                  <span>TE mensal total</span>
                  <strong>{totalTeTexto}</strong>
                </div>
              ) : null}
              {totalContratoTexto ? (
                <div className="multi-uc-summary-item">
                  <span>Total contrato</span>
                  <strong>{totalContratoTexto}</strong>
                </div>
              ) : null}
            </div>
            <div className="multi-uc-escalonamento">
              <h4>Tabela de escalonamento Fio B (padrão)</h4>
              <ul className="multi-uc-escalonamento-list">
                {multiUcEscalonamentoTabela.map((item) => (
                  <li key={item.ano}>
                    <span>{item.ano}</span>
                    <span>{formatPercentBRWithDigits((item.valor ?? 0) / 100, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {multiUcErrors.length > 0 || multiUcWarnings.length > 0 ? (
              <div className="multi-uc-alerts">
                {multiUcErrors.map((mensagem, index) => (
                  <div key={`multi-uc-error-${index}`} className="multi-uc-alert error" role="alert">
                    <strong>Erro</strong>
                    <span>{mensagem}</span>
                  </div>
                ))}
                {multiUcWarnings.map((mensagem, index) => (
                  <div key={`multi-uc-warning-${index}`} className="multi-uc-alert warning">
                    <strong>Aviso</strong>
                    <span>{mensagem}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="multi-uc-table-actions">
              <div className="action-group">
                <button type="button" className="ghost with-icon" onClick={onHandleMultiUcAdicionar}>
                  <span aria-hidden="true">＋</span>
                  Adicionar UC
                </button>
                <button type="button" className="ghost with-icon" onClick={onHandleMultiUcRecarregarTarifas}>
                  <span aria-hidden="true">↻</span>
                  Reaplicar tarifas automáticas
                </button>
              </div>
              <span className="muted">
                Distribuidora de referência: {distribuidoraAneelEfetiva ?? ''}
              </span>
            </div>
            <div className="table-wrapper multi-uc-table">
              <table>
                <thead>
                  <tr>
                    <th>UC</th>
                    <th>Classe tarifária</th>
                    <th>Consumo (kWh/mês)</th>
                    <th>{rateioHeader}</th>
                    <th>Créditos (kWh)</th>
                    <th>kWh faturados</th>
                    <th>kWh compensados</th>
                    <th>TE (R$/kWh)</th>
                    <th>TUSD total (R$/kWh)</th>
                    <th>TUSD Fio B (R$/kWh)</th>
                    <th>TUSD outros (R$/kWh)</th>
                    <th>TUSD mensal (R$)</th>
                    <th>TE mensal (R$)</th>
                    <th>Total mensal (R$)</th>
                    <th>Observações</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {multiUcRows.map((row, index) => {
                    const calculado = multiUcResultadoPorId.get(row.id)
                    const rateioManualKWh = row.manualRateioKWh ?? 0
                    const creditosDistribuidos = calculado?.creditosKWh ??
                      (multiUcRateioModo === 'percentual'
                        ? multiUcEnergiaGeradaKWh * (Math.max(0, row.rateioPercentual) / 100)
                        : Math.max(0, rateioManualKWh))
                    const consumoNormalizado = Math.max(0, row.consumoKWh)
                    const kWhCompensados = calculado?.kWhCompensados ?? Math.min(consumoNormalizado, creditosDistribuidos)
                    const kWhFaturados = calculado?.kWhFaturados ?? Math.max(consumoNormalizado - creditosDistribuidos, 0)
                    const tusdOutros = calculado?.tusdOutros ?? Math.max(0, row.tusdTotal - row.tusdFioB)
                    const escalonamentoBase = multiUcResultado?.escalonamentoPercentual ?? multiUcEscalonamentoPercentual
                    const tusdNaoCompensavel = calculado?.tusdNaoCompensavel ??
                      kWhCompensados * row.tusdFioB * escalonamentoBase
                    const tusdNaoCompensada = calculado?.tusdNaoCompensada ?? kWhFaturados * row.tusdTotal
                    const tusdMensal = calculado?.tusdMensal ?? tusdNaoCompensavel + tusdNaoCompensada
                    const teMensal = calculado?.teMensal ?? kWhFaturados * row.te
                    const totalMensal = calculado?.totalMensal ?? tusdMensal + teMensal
                    const creditosDistribuidosTexto = formatKwhWithUnit(creditosDistribuidos)
                    const kWhFaturadosTexto = formatKwhWithUnit(kWhFaturados)
                    const kWhCompensadosTexto = formatKwhWithUnit(kWhCompensados)

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="multi-uc-id">
                            <strong>{row.id}</strong>
                            <span className="muted">UC {index + 1}</span>
                          </div>
                        </td>
                        <td>
                          <select
                            value={row.classe}
                            onChange={(event) =>
                              onHandleMultiUcClasseChange(row.id, event.target.value as MultiUcClasse)
                            }
                          >
                            {MULTI_UC_CLASSES.map((classe) => (
                              <option key={classe} value={classe}>
                                {MULTI_UC_CLASS_LABELS[classe]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={row.consumoKWh}
                            onChange={(event) =>
                              onHandleMultiUcConsumoChange(row.id, Number(event.target.value) || 0)
                            }
                            onFocus={selectNumberInputOnFocus}
                          />
                        </td>
                        <td>
                          {multiUcRateioModo === 'percentual' ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={row.rateioPercentual}
                              onChange={(event) =>
                                onHandleMultiUcRateioPercentualChange(row.id, Number(event.target.value) || 0)
                              }
                              onFocus={selectNumberInputOnFocus}
                            />
                          ) : (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.manualRateioKWh ?? 0}
                              onChange={(event) =>
                                onHandleMultiUcManualRateioChange(row.id, Number(event.target.value) || 0)
                              }
                              onFocus={selectNumberInputOnFocus}
                            />
                          )}
                        </td>
                        <td>{creditosDistribuidosTexto}</td>
                        <td>{kWhFaturadosTexto}</td>
                        <td>{kWhCompensadosTexto}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            value={row.te}
                            onChange={(event) => onHandleMultiUcTeChange(row.id, Number(event.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            value={row.tusdTotal}
                            onChange={(event) => onHandleMultiUcTusdTotalChange(row.id, Number(event.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            value={row.tusdFioB}
                            onChange={(event) => onHandleMultiUcTusdFioBChange(row.id, Number(event.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </td>
                        <td>{tarifaCurrency(tusdOutros)}</td>
                        <td>{currency(tusdMensal)}</td>
                        <td>{currency(teMensal)}</td>
                        <td>{currency(totalMensal)}</td>
                        <td>
                          <input
                            type="text"
                            value={row.observacoes}
                            onChange={(event) => onHandleMultiUcObservacoesChange(row.id, event.target.value)}
                            placeholder="Anotações"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="multi-uc-remove"
                            onClick={() => onHandleMultiUcRemover(row.id)}
                            disabled={multiUcRows.length <= 1}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="multi-uc-disabled-hint">
            Ative o modo multi-UC para cadastrar unidades consumidoras adicionais, tarifários por classe e aplicar
            o escalonamento da TUSD não compensável.
          </p>
        )}
      </div>
      ) : null}
    </section>
  )
}
