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
  setAfDiasOverride,
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
