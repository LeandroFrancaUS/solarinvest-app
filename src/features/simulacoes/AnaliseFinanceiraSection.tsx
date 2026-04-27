// src/features/simulacoes/AnaliseFinanceiraSection.tsx
// Extracted from App.tsx (Subfase 2B.12.4A).
// Renders the full Análise Financeira block when simulacoesSection === 'analise'.

import { useCallback, useEffect, useRef } from 'react'
import { Field } from '../../components/ui/Field'
import { MONEY_INPUT_PLACEHOLDER, useBRNumberField } from '../../lib/locale/useBRNumberField'
import type { CidadeDB } from '../../data/cidades'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'
import { useVendasConfigStore, vendasConfigSelectors } from '../../store/useVendasConfigStore'
import { selectNumberInputOnFocus } from '../../utils/focusHandlers'
import { AfBaseSistemaPanel } from './AfBaseSistemaPanel'
import { AfCustosDiretosPanel } from './AfCustosDiretosPanel'
import { AfResultadosVendaPanel } from './AfResultadosVendaPanel'
import { AfResultadosLeasingPanel } from './AfResultadosLeasingPanel'
import { AfAprovacaoGrid } from './AfAprovacaoGrid'

import { useAfDeslocamentoStore } from './useAfDeslocamentoStore'
import {
  selectAfCidadeDestino, selectSetAfCidadeDestino,
  selectAfCidadeSuggestions, selectSetAfCidadeSuggestions,
  selectAfCidadeShowSuggestions, selectSetAfCidadeShowSuggestions,
  selectAfDeslocamentoStatus, selectSetAfDeslocamentoStatus,
  selectAfDeslocamentoCidadeLabel, selectSetAfDeslocamentoCidadeLabel,
  selectAfDeslocamentoKm, selectSetAfDeslocamentoKm,
  selectAfDeslocamentoRs, selectSetAfDeslocamentoRs,
  selectAfDeslocamentoErro, selectSetAfDeslocamentoErro,
  selectSelectCidadeAndCalculateDeslocamento,
} from './afDeslocamentoSelectors'
import { useAfInputStore } from './useAfInputStore'
import { useConsumoBaseStore, selectKcKwhMes } from './useConsumoBaseStore'
import { useUfTarifaStore, selectUfTarifa } from './useUfTarifaStore'
import {
  useSimulacaoBaseStore,
  selectBaseIrradiacao,
  selectEficienciaNormalizada,
  selectDiasMesNormalizado,
  selectPotenciaModulo,
} from './useSimulacaoBaseStore'
import {
  selectAfModo, selectSetAfModo,
  selectAfConsumoOverride, selectSetAfConsumoOverride,
  selectAfNumModulosOverride, selectSetAfNumModulosOverride,
  selectAfModuloWpOverride, selectSetAfModuloWpOverride,
  selectAfIrradiacaoOverride, selectSetAfIrradiacaoOverride,
  selectAfPROverride, selectSetAfPROverride,
  selectAfDiasOverride, selectSetAfDiasOverride,
  selectSetAfUfOverride,
  selectAfCustoKit, selectSetAfCustoKit, selectSetAfCustoKitManual,
  selectAfFrete, selectSetAfFrete, selectSetAfFreteManual,
  selectAfDescarregamento, selectSetAfDescarregamento,
  selectAfHotelPousada, selectSetAfHotelPousada,
  selectAfTransporteCombustivel, selectSetAfTransporteCombustivel,
  selectAfOutros, selectSetAfOutros,
  selectAfPlaca, selectSetAfPlaca,
  selectAfAutoMaterialCA, selectSetAfAutoMaterialCA,
  selectAfMaterialCAOverride, selectSetAfMaterialCAOverride,
  selectAfProjetoOverride, selectSetAfProjetoOverride,
  selectAfCreaOverride, selectSetAfCreaOverride,
  selectAfValorContrato, selectSetAfValorContrato,
  selectAfMensalidadeBase, selectSetAfMensalidadeBase,
  selectAfImpostosVenda, selectSetAfImpostosVenda,
  selectAfImpostosLeasing, selectSetAfImpostosLeasing,
  selectAfMargemLiquidaVenda, selectSetAfMargemLiquidaVenda,
  selectAfMargemLiquidaMinima, selectSetAfMargemLiquidaMinima,
  selectAfComissaoMinimaPercent, selectSetAfComissaoMinimaPercent,
  selectAfTaxaDesconto, selectSetAfTaxaDesconto,
  selectAfInadimplencia, selectSetAfInadimplencia,
  selectAfCustoOperacional, selectSetAfCustoOperacional,
  selectAfMesesProjecao, selectSetAfMesesProjecao,
} from './afInputSelectors'

export interface AnaliseFinanceiraSectionProps {
  afMensalidadeBaseAuto: number

  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  indicadorEficienciaProjeto: { score: number; classificacao: string } | null

  isAnaliseMobileSimpleView: boolean
}

export function AnaliseFinanceiraSection({
  afMensalidadeBaseAuto,
  analiseFinanceiraResult,
  indicadorEficienciaProjeto,
  isAnaliseMobileSimpleView,
}: AnaliseFinanceiraSectionProps) {
  const afCidadeBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const afBaseInitializedRef = useRef(false)
  // Store reads — replaces props previously passed down from App.tsx
  const kcKwhMes = useConsumoBaseStore(selectKcKwhMes)
  const baseIrradiacao = useSimulacaoBaseStore(selectBaseIrradiacao)
  const eficienciaNormalizada = useSimulacaoBaseStore(selectEficienciaNormalizada)
  const diasMesNormalizado = useSimulacaoBaseStore(selectDiasMesNormalizado)
  const potenciaModulo = useSimulacaoBaseStore(selectPotenciaModulo)
  const ufTarifa = useUfTarifaStore(selectUfTarifa)
  const vendasConfig = useVendasConfigStore(vendasConfigSelectors.config)
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
  const afMensalidadeBase = useAfInputStore(selectAfMensalidadeBase)
  const setAfMensalidadeBase = useAfInputStore(selectSetAfMensalidadeBase)
  const afValorContratoField = useBRNumberField({ mode: 'money', value: afValorContrato, onChange: (v) => setAfValorContrato(v ?? 0) })
  const afMensalidadeBaseField = useBRNumberField({ mode: 'money', value: afMensalidadeBase > 0 ? afMensalidadeBase : null, onChange: (v) => setAfMensalidadeBase(v ?? 0) })
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
  // Value reads for the 10 cost fields created locally
  const afCustoKit = useAfInputStore(selectAfCustoKit)
  const afFrete = useAfInputStore(selectAfFrete)
  const afDescarregamento = useAfInputStore(selectAfDescarregamento)
  const afHotelPousada = useAfInputStore(selectAfHotelPousada)
  const afTransporteCombustivel = useAfInputStore(selectAfTransporteCombustivel)
  const afOutros = useAfInputStore(selectAfOutros)
  const afPlaca = useAfInputStore(selectAfPlaca)
  const setAfPlaca = useAfInputStore(selectSetAfPlaca)
  const afAutoMaterialCA = useAfInputStore(selectAfAutoMaterialCA)
  const afMaterialCAOverride = useAfInputStore(selectAfMaterialCAOverride)
  const afProjetoOverride = useAfInputStore(selectAfProjetoOverride)
  const afCreaOverride = useAfInputStore(selectAfCreaOverride)
  // Deslocamento state — read directly from store
  const afCidadeDestino = useAfDeslocamentoStore(selectAfCidadeDestino)
  const setAfCidadeDestino = useAfDeslocamentoStore(selectSetAfCidadeDestino)
  const afCidadeSuggestions = useAfDeslocamentoStore(selectAfCidadeSuggestions)
  const setAfCidadeSuggestions = useAfDeslocamentoStore(selectSetAfCidadeSuggestions)
  const afCidadeShowSuggestions = useAfDeslocamentoStore(selectAfCidadeShowSuggestions)
  const setAfCidadeShowSuggestions = useAfDeslocamentoStore(selectSetAfCidadeShowSuggestions)
  const afDeslocamentoStatus = useAfDeslocamentoStore(selectAfDeslocamentoStatus)
  const setAfDeslocamentoStatus = useAfDeslocamentoStore(selectSetAfDeslocamentoStatus)
  const afDeslocamentoCidadeLabel = useAfDeslocamentoStore(selectAfDeslocamentoCidadeLabel)
  const setAfDeslocamentoCidadeLabel = useAfDeslocamentoStore(selectSetAfDeslocamentoCidadeLabel)
  const afDeslocamentoKm = useAfDeslocamentoStore(selectAfDeslocamentoKm)
  const setAfDeslocamentoKm = useAfDeslocamentoStore(selectSetAfDeslocamentoKm)
  const afDeslocamentoRs = useAfDeslocamentoStore(selectAfDeslocamentoRs)
  const setAfDeslocamentoRs = useAfDeslocamentoStore(selectSetAfDeslocamentoRs)
  const afDeslocamentoErro = useAfDeslocamentoStore(selectAfDeslocamentoErro)
  const setAfDeslocamentoErro = useAfDeslocamentoStore(selectSetAfDeslocamentoErro)
  const selectCidadeAndCalculateDeslocamento = useAfDeslocamentoStore(selectSelectCidadeAndCalculateDeslocamento)
  const setAfUfOverride = useAfInputStore(selectSetAfUfOverride)
  // BR money fields for the 10 cost inputs — created here, passed to AfCustosDiretosPanel
  const afCustoKitField = useBRNumberField({ mode: 'money', value: afCustoKit, onChange: (v) => { setAfCustoKit(v ?? 0); setAfCustoKitManual(true) } })
  const afFreteField = useBRNumberField({ mode: 'money', value: afFrete, onChange: (v) => { setAfFrete(v ?? 0); setAfFreteManual(true) } })
  const afDescarregamentoField = useBRNumberField({ mode: 'money', value: afDescarregamento, onChange: (v) => setAfDescarregamento(v ?? 0) })
  const afPlacaField = useBRNumberField({ mode: 'money', value: afPlaca, onChange: (v) => setAfPlaca(v ?? 18) })
  const afHotelPousadaField = useBRNumberField({ mode: 'money', value: afHotelPousada, onChange: (v) => setAfHotelPousada(v ?? 0) })
  const afTransporteCombustivelField = useBRNumberField({ mode: 'money', value: afTransporteCombustivel, onChange: (v) => setAfTransporteCombustivel(v ?? 0) })
  const afOutrosField = useBRNumberField({ mode: 'money', value: afOutros, onChange: (v) => setAfOutros(v ?? 0) })
  const afMaterialCAField = useBRNumberField({ mode: 'money', value: afMaterialCAOverride ?? afAutoMaterialCA, onChange: (v) => setAfMaterialCAOverride(v != null && v >= 0 ? v : null) })
  const afProjetoField = useBRNumberField({ mode: 'money', value: afProjetoOverride, onChange: (v) => setAfProjetoOverride(v != null && v >= 0 ? v : null) })
  const afCreaField = useBRNumberField({ mode: 'money', value: afCreaOverride, onChange: (v) => setAfCreaOverride(v != null && v >= 0 ? v : null) })
  // Initialize AF base system overrides from proposal values on first mount.
  // Component is only rendered when simulacoesSection === 'analise', so mount = first visit.
  // Intentional stale closure: we seed from initial prop values once and never re-run,
  // so that manual overrides the user sets are not reset if proposal values later change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!afBaseInitializedRef.current) {
      afBaseInitializedRef.current = true
      setAfIrradiacaoOverride(baseIrradiacao > 0 ? baseIrradiacao : 5.0)
      setAfPROverride(eficienciaNormalizada > 0 ? eficienciaNormalizada : 0.8)
      setAfDiasOverride(diasMesNormalizado > 0 ? diasMesNormalizado : 30)
      setAfModuloWpOverride(potenciaModulo > 0 ? potenciaModulo : 550)
      setAfUfOverride(ufTarifa === 'DF' ? 'DF' : 'GO')
    }
  }, [])
  const handleSelectCidade = useCallback((city: CidadeDB) => {
    const travelConfig = {
      faixa1Km: vendasConfig.af_deslocamento_faixa1_km,
      faixa1Valor: vendasConfig.af_deslocamento_faixa1_rs,
      faixa2Km: vendasConfig.af_deslocamento_faixa2_km,
      faixa2Valor: vendasConfig.af_deslocamento_faixa2_rs,
      kmExcedenteValor: vendasConfig.af_deslocamento_km_excedente_rs,
    }
    const regioesIsentas = vendasConfig.af_deslocamento_regioes_isentas.map(
      (r) => `${r.cidade} - ${r.uf}`,
    )
    const { ufOverride, deslocamentoRs } = selectCidadeAndCalculateDeslocamento(city, { travelConfig, regioesIsentas })
    setAfUfOverride(ufOverride)
    setAfTransporteCombustivel(deslocamentoRs)
  }, [vendasConfig.af_deslocamento_regioes_isentas, vendasConfig.af_deslocamento_faixa1_km, vendasConfig.af_deslocamento_faixa1_rs, vendasConfig.af_deslocamento_faixa2_km, vendasConfig.af_deslocamento_faixa2_rs, vendasConfig.af_deslocamento_km_excedente_rs, selectCidadeAndCalculateDeslocamento, setAfUfOverride, setAfTransporteCombustivel])
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
        isAnaliseMobileSimpleView={isAnaliseMobileSimpleView}
      />
    </section>
  )
}
