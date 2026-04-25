// src/features/simulacoes/AnaliseFinanceiraSection.tsx
// Extracted from App.tsx (Subfase 2B.12.4A).
// Renders the full Análise Financeira block when simulacoesSection === 'analise'.

import type React from 'react'
import { Field } from '../../components/ui/Field'
import { InfoTooltip, labelWithTooltip } from '../../components/InfoTooltip'
import { currency } from '../../utils/formatters'
import { formatMoneyBR } from '../../lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER } from '../../lib/locale/useBRNumberField'
import { BASE_CITY_NAME } from '../../shared/geocoding'
import type { CidadeDB } from '../../data/cidades'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'
import type { VendasConfig } from '../../types/vendasConfig'
import {
  type AprovacaoChecklistKey,
  type AprovacaoStatus,
  APROVACAO_SELLOS,
} from './simulacoesConstants'

// Structural type matching the return value of useBRNumberField.
type MoneyFieldHandle = {
  ref: React.RefObject<HTMLInputElement>
  text: string
  setText: React.Dispatch<React.SetStateAction<string>>
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleBlur: () => void
  handleFocus: (event: React.FocusEvent<HTMLInputElement>) => void
}

const formatAprovacaoData = (timestamp: number | null): string => {
  if (!timestamp) {
    return '—'
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(timestamp),
    )
  } catch (_error) {
    return '—'
  }
}

export interface AnaliseFinanceiraSectionProps {
  afModo: 'venda' | 'leasing'
  setAfModo: (modo: 'venda' | 'leasing') => void
  afConsumoOverride: number
  setAfConsumoOverride: (v: number) => void
  afNumModulosOverride: number | null
  setAfNumModulosOverride: (v: number | null) => void
  afModuloWpOverride: number
  setAfModuloWpOverride: (v: number) => void
  afIrradiacaoOverride: number
  setAfIrradiacaoOverride: (v: number) => void
  afPROverride: number
  setAfPROverride: (v: number) => void
  afDiasOverride: number
  setAfDiasOverride: (v: number) => void

  potenciaModulo: number
  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number

  afCustoKitField: MoneyFieldHandle
  afValorContratoField: MoneyFieldHandle
  afFreteField: MoneyFieldHandle
  afDescarregamentoField: MoneyFieldHandle
  afMaterialCAField: MoneyFieldHandle
  afPlacaField: MoneyFieldHandle
  afProjetoField: MoneyFieldHandle
  afCreaField: MoneyFieldHandle
  afHotelPousadaField: MoneyFieldHandle
  afTransporteCombustivelField: MoneyFieldHandle
  afOutrosField: MoneyFieldHandle
  afMensalidadeBaseField: MoneyFieldHandle

  afAutoMaterialCA: number
  setAfAutoMaterialCA: (v: number) => void
  afMaterialCAOverride: number | null
  setAfMaterialCAOverride: (v: number | null) => void
  afProjetoOverride: number | null
  setAfProjetoOverride: (v: number | null) => void
  afCreaOverride: number | null
  setAfCreaOverride: (v: number | null) => void
  afCustoKit: number
  setAfCustoKit: (v: number) => void
  setAfCustoKitManual: (v: boolean) => void
  afFrete: number
  setAfFrete: (v: number) => void
  setAfFreteManual: (v: boolean) => void
  afDescarregamento: number
  setAfDescarregamento: (v: number) => void
  afHotelPousada: number
  setAfHotelPousada: (v: number) => void
  afTransporteCombustivel: number
  setAfTransporteCombustivel: (v: number) => void
  afOutros: number
  setAfOutros: (v: number) => void
  afValorContrato: number
  setAfValorContrato: (v: number) => void
  afPlaca: number
  setAfPlaca: (v: number) => void
  afMensalidadeBase: number
  setAfMensalidadeBase: (v: number) => void
  afMensalidadeBaseAuto: number

  afImpostosVenda: number
  setAfImpostosVenda: (v: number) => void
  afImpostosLeasing: number
  setAfImpostosLeasing: (v: number) => void
  afMargemLiquidaVenda: number
  setAfMargemLiquidaVenda: (v: number) => void
  afMargemLiquidaMinima: number
  setAfMargemLiquidaMinima: (v: number) => void
  afComissaoMinimaPercent: number
  setAfComissaoMinimaPercent: (v: number) => void
  afTaxaDesconto: number
  setAfTaxaDesconto: (v: number) => void
  afInadimplencia: number
  setAfInadimplencia: (v: number) => void
  afCustoOperacional: number
  setAfCustoOperacional: (v: number) => void
  afMesesProjecao: number
  setAfMesesProjecao: (v: number) => void

  afCidadeDestino: string
  setAfCidadeDestino: (v: string) => void
  afCidadeSuggestions: CidadeDB[]
  setAfCidadeSuggestions: (v: CidadeDB[]) => void
  afCidadeShowSuggestions: boolean
  setAfCidadeShowSuggestions: (v: boolean) => void
  afDeslocamentoStatus: 'idle' | 'loading' | 'ok' | 'isenta' | 'error'
  setAfDeslocamentoStatus: (v: 'idle' | 'loading' | 'ok' | 'isenta' | 'error') => void
  afDeslocamentoCidadeLabel: string
  setAfDeslocamentoCidadeLabel: (v: string) => void
  afDeslocamentoKm: number
  setAfDeslocamentoKm: (v: number) => void
  afDeslocamentoRs: number
  setAfDeslocamentoRs: (v: number) => void
  afDeslocamentoErro: string
  setAfDeslocamentoErro: (v: string) => void
  afCidadeBlurTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  handleSelectCidade: (city: CidadeDB) => void

  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  indicadorEficienciaProjeto: { score: number; classificacao: string } | null
  vendasConfig: VendasConfig

  aprovacaoChecklist: Record<AprovacaoChecklistKey, boolean>
  toggleAprovacaoChecklist: (key: AprovacaoChecklistKey) => void
  aprovacaoStatus: AprovacaoStatus
  ultimaDecisaoTimestamp: number | null
  registrarDecisaoInterna: (status: AprovacaoStatus) => void

  afBaseInitializedRef: React.MutableRefObject<boolean>
  selectNumberInputOnFocus: (e: React.FocusEvent<HTMLInputElement>) => void

  // Extra props used in the block but not in the original list
  kcKwhMes: number
  isAnaliseMobileSimpleView: boolean
}

export function AnaliseFinanceiraSection({
  afModo,
  setAfModo,
  afConsumoOverride,
  setAfConsumoOverride,
  afNumModulosOverride,
  setAfNumModulosOverride,
  afModuloWpOverride,
  setAfModuloWpOverride,
  afIrradiacaoOverride,
  setAfIrradiacaoOverride,
  afPROverride,
  setAfPROverride,
  afDiasOverride,
  potenciaModulo,
  baseIrradiacao,
  eficienciaNormalizada,
  diasMesNormalizado,
  afCustoKitField,
  afValorContratoField,
  afFreteField,
  afDescarregamentoField,
  afMaterialCAField,
  afPlacaField,
  afProjetoField,
  afCreaField,
  afHotelPousadaField,
  afTransporteCombustivelField,
  afOutrosField,
  afMensalidadeBaseField,
  setAfAutoMaterialCA,
  setAfMaterialCAOverride,
  setAfProjetoOverride,
  setAfCreaOverride,
  setAfCustoKit,
  setAfCustoKitManual,
  setAfFrete,
  setAfFreteManual,
  setAfDescarregamento,
  setAfHotelPousada,
  setAfTransporteCombustivel,
  setAfOutros,
  afValorContrato,
  setAfValorContrato,
  setAfMensalidadeBase,
  afMensalidadeBaseAuto,
  afImpostosVenda,
  setAfImpostosVenda,
  afImpostosLeasing,
  setAfImpostosLeasing,
  afMargemLiquidaVenda,
  setAfMargemLiquidaVenda,
  afMargemLiquidaMinima,
  setAfMargemLiquidaMinima,
  afComissaoMinimaPercent,
  setAfComissaoMinimaPercent,
  afTaxaDesconto,
  setAfTaxaDesconto,
  afInadimplencia,
  setAfInadimplencia,
  afCustoOperacional,
  setAfCustoOperacional,
  afMesesProjecao,
  setAfMesesProjecao,
  afCidadeDestino,
  setAfCidadeDestino,
  afCidadeSuggestions,
  setAfCidadeSuggestions,
  afCidadeShowSuggestions,
  setAfCidadeShowSuggestions,
  afDeslocamentoStatus,
  setAfDeslocamentoStatus,
  afDeslocamentoCidadeLabel,
  setAfDeslocamentoCidadeLabel,
  afDeslocamentoKm,
  setAfDeslocamentoKm,
  afDeslocamentoRs,
  setAfDeslocamentoRs,
  afDeslocamentoErro,
  setAfDeslocamentoErro,
  afCidadeBlurTimerRef,
  handleSelectCidade,
  analiseFinanceiraResult,
  indicadorEficienciaProjeto,
  vendasConfig,
  aprovacaoChecklist,
  toggleAprovacaoChecklist,
  aprovacaoStatus,
  ultimaDecisaoTimestamp,
  registrarDecisaoInterna,
  afBaseInitializedRef,
  selectNumberInputOnFocus,
  kcKwhMes,
  isAnaliseMobileSimpleView,
}: AnaliseFinanceiraSectionProps) {
  return (
    <section className="simulacoes-module-card af-section">
      <header>
        <h3>Análise Financeira</h3>
        <p>Motor Spreadsheet v1 — cálculo completo de Venda e Leasing com preço mínimo saudável.</p>
      </header>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setAfConsumoOverride(0)
            setAfNumModulosOverride(null)
            // Clear manual-edit flags so future consumo changes auto-update Kit, Frete and Material CA
            setAfCustoKitManual(false)
            setAfFreteManual(false)
            // Directly apply the updated formulas using current proposal consumo
            setAfCustoKit(kcKwhMes > 0 ? Math.round(1500 + 9.5 * kcKwhMes) : 0)
            setAfFrete(kcKwhMes > 0 ? Math.round(300 + 0.52 * kcKwhMes) : 0)
            setAfAutoMaterialCA(kcKwhMes > 0 ? Math.max(1000, Math.round(850 + 0.4 * kcKwhMes)) : 0)
            setAfValorContrato(0)
            setAfDescarregamento(0)
            setAfHotelPousada(0)
            setAfTransporteCombustivel(0)
            setAfOutros(0)
            setAfCidadeDestino('')
            setAfDeslocamentoKm(0)
            setAfDeslocamentoRs(0)
            setAfDeslocamentoStatus('idle')
            setAfDeslocamentoCidadeLabel('')
            setAfDeslocamentoErro('')
            setAfMaterialCAOverride(null)
            setAfProjetoOverride(null)
            setAfCreaOverride(null)
            setAfCidadeSuggestions([])
            setAfCidadeShowSuggestions(false)
            setAfMensalidadeBase(0)
            afBaseInitializedRef.current = false
          }}
        >
          Nova Análise
        </button>
      </div>

      {/* Mode tabs */}
      <div
        className="cfg-tabs af-mode-tabs"
        role="tablist"
        aria-label="Modo de análise"
        style={{ marginBottom: '1rem' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={afModo === 'venda'}
          className={`cfg-tab af-mode-tab${afModo === 'venda' ? ' is-active' : ''}`}
          onClick={() => setAfModo('venda')}
        >
          Venda
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={afModo === 'leasing'}
          className={`cfg-tab af-mode-tab${afModo === 'leasing' ? ' is-active' : ''}`}
          onClick={() => setAfModo('leasing')}
        >
          Leasing
        </button>
      </div>

      {/* System base info (editable overrides) */}
      <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
        <h4>Base do sistema</h4>
        <div className="grid g3">
          <Field label="Consumo (kWh/mês)">
            <input
              type="number"
              value={afConsumoOverride}
              min={0}
              onFocus={selectNumberInputOnFocus}
              onChange={(e) => {
                const consumo = Number(e.target.value) || 0
                setAfConsumoOverride(consumo)
                if (consumo > 0) {
                  const modWp = afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo
                  const irr = afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao
                  const pr = afPROverride > 0 ? afPROverride : eficienciaNormalizada
                  const dias = afDiasOverride > 0 ? afDiasOverride : diasMesNormalizado
                  const fator = irr * pr * dias
                  if (fator > 0 && modWp > 0) {
                    const n = Math.max(1, Math.ceil((consumo / fator * 1000) / modWp))
                    setAfNumModulosOverride(n)
                  } else {
                    setAfNumModulosOverride(null)
                  }
                } else {
                  setAfNumModulosOverride(null)
                }
              }}
            />
          </Field>
          <Field label="Nº de módulos (estimado)">
            <input
              type="number"
              min={0}
              value={afNumModulosOverride ?? 0}
              onFocus={selectNumberInputOnFocus}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value) || 0)
                if (n > 0) {
                  setAfNumModulosOverride(n)
                  const modWp = afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo
                  const irr = afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao
                  const pr = afPROverride > 0 ? afPROverride : eficienciaNormalizada
                  const dias = afDiasOverride > 0 ? afDiasOverride : diasMesNormalizado
                  const fator = irr * pr * dias
                  if (fator > 0 && modWp > 0) {
                    const kwp = (n * modWp) / 1000
                    setAfConsumoOverride(Math.round(kwp * fator * 100) / 100)
                  }
                } else {
                  setAfNumModulosOverride(null)
                  setAfConsumoOverride(0)
                }
              }}
            />
          </Field>
          <Field label="Potência do sistema (kWp)">
            <input
              type="number"
              step="0.01"
              min={0}
              value={
                afNumModulosOverride != null && afNumModulosOverride > 0
                  ? ((afNumModulosOverride * (afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo)) / 1000).toFixed(2)
                  : '0'
              }
              onFocus={selectNumberInputOnFocus}
              onChange={(e) => {
                const kwp = Number(e.target.value) || 0
                const modWp = afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo
                if (kwp > 0 && modWp > 0) {
                  const n = Math.max(1, Math.ceil((kwp * 1000) / modWp))
                  setAfNumModulosOverride(n)
                  const irr = afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao
                  const pr = afPROverride > 0 ? afPROverride : eficienciaNormalizada
                  const dias = afDiasOverride > 0 ? afDiasOverride : diasMesNormalizado
                  const fator = irr * pr * dias
                  if (fator > 0) {
                    setAfConsumoOverride(Math.round(kwp * fator * 100) / 100)
                  }
                } else {
                  setAfNumModulosOverride(null)
                  setAfConsumoOverride(0)
                }
              }}
            />
          </Field>
          <Field label="Irradiação (kWh/m²/dia)">
            <input
              type="number"
              step="0.01"
              value={afIrradiacaoOverride > 0 ? afIrradiacaoOverride : baseIrradiacao}
              min={0}
              onFocus={selectNumberInputOnFocus}
              onChange={(e) => setAfIrradiacaoOverride(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Performance ratio">
            <input
              type="number"
              step="0.001"
              value={afPROverride > 0 ? afPROverride : eficienciaNormalizada}
              min={0}
              max={1}
              onFocus={selectNumberInputOnFocus}
              onChange={(e) => setAfPROverride(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Módulo (Wp)">
            <input
              type="number"
              value={afModuloWpOverride > 0 ? afModuloWpOverride : potenciaModulo}
              min={1}
              onFocus={selectNumberInputOnFocus}
              onChange={(e) => {
                const wp = Number(e.target.value) || 0
                setAfModuloWpOverride(wp)
            }}
            />
          </Field>
        </div>
      </div>

      {/* Editable inputs */}
      <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
        <h4>Custos diretos</h4>
        <div className="grid g3">
          <Field label="Custo do Kit (R$)">
            <input
              ref={afCustoKitField.ref}
              type="text"
              inputMode="decimal"
              value={afCustoKitField.text}
              style={{ outline: '2px solid var(--color-accent, #2563eb)', borderRadius: '4px' }}
              onChange={afCustoKitField.handleChange}
              onBlur={afCustoKitField.handleBlur}
              onFocus={afCustoKitField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label="Frete (R$)">
            <input
              ref={afFreteField.ref}
              type="text"
              inputMode="decimal"
              value={afFreteField.text}
              onChange={afFreteField.handleChange}
              onBlur={afFreteField.handleBlur}
              onFocus={afFreteField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label="Descarregamento (R$)">
            <input
              ref={afDescarregamentoField.ref}
              type="text"
              inputMode="decimal"
              value={afDescarregamentoField.text}
              onChange={afDescarregamentoField.handleChange}
              onBlur={afDescarregamentoField.handleBlur}
              onFocus={afDescarregamentoField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label="Material CA (R$)">
            <input
              ref={afMaterialCAField.ref}
              type="text"
              inputMode="decimal"
              value={afMaterialCAField.text}
              onChange={afMaterialCAField.handleChange}
              onBlur={afMaterialCAField.handleBlur}
              onFocus={afMaterialCAField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label="Placa (R$)">
            <input
              ref={afPlacaField.ref}
              type="text"
              inputMode="decimal"
              value={afPlacaField.text}
              onChange={afPlacaField.handleChange}
              onBlur={afPlacaField.handleBlur}
              onFocus={afPlacaField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label={labelWithTooltip('Projeto (R$)', 'Custo do projeto elétrico. Calculado automaticamente pela potência do sistema, mas pode ser editado manualmente.')}>
            <input
              ref={afProjetoField.ref}
              type="text"
              inputMode="decimal"
              value={afProjetoField.text}
              onChange={afProjetoField.handleChange}
              onBlur={afProjetoField.handleBlur}
              onFocus={afProjetoField.handleFocus}
              placeholder={analiseFinanceiraResult ? formatMoneyBR(analiseFinanceiraResult.custo_projeto_rs) : MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label={labelWithTooltip('CREA (R$)', 'Taxa do Conselho Regional de Engenharia. Calculada automaticamente pela UF, mas pode ser editada manualmente.')}>
            <input
              ref={afCreaField.ref}
              type="text"
              inputMode="decimal"
              value={afCreaField.text}
              onChange={afCreaField.handleChange}
              onBlur={afCreaField.handleBlur}
              onFocus={afCreaField.handleFocus}
              placeholder={analiseFinanceiraResult ? formatMoneyBR(analiseFinanceiraResult.crea_rs) : MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label="Instalação (R$)">
            <input
              type="number"
              value={
                analiseFinanceiraResult
                  ? analiseFinanceiraResult.quantidade_modulos * 70
                  : 0
              }
              readOnly
              disabled
            />
          </Field>
          <Field label="Hotel/Pousada (R$)">
            <input
              ref={afHotelPousadaField.ref}
              type="text"
              inputMode="decimal"
              value={afHotelPousadaField.text}
              onChange={afHotelPousadaField.handleChange}
              onBlur={afHotelPousadaField.handleBlur}
              onFocus={afHotelPousadaField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label="Transporte/Combustível (R$)">
            <input
              ref={afTransporteCombustivelField.ref}
              type="text"
              inputMode="decimal"
              value={afTransporteCombustivelField.text}
              readOnly
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
            {afDeslocamentoStatus === 'isenta' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-success-fg, green)' }}>
                ✓ {afDeslocamentoCidadeLabel} — Região isenta (R$0)
              </span>
            )}
            {afDeslocamentoStatus === 'ok' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-info-fg, #2563eb)' }}>
                ✓ {afDeslocamentoCidadeLabel} — {afDeslocamentoKm} km ida+volta → {formatMoneyBR(afDeslocamentoRs)}
              </span>
            )}
            {afDeslocamentoStatus === 'error' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-error-fg, red)' }}>
                ⚠ {afDeslocamentoErro}
              </span>
            )}
          </Field>
          <Field label="Outros (R$)">
            <input
              ref={afOutrosField.ref}
              type="text"
              inputMode="decimal"
              value={afOutrosField.text}
              onChange={afOutrosField.handleChange}
              onBlur={afOutrosField.handleBlur}
              onFocus={afOutrosField.handleFocus}
              placeholder={MONEY_INPUT_PLACEHOLDER}
            />
          </Field>
          <Field label={`Impostos (%) — ${afModo === 'venda' ? 'Venda' : 'Leasing'}`}>
            <input
              type="number"
              value={afModo === 'venda' ? afImpostosVenda : afImpostosLeasing}
              min={0}
              max={100}
              onChange={(e) => {
                const val = Number(e.target.value) || 0
                if (afModo === 'venda') setAfImpostosVenda(val)
                else setAfImpostosLeasing(val)
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          {afModo === 'venda' ? (
            <>
              <Field label="Margem líquida alvo (%)">
                <input
                  type="number"
                  value={afMargemLiquidaVenda}
                  min={0}
                  max={99}
                  onChange={(e) => setAfMargemLiquidaVenda(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field label="Margem líquida mínima (%)">
                <input
                  type="number"
                  value={afMargemLiquidaMinima}
                  min={0}
                  max={99}
                  onChange={(e) => setAfMargemLiquidaMinima(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
            </>
          ) : null}
          <Field label={labelWithTooltip('Taxa de desconto VPL (% a.a.)', 'Taxa anual usada para calcular o VPL (Valor Presente Líquido). Deixe em 0 para não calcular o VPL.')}>
            <input
              type="number"
              value={afTaxaDesconto}
              min={0}
              max={100}
              step={0.5}
              onChange={(e) => setAfTaxaDesconto(Number(e.target.value) || 0)}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          {afModo === 'leasing' ? (
            <>
              <Field label="Inadimplência (%)">
                <input
                  type="number"
                  value={afInadimplencia}
                  min={0}
                  max={100}
                  onChange={(e) => setAfInadimplencia(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field label="Custo operacional (%)">
                <input
                  type="number"
                  value={afCustoOperacional}
                  min={0}
                  max={100}
                  onChange={(e) => setAfCustoOperacional(Number(e.target.value) || 0)}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field label="Horizonte de análise (meses)">
                <input
                  type="number"
                  value={afMesesProjecao}
                  min={1}
                  onChange={(e) => setAfMesesProjecao(Math.max(1, Number(e.target.value) || 1))}
                  onFocus={selectNumberInputOnFocus}
                />
              </Field>
              <Field label="Mensalidade base (R$)">
                <input
                  ref={afMensalidadeBaseField.ref}
                  type="text"
                  inputMode="decimal"
                  value={afMensalidadeBaseField.text}
                  onChange={afMensalidadeBaseField.handleChange}
                  onBlur={afMensalidadeBaseField.handleBlur}
                  onFocus={afMensalidadeBaseField.handleFocus}
                  placeholder={afMensalidadeBaseAuto > 0 ? formatMoneyBR(afMensalidadeBaseAuto) : '—'}
                />
              </Field>
            </>
          ) : null}
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <Field label={labelWithTooltip('UF / Cidade', `Digite a cidade para definir a UF e calcular automaticamente o custo de deslocamento da equipe a partir de ${BASE_CITY_NAME}.`)}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={afCidadeDestino}
                onChange={(e) => {
                  setAfCidadeDestino(e.target.value)
                  setAfCidadeShowSuggestions(true)
                  if (!e.target.value.trim()) {
                    setAfDeslocamentoStatus('idle')
                    setAfDeslocamentoKm(0)
                    setAfDeslocamentoRs(0)
                    setAfDeslocamentoCidadeLabel('')
                    setAfDeslocamentoErro('')
                    setAfTransporteCombustivel(0)
                  }
                }}
                onFocus={() => {
                  if (afCidadeBlurTimerRef.current) clearTimeout(afCidadeBlurTimerRef.current)
                  setAfCidadeShowSuggestions(true)
                }}
                onBlur={() => {
                  afCidadeBlurTimerRef.current = setTimeout(() => setAfCidadeShowSuggestions(false), 150)
                }}
                placeholder="Ex: Goiânia ou goiania ou Brasilia"
                autoComplete="off"
                spellCheck={false}
              />
              {afCidadeShowSuggestions && afCidadeSuggestions.length > 0 && (
                <ul style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  listStyle: 'none',
                  margin: 0,
                  padding: '0.25rem 0',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {afCidadeSuggestions.map((city) => (
                    <li
                      key={`${city.cidade}-${city.uf}`}
                      onMouseDown={() => handleSelectCidade(city)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      {city.cidade} — {city.uf}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
        </div>
        <p className="simulacoes-description" style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
          Parâmetros fixos (custo fixo rateado {vendasConfig.af_custo_fixo_rateado_percent}%, lucro mínimo {vendasConfig.af_lucro_minimo_percent}%) configurados em Preferências → Parâmetros de Vendas.
        </p>
      </div>

      {/* Results */}
      {analiseFinanceiraResult ? (
        <>
          {/* Venda results — hidden for leasing */}
          {afModo === 'venda' && analiseFinanceiraResult.custo_variavel_total_rs != null ? (
            <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
              <h4>Resultados</h4>
              {afModo === 'venda' ? (
                <div style={{ marginBottom: '0.75rem' }}>
                  <Field label="Valor do Contrato (R$)">
                    <input
                      ref={afValorContratoField.ref}
                      type="text"
                      inputMode="decimal"
                      value={afValorContratoField.text}
                      style={{ outline: '2px solid var(--color-accent, #2563eb)', borderRadius: '4px' }}
                      onChange={afValorContratoField.handleChange}
                      onBlur={afValorContratoField.handleBlur}
                      onFocus={afValorContratoField.handleFocus}
                      placeholder={MONEY_INPUT_PLACEHOLDER}
                    />
                  </Field>
                  <Field label="Comissão mínima (%)">
                    <input
                      type="number"
                      value={afComissaoMinimaPercent}
                      min={0}
                      max={100}
                      onChange={(e) => setAfComissaoMinimaPercent(Number(e.target.value) || 0)}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                </div>
              ) : null}
              <div className="info-inline">
                <span className="pill">Custo variável total <InfoTooltip text="Soma de todos os custos diretos do projeto: kit, frete, descarregamento, hospedagem, material CA e mão de obra estimada." /> <strong>{currency(analiseFinanceiraResult.custo_variavel_total_rs)}</strong></span>
                {afValorContrato > 0 ? (
                  <>
                    <span className="pill">Margem bruta <InfoTooltip text="Diferença entre o valor do contrato e o custo variável total. Representa o valor disponível para cobrir impostos, custos fixos e gerar lucro." /> <strong>{currency(analiseFinanceiraResult.margem_rs ?? 0)}</strong></span>
                    <span className="pill">Impostos <InfoTooltip text="Valor estimado de impostos sobre o faturamento, calculado com base na alíquota configurada." /> <strong>{currency(analiseFinanceiraResult.impostos_rs ?? 0)}</strong></span>
                    <span className="pill">Lucro s/ comissão <InfoTooltip text="Lucro líquido antes de descontar a comissão do vendedor. Resultado da margem bruta menos impostos e custos fixos." /> <strong>{currency(analiseFinanceiraResult.lucro_liquido_sem_comissao_rs ?? 0)}</strong></span>
                    <span className="pill">Margem s/ comissão <InfoTooltip text="Percentual de margem líquida sobre o valor do contrato, antes de considerar a comissão do vendedor." /> <strong>{(analiseFinanceiraResult.margem_liquida_sem_comissao_percent ?? 0).toFixed(2)}%</strong></span>
                    <span className="pill">Comissão <InfoTooltip text="Comissão mínima aplicada sobre o valor do contrato somente quando a margem líquida sem comissão já atinge a margem mínima." /> <strong>{(analiseFinanceiraResult.comissao_percent ?? 0).toFixed(2)}% = {currency(analiseFinanceiraResult.comissao_rs ?? 0)}</strong></span>
                    <span className="pill">Custo total real <InfoTooltip text="Custo total efetivo do projeto incluindo custos variáveis, impostos, custos fixos rateados e comissão do vendedor." /> <strong>{currency(analiseFinanceiraResult.custo_total_real_rs ?? 0)}</strong></span>
                    <span className="pill">Lucro líquido final <InfoTooltip text="Lucro efetivo após deduzir todos os custos (variáveis, impostos, fixos e comissão) do valor do contrato." /> <strong>{currency(analiseFinanceiraResult.lucro_liquido_final_rs ?? 0)}</strong></span>
                    <span className="pill">Margem líquida final <InfoTooltip text="Percentual de lucro líquido sobre o valor do contrato, após todos os custos incluindo comissão. Indica a rentabilidade real do projeto." /> <strong>{(analiseFinanceiraResult.margem_liquida_final_percent ?? 0).toFixed(2)}%</strong></span>
                    <span className="pill">Desconto máximo <InfoTooltip text="Percentual máximo de desconto sobre o valor do contrato para manter a margem líquida mínima já considerando a comissão mínima." /> <strong>{(analiseFinanceiraResult.desconto_maximo_percent ?? 0).toFixed(2)}%</strong></span>
                  </>
                ) : null}
              </div>
              {(analiseFinanceiraResult.preco_minimo_aceitavel_rs != null || analiseFinanceiraResult.preco_minimo_saudavel_rs != null) ? (
                <div className="price-band">
                  <p className="price-band-title">Recomendações de Preço</p>
                  <div className="price-band-row">
                    {analiseFinanceiraResult.preco_minimo_aceitavel_rs != null ? (
                      <span className="pill pill--warning pill--price">
                        Preço Mín. Aceitável <InfoTooltip text={`Menor preço de venda que garante a margem líquida mínima de ${afMargemLiquidaMinima}%, sem incluir comissão do vendedor. Abaixo deste valor a venda é bloqueada.`} /> <strong>{currency(analiseFinanceiraResult.preco_minimo_aceitavel_rs)}</strong>
                      </span>
                    ) : null}
                    {analiseFinanceiraResult.preco_minimo_saudavel_rs != null ? (
                      <span className="pill pill--success pill--price">
                        Preço Mín. Saudável <InfoTooltip text={`Preço mínimo que garante a margem líquida mínima de ${afMargemLiquidaMinima}% e ainda cobre a comissão mínima do vendedor (${afComissaoMinimaPercent}%). Abaixo deste valor não há comissão.`} /> <strong>{currency(analiseFinanceiraResult.preco_minimo_saudavel_rs)}</strong>
                      </span>
                    ) : null}
                    {analiseFinanceiraResult.preco_ideal_rs != null ? (
                      <span className="pill pill--info pill--price">
                        Preço Ideal <InfoTooltip text={`Preço calculado para atingir a margem líquida alvo de ${afMargemLiquidaVenda}% após a comissão mínima do vendedor.`} /> <strong>{currency(analiseFinanceiraResult.preco_ideal_rs)}</strong>
                      </span>
                    ) : null}
                  </div>
                  {afValorContrato > 0 ? (
                    <div className="price-band-row">
                      {analiseFinanceiraResult.status_venda === 'BLOQUEAR_VENDA' ? (
                        <span className="pill pill--error">
                          🚫 VENDA NÃO APROVADA
                        </span>
                      ) : analiseFinanceiraResult.status_venda === 'SEM_COMISSAO' ? (
                        <span className="pill pill--warning">
                          ⚠️ SEM COMISSÃO
                        </span>
                      ) : analiseFinanceiraResult.status_venda === 'COMISSAO_MINIMA' ? (
                        <span className="pill pill--info">
                          💼 COMISSÃO {(analiseFinanceiraResult.comissao_percent ?? 0).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="pill pill--success">
                          ✅ VENDA SAUDÁVEL — COMISSÃO {(analiseFinanceiraResult.comissao_percent ?? 0).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Leasing results */}
          {afModo === 'leasing' && analiseFinanceiraResult.custo_total_rs != null ? (
            <>
              <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
                <h4>Composição Mensal — Leasing</h4>
                <div className="info-inline">
                  <span className="pill">Mensalidade bruta <strong>{currency(analiseFinanceiraResult.comissao_leasing_rs ?? 0)}</strong></span>
                  <span className="pill">Impostos ({afImpostosLeasing}%) <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afImpostosLeasing / 100)}/mês</strong></span>
                  <span className="pill">Inadimplência esperada ({afInadimplencia}%) <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afInadimplencia / 100)}/mês</strong></span>
                  <span className="pill">Custo operacional ({afCustoOperacional}%) <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afCustoOperacional / 100)}/mês</strong></span>
                  <span className="pill pill--info">Receita líquida mensal <strong>{currency(analiseFinanceiraResult.receita_liquida_mensal_rs ?? analiseFinanceiraResult.lucro_mensal_medio_rs ?? 0)}</strong></span>
                  <span className="pill pill--success">Lucro mensal médio <strong>{currency(analiseFinanceiraResult.lucro_mensal_medio_rs ?? 0)}</strong></span>
                </div>
              </div>

              <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
                <h4>Investimento — Leasing</h4>
                <div className="info-inline">
                  <span className="pill">CAPEX <strong>{currency(analiseFinanceiraResult.custo_variavel_total_rs ?? 0)}</strong></span>
                  <span className="pill">Comissão / CAC <strong>{currency(analiseFinanceiraResult.comissao_leasing_rs ?? 0)}</strong></span>
                  <span className="pill">Seguro obrigatório <strong>{currency(analiseFinanceiraResult.seguro_rs ?? 0)}</strong></span>
                  <span className="pill pill--info">Investimento total <InfoTooltip text="Investimento total = CAPEX + CAC + Seguro. Esta é a base de retorno do projeto no leasing." /> <strong>{currency(analiseFinanceiraResult.investimento_total_leasing_rs ?? 0)}</strong></span>
                </div>
              </div>

              <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
                <h4>Retorno e Rentabilidade — Leasing</h4>
                <div className="info-inline">
                  <span className="pill pill--success">Payback total <strong>{analiseFinanceiraResult.payback_total_meses != null ? `${analiseFinanceiraResult.payback_total_meses.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses` : '—'}</strong></span>
                  <span className="pill">Break-even (mês) <strong>{analiseFinanceiraResult.break_even_meses != null ? `${analiseFinanceiraResult.break_even_meses.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '—'}</strong></span>
                  <span className="pill">ROI <strong>{analiseFinanceiraResult.roi_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></span>
                  <span className="pill">TIR anual <strong>{analiseFinanceiraResult.tir_anual_percent != null ? `${analiseFinanceiraResult.tir_anual_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}</strong></span>
                  <span className="pill">VPL <strong>{analiseFinanceiraResult.vpl != null ? currency(analiseFinanceiraResult.vpl) : '—'}</strong></span>
                  <span className="pill">Payback descontado <strong>{analiseFinanceiraResult.payback_descontado_meses != null ? `${analiseFinanceiraResult.payback_descontado_meses} meses` : '—'}</strong></span>
                  <span className="pill">Receita total do contrato <strong>{currency(analiseFinanceiraResult.receita_total_contrato_rs ?? analiseFinanceiraResult.comissao_leasing_rs ?? 0)}</strong></span>
                  <span className="pill">Lucro total do contrato <strong>{currency(analiseFinanceiraResult.lucro_total_contrato_rs ?? analiseFinanceiraResult.lucro_rs ?? 0)}</strong></span>
                  <span className="pill">Múltiplo do capital <strong>{analiseFinanceiraResult.multiplo_capital_investido != null ? `${analiseFinanceiraResult.multiplo_capital_investido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : '—'}</strong></span>
                </div>
              </div>

              <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
                <h4>Indicador de eficiência do projeto</h4>
                <div className="info-inline">
                  <span className={`pill ${indicadorEficienciaProjeto != null && indicadorEficienciaProjeto.score >= 85 ? 'pill--success' : indicadorEficienciaProjeto != null && indicadorEficienciaProjeto.score >= 70 ? 'pill--info' : indicadorEficienciaProjeto != null && indicadorEficienciaProjeto.score >= 50 ? 'pill--warning' : 'pill--error'}`}>
                    Indicador de eficiência do projeto <strong>{indicadorEficienciaProjeto != null ? `${indicadorEficienciaProjeto.score}/100 — ${indicadorEficienciaProjeto.classificacao}` : '—'}</strong>
                  </span>
                  <span className="pill">Resumo composto da eficiência financeira do leasing com base em retorno, prazo e capital investido.</span>
                </div>
              </div>

              <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
                <h4>Risco e Sensibilidade — Leasing</h4>
                <div className="info-inline">
                  <span className="pill">Impacto da inadimplência no lucro mensal <strong>{currency((analiseFinanceiraResult.comissao_leasing_rs ?? 0) * afInadimplencia / 100)}</strong></span>
                  {[afInadimplencia, afInadimplencia + 3, afInadimplencia + 6].map((scenarioPct, index) => {
                    const pct = Math.max(0, scenarioPct)
                    const fator = 1 - (afImpostosLeasing + afCustoOperacional + pct) / 100
                    const receitaMensal = (analiseFinanceiraResult.comissao_leasing_rs ?? 0) * fator
                    const payback = receitaMensal > 0
                      ? (analiseFinanceiraResult.investimento_total_leasing_rs ?? 0) / receitaMensal
                      : null
                    const meses = Math.max(1, afMesesProjecao)
                    const lucroTotal = receitaMensal * meses - (analiseFinanceiraResult.investimento_total_leasing_rs ?? 0)
                    const roi = (analiseFinanceiraResult.investimento_total_leasing_rs ?? 0) > 0
                      ? (lucroTotal / (analiseFinanceiraResult.investimento_total_leasing_rs ?? 0)) * 100
                      : 0
                    const label = index === 0 ? 'Base' : index === 1 ? 'Moderado' : 'Estressado'
                    return (
                      <span key={label} className="pill">
                        Inadimplência {label} ({pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%):
                        {' '}Lucro/mês <strong>{currency(receitaMensal)}</strong> · Payback <strong>{payback != null ? `${payback.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}m` : '—'}</strong> · ROI <strong>{roi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong>
                      </span>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}

          {/* KPIs */}
          {afModo === 'venda' ? (
            <div className="simulacoes-module-tile" style={{ marginBottom: '1rem' }}>
              <h4>Indicadores Financeiros — Venda</h4>
              <div className="info-inline">
                <span className="pill">ROI <strong>{analiseFinanceiraResult.roi_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></span>
                <span className="pill">Payback <strong>{analiseFinanceiraResult.payback_meses != null ? `${analiseFinanceiraResult.payback_meses} meses` : '—'}</strong></span>
                <span className="pill">TIR mensal <InfoTooltip text="Taxa Interna de Retorno por período (mês). Não disponível quando o fluxo não tem mudança de sinal." /> <strong>{analiseFinanceiraResult.tir_mensal_percent != null ? `${analiseFinanceiraResult.tir_mensal_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}</strong></span>
                <span className="pill">TIR anual <strong>{analiseFinanceiraResult.tir_anual_percent != null ? `${analiseFinanceiraResult.tir_anual_percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}</strong></span>
                <span className="pill">VPL <InfoTooltip text={afTaxaDesconto > 0 ? `Valor Presente Líquido com taxa de desconto de ${afTaxaDesconto}% a.a.` : 'Informe a taxa de desconto (% a.a.) acima para calcular o VPL.'} /> <strong>{analiseFinanceiraResult.vpl != null ? currency(analiseFinanceiraResult.vpl) : '—'}</strong></span>
                {analiseFinanceiraResult.payback_descontado_meses != null ? (
                  <span className="pill">Payback descontado <strong>{analiseFinanceiraResult.payback_descontado_meses} meses</strong></span>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="simulacoes-module-tile">
          <p className="simulacoes-description">
            {afModo === 'venda'
              ? 'Preencha o Custo do Kit e o Valor do Contrato para calcular a análise financeira.'
              : 'Preencha o Custo do Kit para calcular a análise financeira de leasing.'}
          </p>
        </div>
      )}

      {/* Approval checklist */}
      <div className="simulacoes-approval-grid" style={{ marginTop: '1.5rem' }}>
        <div className="simulacoes-module-tile">
          <h4>Checklist de aprovação</h4>
          <ul className="simulacoes-checklist">
            {(afModo === 'leasing'
              ? (['roi', 'tir', 'vpl', 'payback', 'eficiencia', 'lucro'] as AprovacaoChecklistKey[])
              : (['roi', 'tir', 'spread', 'vpl'] as AprovacaoChecklistKey[])
            ).map((item) => (
              <li key={item}>
                <label className="simulacoes-check">
                  <input
                    type="checkbox"
                    checked={aprovacaoChecklist[item]}
                    onChange={() => toggleAprovacaoChecklist(item)}
                  />
                  <span>
                    {item === 'roi'
                      ? (afModo === 'leasing' ? 'ROI mínimo do leasing atendido' : 'ROI mínimo SolarInvest atendido')
                      : item === 'tir'
                        ? 'TIR anual acima do piso definido'
                        : item === 'spread'
                          ? 'Spread e margem dentro do range'
                          : item === 'vpl'
                            ? 'VPL positivo no horizonte definido'
                            : item === 'payback'
                              ? 'Payback dentro do limite aceitável'
                              : item === 'eficiencia'
                                ? 'Indicador de eficiência acima do mínimo'
                                : 'Lucro mensal positivo e saudável'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {isAnaliseMobileSimpleView ? null : (
          <div className="simulacoes-module-tile">
            <h4>Selo e decisão</h4>
            <p className={`simulacoes-status status-${aprovacaoStatus}`}>{APROVACAO_SELLOS[aprovacaoStatus]}</p>
            <p className="simulacoes-description">
              Última decisão registrada: {formatAprovacaoData(ultimaDecisaoTimestamp)}
            </p>
            <div className="simulacoes-hero-buttons">
              <button type="button" className="primary" onClick={() => registrarDecisaoInterna('aprovado')}>
                Aprovar
              </button>
              <button type="button" className="secondary" onClick={() => registrarDecisaoInterna('reprovado')}>
                Reprovar
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => registrarDecisaoInterna(aprovacaoStatus)}
              >
                Salvar decisão
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
