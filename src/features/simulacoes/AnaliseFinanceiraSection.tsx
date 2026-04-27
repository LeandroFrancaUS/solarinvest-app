// src/features/simulacoes/AnaliseFinanceiraSection.tsx
// Extracted from App.tsx (Subfase 2B.12.4A).
// Renders the full Análise Financeira block when simulacoesSection === 'analise'.

import type React from 'react'
import { Field } from '../../components/ui/Field'
import { MONEY_INPUT_PLACEHOLDER } from '../../lib/locale/useBRNumberField'
import type { CidadeDB } from '../../data/cidades'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'
import type { VendasConfig } from '../../types/vendasConfig'
import { AfBaseSistemaPanel } from './AfBaseSistemaPanel'
import { AfCustosDiretosPanel } from './AfCustosDiretosPanel'
import { AfResultadosVendaPanel } from './AfResultadosVendaPanel'
import { AfResultadosLeasingPanel } from './AfResultadosLeasingPanel'
import { AfAprovacaoGrid } from './AfAprovacaoGrid'
import type { MoneyFieldHandle } from './simulacoesTypes'
import type { AprovacaoChecklistKey, AprovacaoStatus } from './simulacoesConstants'
import { useAfInputStore } from './useAfInputStore'
import {
  selectAfModo, selectSetAfModo,
  selectAfConsumoOverride, selectSetAfConsumoOverride,
  selectAfNumModulosOverride, selectSetAfNumModulosOverride,
  selectAfModuloWpOverride, selectSetAfModuloWpOverride,
  selectAfIrradiacaoOverride, selectSetAfIrradiacaoOverride,
  selectAfPROverride, selectSetAfPROverride,
  selectAfDiasOverride, selectSetAfDiasOverride,
  selectSetAfCustoKit, selectSetAfCustoKitManual,
  selectSetAfFrete, selectSetAfFreteManual,
  selectSetAfDescarregamento,
  selectSetAfHotelPousada,
  selectSetAfTransporteCombustivel,
  selectSetAfOutros,
  selectAfValorContrato, selectSetAfValorContrato,
  selectSetAfMensalidadeBase,
  selectAfImpostosVenda, selectSetAfImpostosVenda,
  selectAfImpostosLeasing, selectSetAfImpostosLeasing,
  selectAfMargemLiquidaVenda, selectSetAfMargemLiquidaVenda,
  selectAfMargemLiquidaMinima, selectSetAfMargemLiquidaMinima,
  selectAfComissaoMinimaPercent, selectSetAfComissaoMinimaPercent,
  selectAfTaxaDesconto, selectSetAfTaxaDesconto,
  selectAfInadimplencia, selectSetAfInadimplencia,
  selectAfCustoOperacional, selectSetAfCustoOperacional,
  selectAfMesesProjecao, selectSetAfMesesProjecao,
  selectSetAfAutoMaterialCA,
  selectSetAfMaterialCAOverride,
  selectSetAfProjetoOverride,
  selectSetAfCreaOverride,
} from './afInputSelectors'

export interface AnaliseFinanceiraSectionProps {
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

  afMensalidadeBaseAuto: number

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

  kcKwhMes: number
  isAnaliseMobileSimpleView: boolean
}

export function AnaliseFinanceiraSection({
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
  afMensalidadeBaseAuto,
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
  // Store reads — replaces props previously passed down from App.tsx
  const afModo = useAfInputStore(selectAfModo)
  const setAfModo = useAfInputStore(selectSetAfModo)
  const afConsumoOverride = useAfInputStore(selectAfConsumoOverride)
  const setAfConsumoOverride = useAfInputStore(selectSetAfConsumoOverride)
  const afNumModulosOverride = useAfInputStore(selectAfNumModulosOverride)
  const setAfNumModulosOverride = useAfInputStore(selectSetAfNumModulosOverride)
  const afModuloWpOverride = useAfInputStore(selectAfModuloWpOverride)
  const setAfModuloWpOverride = useAfInputStore(selectSetAfModuloWpOverride)
  const afIrradiacaoOverride = useAfInputStore(selectAfIrradiacaoOverride)
  const setAfIrradiacaoOverride = useAfInputStore(selectSetAfIrradiacaoOverride)
  const afPROverride = useAfInputStore(selectAfPROverride)
  const setAfPROverride = useAfInputStore(selectSetAfPROverride)
  const afDiasOverride = useAfInputStore(selectAfDiasOverride)
  const setAfDiasOverride = useAfInputStore(selectSetAfDiasOverride)
  const setAfCustoKit = useAfInputStore(selectSetAfCustoKit)
  const setAfCustoKitManual = useAfInputStore(selectSetAfCustoKitManual)
  const setAfFrete = useAfInputStore(selectSetAfFrete)
  const setAfFreteManual = useAfInputStore(selectSetAfFreteManual)
  const setAfDescarregamento = useAfInputStore(selectSetAfDescarregamento)
  const setAfHotelPousada = useAfInputStore(selectSetAfHotelPousada)
  const setAfTransporteCombustivel = useAfInputStore(selectSetAfTransporteCombustivel)
  const setAfOutros = useAfInputStore(selectSetAfOutros)
  const afValorContrato = useAfInputStore(selectAfValorContrato)
  const setAfValorContrato = useAfInputStore(selectSetAfValorContrato)
  const setAfMensalidadeBase = useAfInputStore(selectSetAfMensalidadeBase)
  const afImpostosVenda = useAfInputStore(selectAfImpostosVenda)
  const setAfImpostosVenda = useAfInputStore(selectSetAfImpostosVenda)
  const afImpostosLeasing = useAfInputStore(selectAfImpostosLeasing)
  const setAfImpostosLeasing = useAfInputStore(selectSetAfImpostosLeasing)
  const afMargemLiquidaVenda = useAfInputStore(selectAfMargemLiquidaVenda)
  const setAfMargemLiquidaVenda = useAfInputStore(selectSetAfMargemLiquidaVenda)
  const afMargemLiquidaMinima = useAfInputStore(selectAfMargemLiquidaMinima)
  const setAfMargemLiquidaMinima = useAfInputStore(selectSetAfMargemLiquidaMinima)
  const afComissaoMinimaPercent = useAfInputStore(selectAfComissaoMinimaPercent)
  const setAfComissaoMinimaPercent = useAfInputStore(selectSetAfComissaoMinimaPercent)
  const afTaxaDesconto = useAfInputStore(selectAfTaxaDesconto)
  const setAfTaxaDesconto = useAfInputStore(selectSetAfTaxaDesconto)
  const afInadimplencia = useAfInputStore(selectAfInadimplencia)
  const setAfInadimplencia = useAfInputStore(selectSetAfInadimplencia)
  const afCustoOperacional = useAfInputStore(selectAfCustoOperacional)
  const setAfCustoOperacional = useAfInputStore(selectSetAfCustoOperacional)
  const afMesesProjecao = useAfInputStore(selectAfMesesProjecao)
  const setAfMesesProjecao = useAfInputStore(selectSetAfMesesProjecao)
  const setAfAutoMaterialCA = useAfInputStore(selectSetAfAutoMaterialCA)
  const setAfMaterialCAOverride = useAfInputStore(selectSetAfMaterialCAOverride)
  const setAfProjetoOverride = useAfInputStore(selectSetAfProjetoOverride)
  const setAfCreaOverride = useAfInputStore(selectSetAfCreaOverride)
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
      <AfBaseSistemaPanel
        afConsumoOverride={afConsumoOverride}
        setAfConsumoOverride={setAfConsumoOverride}
        afNumModulosOverride={afNumModulosOverride}
        setAfNumModulosOverride={setAfNumModulosOverride}
        afModuloWpOverride={afModuloWpOverride}
        setAfModuloWpOverride={setAfModuloWpOverride}
        afIrradiacaoOverride={afIrradiacaoOverride}
        setAfIrradiacaoOverride={setAfIrradiacaoOverride}
        afPROverride={afPROverride}
        setAfPROverride={setAfPROverride}
        afDiasOverride={afDiasOverride}
        setAfDiasOverride={setAfDiasOverride}
        potenciaModulo={potenciaModulo}
        baseIrradiacao={baseIrradiacao}
        eficienciaNormalizada={eficienciaNormalizada}
        diasMesNormalizado={diasMesNormalizado}
        selectNumberInputOnFocus={selectNumberInputOnFocus}
      />

      {/* Editable inputs */}
      <AfCustosDiretosPanel
        afModo={afModo}
        afCustoKitField={afCustoKitField}
        afFreteField={afFreteField}
        afDescarregamentoField={afDescarregamentoField}
        afMaterialCAField={afMaterialCAField}
        afPlacaField={afPlacaField}
        afProjetoField={afProjetoField}
        afCreaField={afCreaField}
        afHotelPousadaField={afHotelPousadaField}
        afTransporteCombustivelField={afTransporteCombustivelField}
        afOutrosField={afOutrosField}
        afMensalidadeBaseField={afMensalidadeBaseField}
        afImpostosVenda={afImpostosVenda}
        setAfImpostosVenda={setAfImpostosVenda}
        afImpostosLeasing={afImpostosLeasing}
        setAfImpostosLeasing={setAfImpostosLeasing}
        afMargemLiquidaVenda={afMargemLiquidaVenda}
        setAfMargemLiquidaVenda={setAfMargemLiquidaVenda}
        afMargemLiquidaMinima={afMargemLiquidaMinima}
        setAfMargemLiquidaMinima={setAfMargemLiquidaMinima}
        afTaxaDesconto={afTaxaDesconto}
        setAfTaxaDesconto={setAfTaxaDesconto}
        afInadimplencia={afInadimplencia}
        setAfInadimplencia={setAfInadimplencia}
        afCustoOperacional={afCustoOperacional}
        setAfCustoOperacional={setAfCustoOperacional}
        afMesesProjecao={afMesesProjecao}
        setAfMesesProjecao={setAfMesesProjecao}
        afMensalidadeBaseAuto={afMensalidadeBaseAuto}
        afCidadeDestino={afCidadeDestino}
        setAfCidadeDestino={setAfCidadeDestino}
        afCidadeSuggestions={afCidadeSuggestions}
        afCidadeShowSuggestions={afCidadeShowSuggestions}
        setAfCidadeShowSuggestions={setAfCidadeShowSuggestions}
        afDeslocamentoStatus={afDeslocamentoStatus}
        setAfDeslocamentoStatus={setAfDeslocamentoStatus}
        afDeslocamentoCidadeLabel={afDeslocamentoCidadeLabel}
        setAfDeslocamentoCidadeLabel={setAfDeslocamentoCidadeLabel}
        afDeslocamentoKm={afDeslocamentoKm}
        setAfDeslocamentoKm={setAfDeslocamentoKm}
        afDeslocamentoRs={afDeslocamentoRs}
        setAfDeslocamentoRs={setAfDeslocamentoRs}
        afDeslocamentoErro={afDeslocamentoErro}
        setAfDeslocamentoErro={setAfDeslocamentoErro}
        setAfTransporteCombustivel={setAfTransporteCombustivel}
        afCidadeBlurTimerRef={afCidadeBlurTimerRef}
        handleSelectCidade={handleSelectCidade}
        analiseFinanceiraResult={analiseFinanceiraResult}
        vendasConfig={vendasConfig}
        selectNumberInputOnFocus={selectNumberInputOnFocus}
      />

      {/* Results */}
      {analiseFinanceiraResult ? (
        <>
          <AfResultadosVendaPanel
            afModo={afModo}
            afValorContratoField={afValorContratoField}
            afComissaoMinimaPercent={afComissaoMinimaPercent}
            setAfComissaoMinimaPercent={setAfComissaoMinimaPercent}
            afValorContrato={afValorContrato}
            afMargemLiquidaMinima={afMargemLiquidaMinima}
            afMargemLiquidaVenda={afMargemLiquidaVenda}
            afTaxaDesconto={afTaxaDesconto}
            analiseFinanceiraResult={analiseFinanceiraResult}
            selectNumberInputOnFocus={selectNumberInputOnFocus}
          />
          {/* Leasing results */}
          <AfResultadosLeasingPanel
            afModo={afModo}
            afImpostosLeasing={afImpostosLeasing}
            afInadimplencia={afInadimplencia}
            afCustoOperacional={afCustoOperacional}
            afMesesProjecao={afMesesProjecao}
            analiseFinanceiraResult={analiseFinanceiraResult}
            indicadorEficienciaProjeto={indicadorEficienciaProjeto}
          />

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
      <AfAprovacaoGrid
        afModo={afModo}
        aprovacaoChecklist={aprovacaoChecklist}
        toggleAprovacaoChecklist={toggleAprovacaoChecklist}
        aprovacaoStatus={aprovacaoStatus}
        ultimaDecisaoTimestamp={ultimaDecisaoTimestamp}
        registrarDecisaoInterna={registrarDecisaoInterna}
        isAnaliseMobileSimpleView={isAnaliseMobileSimpleView}
      />
    </section>
  )
}
