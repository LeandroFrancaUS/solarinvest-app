import React from 'react'
import { formatNumberBRWithOptions } from '../lib/locale/br-number'
import type { VendaForm } from '../lib/finance/roi'
import type { TipoClienteTUSD } from '../lib/finance/tusd'
import type { SegmentoCliente } from '../lib/finance/roi'
import { selectNumberInputOnFocus } from '../utils/focusHandlers'
import { InfoTooltip, labelWithTooltip } from './InfoTooltip'
import { Field, FieldError } from './ui/Field'
import { Switch } from './ui/switch'
import { TusdParametersSection } from './TusdParametersSection'
import type { TarifaCheiaFieldHandlers } from './ParametrosPrincipaisSection'
import { UF_LABELS } from '../app/config'

export interface VendaParametrosSectionProps {
  // ── State: parâmetros principais ─────────────────────────────────────────
  vendaForm: VendaForm
  vendaFormErrors: Record<string, string>
  taxaMinimaInputEmpty: boolean
  taxaMinima: number
  tipoRedeLabel: string
  tarifaCheiaVendaField: TarifaCheiaFieldHandlers
  baseIrradiacao: number

  // ── State: TUSD ───────────────────────────────────────────────────────────
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

  // ── State: UF / distribuidora ─────────────────────────────────────────────
  ufTarifa: string
  ufsDisponiveis: string[]
  distribuidoraTarifa: string
  distribuidorasDisponiveis: string[]

  // ── Helpers de cálculo ────────────────────────────────────────────────────
  calcularModulosPorGeracao: (geracaoAlvo: number) => number | null
  calcularPotenciaSistemaKwp: (modulos: number) => number
  estimarGeracaoPorPotencia: (potenciaKwp: number) => number
  normalizarGeracaoMensal: (valor: number) => number
  normalizarPotenciaKwp: (valor: number) => number
  normalizeTaxaMinimaInputValue: (rawValue: string) => number

  // ── Callbacks: parâmetros principais ─────────────────────────────────────
  onSetNumeroModulosManual: (value: number | '') => void
  onSetKcKwhMes: (value: number, origin: 'auto' | 'user') => void
  onApplyVendaUpdates: (updates: Partial<VendaForm>) => void
  onSetInflacaoAa: (value: number) => void
  onHandleParametrosUfChange: (value: string) => void
  onHandleParametrosDistribuidoraChange: (value: string) => void

  // ── Callbacks: TUSD ──────────────────────────────────────────────────────
  onSetTusdPercent: (value: number) => void
  onTusdTipoClienteChange: (value: TipoClienteTUSD) => void
  onSetTusdSubtipo: (value: string) => void
  onTusdSimultaneidadeFromSource: (value: number | null, source: 'auto' | 'manual') => void
  onSetTusdTarifaRkwh: (value: number | null) => void
  onSetTusdAnoReferencia: (value: number) => void
  onSetTusdOpcoesExpandidas: (checked: boolean) => void
  onSetTipoEdificacaoOutro: (value: string) => void
  onResetRetorno: () => void
}

export function VendaParametrosSection({
  vendaForm,
  vendaFormErrors,
  taxaMinimaInputEmpty,
  taxaMinima,
  tipoRedeLabel,
  tarifaCheiaVendaField,
  baseIrradiacao,
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
  ufTarifa,
  ufsDisponiveis,
  distribuidoraTarifa,
  distribuidorasDisponiveis,
  calcularModulosPorGeracao,
  calcularPotenciaSistemaKwp,
  estimarGeracaoPorPotencia,
  normalizarGeracaoMensal,
  normalizarPotenciaKwp,
  normalizeTaxaMinimaInputValue,
  onSetNumeroModulosManual,
  onSetKcKwhMes,
  onApplyVendaUpdates,
  onSetInflacaoAa,
  onHandleParametrosUfChange,
  onHandleParametrosDistribuidoraChange,
  onSetTusdPercent,
  onTusdTipoClienteChange,
  onSetTusdSubtipo,
  onTusdSimultaneidadeFromSource,
  onSetTusdTarifaRkwh,
  onSetTusdAnoReferencia,
  onSetTusdOpcoesExpandidas,
  onSetTipoEdificacaoOutro,
  onResetRetorno,
}: VendaParametrosSectionProps) {
  return (
    <section className="card">
      <h2>Parâmetros principais</h2>
      <div className="grid g3">
        <Field
          label={
            <>
              Consumo (kWh/mês)
              <InfoTooltip text="Consumo médio mensal utilizado para projetar a geração e a economia." />
            </>
          }
        >
          <input
            type="number"
            min={0}
            value={
              Number.isFinite(vendaForm.consumo_kwh_mes) ? vendaForm.consumo_kwh_mes : ''
            }
            onChange={(event) => {
              const { value } = event.target
              if (value === '') {
                onSetNumeroModulosManual('')
                onSetKcKwhMes(0, 'auto')
                onApplyVendaUpdates({
                  consumo_kwh_mes: undefined,
                  geracao_estimada_kwh_mes: undefined,
                  potencia_instalada_kwp: undefined,
                  quantidade_modulos: undefined,
                })
                return
              }

              const parsed = Number(value)
              const consumoDesejado = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              const modulosCalculados = calcularModulosPorGeracao(consumoDesejado)

              let potenciaCalculada = 0
              let geracaoCalculada = consumoDesejado

              if (modulosCalculados != null) {
                potenciaCalculada = calcularPotenciaSistemaKwp(modulosCalculados)
                if (potenciaCalculada > 0) {
                  const estimada = estimarGeracaoPorPotencia(potenciaCalculada)
                  if (estimada > 0) {
                    geracaoCalculada = normalizarGeracaoMensal(estimada)
                  }
                }
              }

              if (geracaoCalculada <= 0 && consumoDesejado > 0) {
                geracaoCalculada = consumoDesejado
              }

              const consumoFinal = consumoDesejado
              onSetKcKwhMes(consumoFinal, 'user')

              onApplyVendaUpdates({
                consumo_kwh_mes: consumoFinal,
                geracao_estimada_kwh_mes:
                  geracaoCalculada > 0
                    ? geracaoCalculada
                    : consumoFinal === 0
                    ? 0
                    : undefined,
                potencia_instalada_kwp:
                  potenciaCalculada > 0
                    ? normalizarPotenciaKwp(potenciaCalculada)
                    : consumoFinal === 0
                    ? 0
                    : undefined,
                quantidade_modulos: modulosCalculados ?? undefined,
              })

              if (modulosCalculados != null) {
                onSetNumeroModulosManual('')
              }
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.consumo_kwh_mes} />
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
            'Valor cobrado por kWh sem descontos contratuais; base para calcular a conta de energia projetada.',
          )}
        >
          <input
            type="text"
            inputMode="decimal"
            value={tarifaCheiaVendaField.value}
            onChange={tarifaCheiaVendaField.onChange}
            onFocus={tarifaCheiaVendaField.onFocus}
            onBlur={tarifaCheiaVendaField.onBlur}
            onKeyDown={tarifaCheiaVendaField.onKeyDown}
          />
          <FieldError message={vendaFormErrors.tarifa_cheia_r_kwh} />
        </Field>
        <Field
          label={labelWithTooltip(
            'Custos Fixos da Conta de Energia (R$/MÊS)',
            'Total de custos fixos mensais cobrados pela distribuidora, mesmo com créditos suficientes para zerar o consumo.',
          )}
        >
          <input
            type="number"
            min={0}
            value={
              taxaMinimaInputEmpty
                ? ''
                : Number.isFinite(vendaForm.taxa_minima_mensal)
                ? vendaForm.taxa_minima_mensal
                : taxaMinima
            }
            onChange={(event) => {
              const normalized = normalizeTaxaMinimaInputValue(event.target.value)
              onApplyVendaUpdates({ taxa_minima_mensal: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.taxa_minima_mensal} />
        </Field>
      </div>
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
        onTusdPercentChange={(normalized) => {
          onSetTusdPercent(normalized)
          onApplyVendaUpdates({ tusd_percentual: normalized })
          onResetRetorno()
        }}
        onTusdTipoClienteChange={onTusdTipoClienteChange}
        onTusdSubtipoChange={(value) => {
          onSetTusdSubtipo(value)
          onApplyVendaUpdates({ tusd_subtipo: value || undefined })
          onResetRetorno()
        }}
        onTusdSimultaneidadeChange={(value) => {
          onTusdSimultaneidadeFromSource(value, 'manual')
          onResetRetorno()
        }}
        onTusdTarifaRkwhChange={(value) => {
          onSetTusdTarifaRkwh(value)
          onApplyVendaUpdates({ tusd_tarifa_r_kwh: value ?? undefined })
          onResetRetorno()
        }}
        onTusdAnoReferenciaChange={(value) => {
          onSetTusdAnoReferencia(value)
          onApplyVendaUpdates({ tusd_ano_referencia: value })
          onResetRetorno()
        }}
        onTusdOpcoesExpandidasChange={onSetTusdOpcoesExpandidas}
        onTipoEdificacaoOutroChange={onSetTipoEdificacaoOutro}
      />
      <div className="grid g3">
        <Field
          label={
            <>
              Inflação de energia (% a.a.)
              <InfoTooltip text="Reajuste anual estimado para a tarifa de energia." />
            </>
          }
        >
          <input
            type="number"
            step="0.1"
            value={
              Number.isFinite(vendaForm.inflacao_energia_aa_pct)
                ? vendaForm.inflacao_energia_aa_pct
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              onSetInflacaoAa(normalized)
              onApplyVendaUpdates({ inflacao_energia_aa_pct: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Horizonte de análise (meses)',
            'Quantidade de meses simulados para payback, ROI e fluxo de caixa projetado.',
          )}
        >
          <input
            type="number"
            min={1}
            step={1}
            value={
              Number.isFinite(vendaForm.horizonte_meses) ? vendaForm.horizonte_meses : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed)
                ? Math.max(1, Math.round(parsed))
                : 1
              onApplyVendaUpdates({ horizonte_meses: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.horizonte_meses} />
        </Field>
        <Field
          label={
            <>
              Taxa de desconto (% a.a.)
              <InfoTooltip text="Opcional: utilizada para calcular o Valor Presente Líquido (VPL)." />
            </>
          }
        >
          <input
            type="number"
            step="0.1"
            min={0}
            value={
              Number.isFinite(vendaForm.taxa_desconto_aa_pct)
                ? vendaForm.taxa_desconto_aa_pct
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (event.target.value === '') {
                onApplyVendaUpdates({ taxa_desconto_aa_pct: undefined })
                return
              }
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              onApplyVendaUpdates({ taxa_desconto_aa_pct: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.taxa_desconto_aa_pct} />
        </Field>
      </div>
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'UF (ANEEL)',
            'Estado utilizado para consultar automaticamente tarifas homologadas e irradiação base.',
          )}
        >
          <select value={ufTarifa} onChange={(event) => onHandleParametrosUfChange(event.target.value)}>
            <option value="">Selecione a UF</option>
            {ufsDisponiveis.map((uf) => (
              <option key={uf} value={uf}>
                {uf} — {UF_LABELS[uf] ?? uf}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Distribuidora (ANEEL)',
            'Concessionária da UC; determina TE, TUSD e reajustes aplicados nas simulações.',
          )}
        >
          <select
            value={distribuidoraTarifa}
            onChange={(event) => onHandleParametrosDistribuidoraChange(event.target.value)}
            disabled={!ufTarifa || distribuidorasDisponiveis.length === 0}
          >
            <option value="">
              {ufTarifa ? 'Selecione a distribuidora' : 'Selecione a UF'}
            </option>
            {distribuidorasDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            <>
              Irradiação média (kWh/m²/dia)
              <InfoTooltip text="Valor sugerido automaticamente conforme a UF ou distribuidora." />
            </>
          }
          hint="Atualizado automaticamente conforme a região selecionada."
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
    </section>
  )
}
