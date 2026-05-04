/**
 * useAnaliseFinanceiraState.ts
 *
 * Dedicated hook that owns all Financial Analysis (Spreadsheet v1) state,
 * derived fields, side-effects, and callbacks previously inline in App.tsx.
 *
 * Inputs (passed as a params object):
 *   - kcKwhMes             — current proposal monthly consumption
 *   - simulacoesSection    — active section (used to gate first-visit init)
 *   - vendasConfig         — global vendas config (travel-cost thresholds, etc.)
 *   - baseIrradiacao       — irradiation derived from proposal location
 *   - eficienciaNormalizada— performance ratio from proposal
 *   - diasMesNormalizado   — dias/mês from proposal
 *   - potenciaModulo       — module wattage from proposal
 *   - ufTarifa             — UF from the tariff selector (for UF override init)
 *   - tarifaCheia / descontoConsiderado / inflacaoAa / taxaMinima / taxaMinimaInputEmpty
 *   - tipoRede / tusdPercent / tusdTipoCliente / tusdSubtipo / tusdSimultaneidade
 *   - tusdTarifaRkwh / tusdAnoReferencia / mesReajuste / mesReferencia
 *   - vendaFormAplicaTaxaMinima / encargosFixos / cidKwhBase
 *
 * Returns every state variable, setter, derived memo, and callback that
 * App.tsx previously declared inline, so the call site becomes a single
 * destructuring assignment.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  selectMensalidades,
  selectMensalidadesPorAno,
  type SimulationState,
} from '../../selectors'
import { calcularTaxaMinima } from '../../utils/calcs'
import { DEFAULT_TUSD_ANO_REFERENCIA } from '../../lib/finance/tusd'
import type { TipoClienteTUSD } from '../../lib/finance/tusd'
import {
  calcularAnaliseFinanceira,
  resolveCustoProjetoPorFaixa,
  resolveCrea,
  PRECO_PLACA_RS,
} from '../../lib/finance/analiseFinanceiraSpreadsheet'
import type { AnaliseFinanceiraInput } from '../../types/analiseFinanceira'
import { isExemptRegion, calculateInstallerTravelCost } from '../../lib/finance/travelCost'
import { calcRoundTripKm } from '../../shared/geocoding'
import { searchCidades, type CidadeDB, MIN_CITY_SEARCH_LENGTH } from '../../data/cidades'
import { useBRNumberField } from '../../lib/locale/useBRNumberField'
import { calcPotenciaSistemaKwp } from '../../lib/pricing/pricingPorKwp'
import type { TipoRede } from '../../app/config'
import type { VendasConfig } from '../../types/vendasConfig'
import type { SimulacoesSection } from '../../types/navigation'
import {
  type AprovacaoStatus,
  type AprovacaoChecklistKey,
} from './simulacoesConstants'

// ---------------------------------------------------------------------------
// Parameter type — all values that come from outside the hook
// ---------------------------------------------------------------------------
export interface UseAnaliseFinanceiraStateParams {
  kcKwhMes: number
  simulacoesSection: SimulacoesSection
  vendasConfig: VendasConfig
  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number
  potenciaModulo: number
  ufTarifa: string
  tarifaCheia: number
  descontoConsiderado: number
  inflacaoAa: number
  taxaMinima: number
  taxaMinimaInputEmpty: boolean
  tipoRede: TipoRede
  tusdPercent: number
  tusdTipoCliente: TipoClienteTUSD
  tusdSubtipo: string
  tusdSimultaneidade: number | null
  tusdTarifaRkwh: number | null
  tusdAnoReferencia: number
  mesReajuste: number
  mesReferencia: number
  vendaFormAplicaTaxaMinima: boolean | null | undefined
  encargosFixos: number
  cidKwhBase: number
}

export function useAnaliseFinanceiraState(params: UseAnaliseFinanceiraStateParams) {
  const {
    kcKwhMes,
    simulacoesSection,
    vendasConfig,
    baseIrradiacao,
    eficienciaNormalizada,
    diasMesNormalizado,
    potenciaModulo,
    ufTarifa,
    tarifaCheia,
    descontoConsiderado,
    inflacaoAa,
    taxaMinima,
    taxaMinimaInputEmpty,
    tipoRede,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    mesReajuste,
    mesReferencia,
    vendaFormAplicaTaxaMinima,
    encargosFixos,
    cidKwhBase,
  } = params

  // -------------------------------------------------------------------------
  // Aprovação state
  // -------------------------------------------------------------------------
  const [aprovacaoStatus, setAprovacaoStatus] = useState<AprovacaoStatus>('pendente')
  const [aprovacaoChecklist, setAprovacaoChecklist] = useState<
    Record<AprovacaoChecklistKey, boolean>
  >({
    roi: true,
    tir: true,
    spread: false,
    vpl: false,
    payback: true,
    eficiencia: true,
    lucro: true,
  })
  const [ultimaDecisaoTimestamp, setUltimaDecisaoTimestamp] = useState<number | null>(null)

  // -------------------------------------------------------------------------
  // Financial Analysis (Spreadsheet v1) state
  // -------------------------------------------------------------------------
  const [afModo, setAfModo] = useState<'venda' | 'leasing'>('venda')
  const [afCustoKit, setAfCustoKit] = useState(0)
  const [afCustoKitManual, setAfCustoKitManual] = useState(false)
  const [afFrete, setAfFrete] = useState(0)
  const [afFreteManual, setAfFreteManual] = useState(false)
  const [afDescarregamento, setAfDescarregamento] = useState(0)
  const [afHotelPousada, setAfHotelPousada] = useState(0)
  const [afTransporteCombustivel, setAfTransporteCombustivel] = useState(0)
  const [afOutros, setAfOutros] = useState(0)
  // Travel cost auto-calculation state
  const [afCidadeDestino, setAfCidadeDestino] = useState('')
  const [afDeslocamentoKm, setAfDeslocamentoKm] = useState(0)
  const [afDeslocamentoRs, setAfDeslocamentoRs] = useState(0)
  const [afDeslocamentoStatus, setAfDeslocamentoStatus] = useState<
    'idle' | 'loading' | 'isenta' | 'ok' | 'error'
  >('idle')
  const [afDeslocamentoCidadeLabel, setAfDeslocamentoCidadeLabel] = useState('')
  const [afDeslocamentoErro, setAfDeslocamentoErro] = useState('')
  const [afValorContrato, setAfValorContrato] = useState(0)
  const [afImpostosVenda, setAfImpostosVenda] = useState(6)
  const [afImpostosLeasing, setAfImpostosLeasing] = useState(4)
  const [afInadimplencia, setAfInadimplencia] = useState(2)
  const [afCustoOperacional, setAfCustoOperacional] = useState(3)
  const [afMesesProjecao, setAfMesesProjecao] = useState(60)
  const [afMensalidadeBase, setAfMensalidadeBase] = useState(0)
  const [afMensalidadeBaseAuto, setAfMensalidadeBaseAuto] = useState(0)
  const [afMargemLiquidaVenda, setAfMargemLiquidaVenda] = useState(25)
  const [afMargemLiquidaMinima, setAfMargemLiquidaMinima] = useState(15)
  const [afComissaoMinimaPercent, setAfComissaoMinimaPercent] = useState(5)
  const [afTaxaDesconto, setAfTaxaDesconto] = useState(20)
  // Editable base system overrides (0 / '' = unset → memo falls back to proposal value)
  const [afConsumoOverride, setAfConsumoOverride] = useState(0)
  const [afIrradiacaoOverride, setAfIrradiacaoOverride] = useState(0)
  const [afPROverride, setAfPROverride] = useState(0)
  const [afDiasOverride, setAfDiasOverride] = useState(0)
  const [afModuloWpOverride, setAfModuloWpOverride] = useState(0)
  const [afUfOverride, setAfUfOverride] = useState<'' | 'GO' | 'DF'>('')
  // N modules / kWp mutual-calc (null = use engine value)
  const [afNumModulosOverride, setAfNumModulosOverride] = useState<number | null>(null)
  const [afPlaca, setAfPlaca] = useState(18)
  // Auto-computed Material CA: max(1000, round(850 + 0.40 × consumo)).
  // Declared before afMaterialCAField (which reads it) to avoid TDZ in production builds.
  const [afAutoMaterialCA, setAfAutoMaterialCA] = useState(0)
  const [afMaterialCAOverride, setAfMaterialCAOverride] = useState<number | null>(null)
  const [afProjetoOverride, setAfProjetoOverride] = useState<number | null>(null)
  const [afCreaOverride, setAfCreaOverride] = useState<number | null>(null)
  const [afCidadeSuggestions, setAfCidadeSuggestions] = useState<CidadeDB[]>([])
  const [afCidadeShowSuggestions, setAfCidadeShowSuggestions] = useState(false)

  const afBaseInitializedRef = useRef(false)
  const afCidadeBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // -------------------------------------------------------------------------
  // BR money fields for financial analysis currency inputs
  // -------------------------------------------------------------------------
  const afCustoKitField = useBRNumberField({
    mode: 'money',
    value: afCustoKit,
    onChange: (v) => {
      setAfCustoKit(v ?? 0)
      setAfCustoKitManual(true)
    },
  })
  const afValorContratoField = useBRNumberField({
    mode: 'money',
    value: afValorContrato,
    onChange: (v) => setAfValorContrato(v ?? 0),
  })
  const afFreteField = useBRNumberField({
    mode: 'money',
    value: afFrete,
    onChange: (v) => {
      setAfFrete(v ?? 0)
      setAfFreteManual(true)
    },
  })
  const afDescarregamentoField = useBRNumberField({
    mode: 'money',
    value: afDescarregamento,
    onChange: (v) => setAfDescarregamento(v ?? 0),
  })
  const afPlacaField = useBRNumberField({
    mode: 'money',
    value: afPlaca,
    onChange: (v) => setAfPlaca(v ?? 18),
  })
  const afHotelPousadaField = useBRNumberField({
    mode: 'money',
    value: afHotelPousada,
    onChange: (v) => setAfHotelPousada(v ?? 0),
  })
  const afTransporteCombustivelField = useBRNumberField({
    mode: 'money',
    value: afTransporteCombustivel,
    onChange: (v) => setAfTransporteCombustivel(v ?? 0),
  })
  const afOutrosField = useBRNumberField({
    mode: 'money',
    value: afOutros,
    onChange: (v) => setAfOutros(v ?? 0),
  })
  const afMensalidadeBaseField = useBRNumberField({
    mode: 'money',
    value: afMensalidadeBase > 0 ? afMensalidadeBase : null,
    onChange: (v) => setAfMensalidadeBase(v ?? 0),
  })
  const afMaterialCAField = useBRNumberField({
    mode: 'money',
    value: afMaterialCAOverride ?? afAutoMaterialCA,
    onChange: (v) => setAfMaterialCAOverride(v != null && v >= 0 ? v : null),
  })
  const afProjetoField = useBRNumberField({
    mode: 'money',
    value: afProjetoOverride,
    onChange: (v) => setAfProjetoOverride(v != null && v >= 0 ? v : null),
  })
  const afCreaField = useBRNumberField({
    mode: 'money',
    value: afCreaOverride,
    onChange: (v) => setAfCreaOverride(v != null && v >= 0 ? v : null),
  })

  // -------------------------------------------------------------------------
  // Initialize AF base system overrides from proposal values on first visit
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (simulacoesSection === 'analise' && !afBaseInitializedRef.current) {
      afBaseInitializedRef.current = true
      setAfIrradiacaoOverride(baseIrradiacao > 0 ? baseIrradiacao : 5.0)
      setAfPROverride(eficienciaNormalizada > 0 ? eficienciaNormalizada : 0.8)
      setAfDiasOverride(diasMesNormalizado > 0 ? diasMesNormalizado : 30)
      setAfModuloWpOverride(potenciaModulo > 0 ? potenciaModulo : 550)
      setAfUfOverride(ufTarifa === 'DF' ? 'DF' : 'GO')
    }
  }, [simulacoesSection])

  // -------------------------------------------------------------------------
  // Reactively auto-populate Kit, Frete and Material CA when consumo changes
  // Kit  : R$ = round(1500 + 9.5  × kWh/mês)
  // Frete: R$ = round(300  + 0.52 × kWh/mês)
  // Mat.CA: R$ = max(1000, round(850 + 0.40 × kWh/mês))
  //
  // NOTE: runs unconditionally (not gated on simulacoesSection === 'analise') so that
  // custoFinalProjetadoCanonico is always populated when a client/proposal is loaded,
  // even before the user visits the "Análise Financeira" section.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const consumo = afConsumoOverride > 0 ? afConsumoOverride : kcKwhMes
    if (consumo <= 0) return
    if (!afCustoKitManual) {
      setAfCustoKit(Math.round(1500 + 9.5 * consumo))
    }
    if (!afFreteManual) {
      setAfFrete(Math.round(300 + 0.52 * consumo))
    }
    if (afMaterialCAOverride == null) {
      setAfAutoMaterialCA(Math.max(1000, Math.round(850 + 0.4 * consumo)))
    }
  }, [kcKwhMes, afConsumoOverride, afCustoKitManual, afFreteManual, afMaterialCAOverride])

  // -------------------------------------------------------------------------
  // City autocomplete: update suggestions as user types
  // -------------------------------------------------------------------------
  useEffect(() => {
    const trimmed = afCidadeDestino.trim()
    if (trimmed.length < MIN_CITY_SEARCH_LENGTH) {
      setAfCidadeSuggestions([])
      return
    }
    setAfCidadeSuggestions(searchCidades(trimmed))
  }, [afCidadeDestino])

  // -------------------------------------------------------------------------
  // handleSelectCidade — applies travel cost when a city is picked
  // -------------------------------------------------------------------------
  const handleSelectCidade = useCallback(
    (city: CidadeDB) => {
      setAfCidadeDestino(`${city.cidade} - ${city.uf}`)
      setAfCidadeSuggestions([])
      setAfCidadeShowSuggestions(false)
      // Map to supported calculation UF: DF or GO (default for all other states)
      setAfUfOverride(city.uf === 'DF' ? 'DF' : 'GO')
      const travelConfig = {
        exemptRegions: vendasConfig.af_deslocamento_regioes_isentas,
        faixa1MaxKm: vendasConfig.af_deslocamento_faixa1_km,
        faixa1Rs: vendasConfig.af_deslocamento_faixa1_rs,
        faixa2MaxKm: vendasConfig.af_deslocamento_faixa2_km,
        faixa2Rs: vendasConfig.af_deslocamento_faixa2_rs,
        kmExcedenteRs: vendasConfig.af_deslocamento_km_excedente_rs,
      }
      const label = `${city.cidade}/${city.uf}`
      if (isExemptRegion(city.cidade, city.uf, travelConfig.exemptRegions)) {
        setAfDeslocamentoStatus('isenta')
        setAfDeslocamentoKm(0)
        setAfDeslocamentoRs(0)
        setAfDeslocamentoCidadeLabel(label)
        setAfDeslocamentoErro('')
      } else {
        const km = calcRoundTripKm(city.lat, city.lng)
        const custo = calculateInstallerTravelCost(km, travelConfig)
        setAfDeslocamentoStatus('ok')
        setAfDeslocamentoKm(km)
        setAfDeslocamentoRs(custo)
        setAfDeslocamentoCidadeLabel(label)
        setAfDeslocamentoErro('')
      }
    },
    [
      vendasConfig.af_deslocamento_regioes_isentas,
      vendasConfig.af_deslocamento_faixa1_km,
      vendasConfig.af_deslocamento_faixa1_rs,
      vendasConfig.af_deslocamento_faixa2_km,
      vendasConfig.af_deslocamento_faixa2_rs,
      vendasConfig.af_deslocamento_km_excedente_rs,
    ],
  )

  // Sync transport/combustível cost with the auto-calculated deslocamento
  useEffect(() => {
    setAfTransporteCombustivel(afDeslocamentoRs)
  }, [afDeslocamentoRs])

  // -------------------------------------------------------------------------
  // AF-specific simulation state — used ONLY to derive afMensalidadeBaseAuto.
  // Built from AF's own raw inputs; never spread from simulationState (leasing
  // proposal) so the auto mensalidade always reflects AF's local consumo and
  // generation ("local first" policy).
  // -------------------------------------------------------------------------
  const afSimEstadoMensalidade = useMemo<SimulationState | null>(() => {
    const resolveOverride = (override: number, fallback: number, def: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : def
    }
    const consumo = resolveOverride(afConsumoOverride, kcKwhMes, 0)
    if (consumo <= 0) return null

    const irr = resolveOverride(afIrradiacaoOverride, baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, diasMesNormalizado, 30)
    const modulo = resolveOverride(afModuloWpOverride, potenciaModulo, 550)

    let potenciaKwp = 0
    if (afNumModulosOverride != null && afNumModulosOverride > 0) {
      potenciaKwp = (afNumModulosOverride * modulo) / 1000
    } else {
      const computed = calcPotenciaSistemaKwp({
        consumoKwhMes: consumo,
        irradiacao: irr,
        performanceRatio: pr,
        diasMes: dias,
        potenciaModuloWp: modulo,
      })
      potenciaKwp = computed?.potenciaKwp ?? 0
    }
    const afGeracaoKwh = potenciaKwp * irr * pr * dias

    const tusdPercentual = Math.max(0, tusdPercent)
    const tusdSubtipoNorm = tusdSubtipo.trim()
    return {
      kcKwhMes: consumo,
      consumoMensalKwh: consumo,
      geracaoMensalKwh: Math.max(0, afGeracaoKwh),
      prazoMeses: afMesesProjecao,
      entradaRs: 0,
      modoEntrada: 'NONE',
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: Math.max(0, Math.min(descontoConsiderado / 100, 1)),
      inflacaoAa: Math.max(-0.99, inflacaoAa / 100),
      taxaMinima: taxaMinimaInputEmpty
        ? calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
        : Number.isFinite(taxaMinima)
          ? Math.max(0, taxaMinima)
          : 0,
      aplicaTaxaMinima: vendaFormAplicaTaxaMinima ?? true,
      tipoRede,
      tusdPercent: tusdPercentual,
      tusdPercentualFioB: tusdPercentual,
      tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNorm.length > 0 ? tusdSubtipoNorm : null,
      tusdSimultaneidade: tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null,
      tusdTarifaRkwh: tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null,
      tusdAnoReferencia: Number.isFinite(tusdAnoReferencia)
        ? Math.max(1, Math.trunc(tusdAnoReferencia))
        : DEFAULT_TUSD_ANO_REFERENCIA,
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
      encargosFixos,
      cidKwhBase,
      vm0: 0,
      depreciacaoAa: 0,
      ipcaAa: 0,
      inadimplenciaAa: 0,
      tributosAa: 0,
      custosFixosM: 0,
      opexM: 0,
      seguroM: 0,
      cashbackPct: 0,
      pagosAcumManual: 0,
      duracaoMeses: 0,
    }
  }, [
    afConsumoOverride,
    kcKwhMes,
    afIrradiacaoOverride,
    baseIrradiacao,
    afPROverride,
    eficienciaNormalizada,
    afDiasOverride,
    diasMesNormalizado,
    afModuloWpOverride,
    potenciaModulo,
    afNumModulosOverride,
    afMesesProjecao,
    tarifaCheia,
    descontoConsiderado,
    inflacaoAa,
    taxaMinima,
    taxaMinimaInputEmpty,
    tipoRede,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    mesReajuste,
    mesReferencia,
    vendaFormAplicaTaxaMinima,
    encargosFixos,
    cidKwhBase,
  ])

  // AF-specific mensalidades — derived from afSimEstadoMensalidade.
  const mensalidadesAfPorAno = useMemo(
    () => (afSimEstadoMensalidade != null ? selectMensalidadesPorAno(afSimEstadoMensalidade) : []),
    [afSimEstadoMensalidade],
  )

  useEffect(() => {
    setAfMensalidadeBaseAuto(mensalidadesAfPorAno[0] ?? 0)
  }, [mensalidadesAfPorAno])

  // -------------------------------------------------------------------------
  // analiseFinanceiraResult — main calculation memo
  // -------------------------------------------------------------------------
  const analiseFinanceiraResult = useMemo(() => {
    const resolveOverride = (override: number, fallback: number, defaultVal: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : defaultVal
    }
    const irr = resolveOverride(afIrradiacaoOverride, baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, diasMesNormalizado, 30)
    const consumo = resolveOverride(afConsumoOverride, kcKwhMes, 0)
    const modulo = resolveOverride(afModuloWpOverride, potenciaModulo, 550)
    const uf = (afUfOverride || ufTarifa) === 'DF' ? ('DF' as const) : ('GO' as const)

    if (consumo <= 0 || afCustoKit <= 0) {
      return null
    }

    const nModulosOverride =
      afNumModulosOverride != null && afNumModulosOverride > 0
        ? afNumModulosOverride
        : undefined
    let baseSistema: { quantidade_modulos: number; potencia_sistema_kwp: number }
    if (nModulosOverride != null) {
      baseSistema = {
        quantidade_modulos: nModulosOverride,
        potencia_sistema_kwp: (nModulosOverride * modulo) / 1000,
      }
    } else {
      const computed = calcPotenciaSistemaKwp({
        consumoKwhMes: consumo,
        irradiacao: irr,
        performanceRatio: pr,
        diasMes: dias,
        potenciaModuloWp: modulo,
      })
      if (!computed) return null
      const qtd =
        computed.quantidadeModulos ?? Math.ceil((computed.potenciaKwp * 1000) / modulo)
      baseSistema = { quantidade_modulos: qtd, potencia_sistema_kwp: computed.potenciaKwp }
    }
    const instalacaoCalculada = baseSistema.quantidade_modulos * 70

    const preProjetoCusto = resolveCustoProjetoPorFaixa(baseSistema.potencia_sistema_kwp)
    const preMaterialCA =
      afMaterialCAOverride != null ? afMaterialCAOverride : afAutoMaterialCA
    const preCrea = resolveCrea(uf)
    const prePlaca =
      afPlaca > 0 ? afPlaca : baseSistema.quantidade_modulos * PRECO_PLACA_RS
    const preProjetoFinal =
      afProjetoOverride != null ? afProjetoOverride : preProjetoCusto
    const preCreaFinal = afCreaOverride != null ? afCreaOverride : preCrea
    const preCustoVariavel =
      afCustoKit +
      afFrete +
      afDescarregamento +
      preProjetoFinal +
      instalacaoCalculada +
      preMaterialCA +
      preCreaFinal +
      prePlaca +
      afHotelPousada +
      afTransporteCombustivel +
      afOutros +
      afDeslocamentoRs

    const valorContrato = afModo === 'leasing' ? preCustoVariavel : afValorContrato

    // Build projected mensalidades series for leasing mode using an AF-isolated
    // SimulationState. This prevents the Proposta de Leasing's simulationState
    // from contaminating the AF calculation.
    let mensalidadesFinal: number[]
    if (afModo === 'leasing' && afMensalidadeBase <= 0) {
      const afGeracaoKwh = baseSistema.potencia_sistema_kwp * irr * pr * dias
      // IMPORTANT: do NOT spread simulationState from the leasing proposal here.
      // All fields are built from the same raw variables to avoid TDZ issues.
      const afSimState: SimulationState = {
        kcKwhMes: consumo,
        consumoMensalKwh: consumo,
        geracaoMensalKwh: afGeracaoKwh,
        prazoMeses: afMesesProjecao,
        entradaRs: 0,
        modoEntrada: 'NONE',
        tarifaCheia: Math.max(0, tarifaCheia),
        desconto: Math.max(0, Math.min(descontoConsiderado / 100, 1)),
        inflacaoAa: Math.max(-0.99, inflacaoAa / 100),
        taxaMinima: taxaMinimaInputEmpty
          ? calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
          : Number.isFinite(taxaMinima)
            ? Math.max(0, taxaMinima)
            : 0,
        aplicaTaxaMinima: vendaFormAplicaTaxaMinima ?? true,
        tipoRede,
        tusdPercent: Math.max(0, tusdPercent),
        tusdPercentualFioB: Math.max(0, tusdPercent),
        tusdTipoCliente,
        tusdSubtipo: tusdSubtipo.trim().length > 0 ? tusdSubtipo.trim() : null,
        tusdSimultaneidade:
          tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null,
        tusdTarifaRkwh: tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null,
        tusdAnoReferencia: Number.isFinite(tusdAnoReferencia)
          ? Math.max(1, Math.trunc(tusdAnoReferencia))
          : DEFAULT_TUSD_ANO_REFERENCIA,
        mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
        mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
        encargosFixos,
        cidKwhBase,
        vm0: 0,
        depreciacaoAa: 0,
        ipcaAa: 0,
        inadimplenciaAa: 0,
        tributosAa: 0,
        custosFixosM: 0,
        opexM: 0,
        seguroM: 0,
        cashbackPct: 0,
        pagosAcumManual: 0,
        duracaoMeses: 0,
      }
      // selectMensalidades is statically imported at the top of this file
      const rawSeries = selectMensalidades(afSimState)
      if (rawSeries.length >= afMesesProjecao) {
        mensalidadesFinal = rawSeries.slice(0, afMesesProjecao)
      } else if (rawSeries.length > 0) {
        const last = rawSeries[rawSeries.length - 1]
        mensalidadesFinal = [
          ...rawSeries,
          ...(Array(afMesesProjecao - rawSeries.length).fill(last) as number[]),
        ]
      } else {
        mensalidadesFinal = Array(afMesesProjecao).fill(afMensalidadeBaseAuto) as number[]
      }
    } else {
      const base = afMensalidadeBase > 0 ? afMensalidadeBase : afMensalidadeBaseAuto
      mensalidadesFinal = Array(afMesesProjecao).fill(base) as number[]
    }
    const margemAlvo = afMargemLiquidaVenda

    try {
      const input = {
        modo: afModo,
        uf,
        consumo_kwh_mes: consumo,
        irradiacao_kwh_m2_dia: irr,
        performance_ratio: pr,
        dias_mes: dias,
        potencia_modulo_wp: modulo,
        ...(nModulosOverride != null
          ? { quantidade_modulos_override: nModulosOverride }
          : {}),
        custo_kit_rs: afCustoKit,
        frete_rs: afFrete,
        descarregamento_rs: afDescarregamento,
        instalacao_rs: instalacaoCalculada,
        hotel_pousada_rs: afHotelPousada,
        transporte_combustivel_rs: afTransporteCombustivel,
        outros_rs: afOutros,
        deslocamento_instaladores_rs: afDeslocamentoRs,
        placa_rs_override: prePlaca,
        material_ca_rs_override: preMaterialCA,
        projeto_rs_override: preProjetoFinal,
        crea_rs_override: preCreaFinal,
        valor_contrato_rs: valorContrato,
        impostos_percent:
          afModo === 'venda' ? afImpostosVenda : afImpostosLeasing,
        custo_fixo_rateado_percent: vendasConfig.af_custo_fixo_rateado_percent,
        lucro_minimo_percent: vendasConfig.af_lucro_minimo_percent,
        comissao_minima_percent: afComissaoMinimaPercent,
        margem_liquida_alvo_percent:
          afModo === 'venda' ? margemAlvo : undefined,
        margem_liquida_minima_percent:
          afModo === 'venda' ? afMargemLiquidaMinima : undefined,
        inadimplencia_percent: afInadimplencia,
        custo_operacional_percent: afCustoOperacional,
        meses_projecao: mensalidadesFinal.length,
        mensalidades_previstas_rs: mensalidadesFinal,
        investimento_inicial_rs: preCustoVariavel,
        taxa_desconto_aa_pct: afTaxaDesconto > 0 ? afTaxaDesconto : null,
      } as AnaliseFinanceiraInput
      return calcularAnaliseFinanceira(input)
    } catch {
      return null
    }
  }, [
    afConsumoOverride,
    afIrradiacaoOverride,
    afPROverride,
    afDiasOverride,
    afModuloWpOverride,
    afUfOverride,
    afNumModulosOverride,
    afCustoKit,
    afCustoOperacional,
    afDescarregamento,
    afFrete,
    afHotelPousada,
    afTransporteCombustivel,
    afOutros,
    afDeslocamentoRs,
    afInadimplencia,
    afMensalidadeBase,
    afMesesProjecao,
    tarifaCheia,
    descontoConsiderado,
    inflacaoAa,
    taxaMinima,
    taxaMinimaInputEmpty,
    tipoRede,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    mesReajuste,
    mesReferencia,
    vendaFormAplicaTaxaMinima,
    encargosFixos,
    cidKwhBase,
    afModo,
    afValorContrato,
    afImpostosVenda,
    afImpostosLeasing,
    afMargemLiquidaVenda,
    afMargemLiquidaMinima,
    afPlaca,
    afMaterialCAOverride,
    afAutoMaterialCA,
    afProjetoOverride,
    afCreaOverride,
    baseIrradiacao,
    diasMesNormalizado,
    eficienciaNormalizada,
    kcKwhMes,
    afMensalidadeBaseAuto,
    potenciaModulo,
    ufTarifa,
    afComissaoMinimaPercent,
    afTaxaDesconto,
    vendasConfig.af_custo_fixo_rateado_percent,
    vendasConfig.af_lucro_minimo_percent,
  ])

  // -------------------------------------------------------------------------
  // indicadorEficienciaProjeto — leasing project efficiency score
  // -------------------------------------------------------------------------
  const indicadorEficienciaProjeto = useMemo(() => {
    if (!analiseFinanceiraResult || afModo !== 'leasing') return null

    const payback =
      analiseFinanceiraResult.payback_total_meses ?? Number.POSITIVE_INFINITY
    const roi = analiseFinanceiraResult.roi_percent ?? 0
    const tir = analiseFinanceiraResult.tir_anual_percent ?? 0
    const investimento =
      analiseFinanceiraResult.investimento_total_leasing_rs ?? 0
    const lucroMensal = analiseFinanceiraResult.lucro_mensal_medio_rs ?? 0
    const lucroRelativo =
      investimento > 0 ? (lucroMensal / investimento) * 100 : 0

    const paybackScore = Math.max(0, Math.min(100, ((60 - payback) / 60) * 100))
    const roiScore = Math.max(0, Math.min(100, roi))
    const tirScore = Math.max(0, Math.min(100, tir / 2))
    const lucroRelativoScore = Math.max(0, Math.min(100, lucroRelativo * 12))

    const score = Math.round(
      paybackScore * 0.35 +
        roiScore * 0.25 +
        tirScore * 0.2 +
        lucroRelativoScore * 0.2,
    )

    const classificacao =
      score >= 85
        ? 'Excelente'
        : score >= 70
          ? 'Bom'
          : score >= 50
            ? 'Atenção'
            : 'Fraco'

    return { score, classificacao }
  }, [afModo, analiseFinanceiraResult])

  // -------------------------------------------------------------------------
  // Callbacks — aprovação
  // -------------------------------------------------------------------------
  const toggleAprovacaoChecklist = useCallback((key: AprovacaoChecklistKey) => {
    setAprovacaoChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  const registrarDecisaoInterna = useCallback((status: AprovacaoStatus) => {
    setAprovacaoStatus(status)
    setUltimaDecisaoTimestamp(Date.now())
  }, [])

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    // aprovação
    aprovacaoStatus,
    setAprovacaoStatus,
    aprovacaoChecklist,
    setAprovacaoChecklist,
    ultimaDecisaoTimestamp,
    setUltimaDecisaoTimestamp,
    toggleAprovacaoChecklist,
    registrarDecisaoInterna,

    // af* state
    afModo,
    setAfModo,
    afCustoKit,
    setAfCustoKit,
    afCustoKitManual,
    setAfCustoKitManual,
    afFrete,
    setAfFrete,
    afFreteManual,
    setAfFreteManual,
    afDescarregamento,
    setAfDescarregamento,
    afHotelPousada,
    setAfHotelPousada,
    afTransporteCombustivel,
    setAfTransporteCombustivel,
    afOutros,
    setAfOutros,
    afCidadeDestino,
    setAfCidadeDestino,
    afDeslocamentoKm,
    setAfDeslocamentoKm,
    afDeslocamentoRs,
    setAfDeslocamentoRs,
    afDeslocamentoStatus,
    setAfDeslocamentoStatus,
    afDeslocamentoCidadeLabel,
    setAfDeslocamentoCidadeLabel,
    afDeslocamentoErro,
    setAfDeslocamentoErro,
    afValorContrato,
    setAfValorContrato,
    afImpostosVenda,
    setAfImpostosVenda,
    afImpostosLeasing,
    setAfImpostosLeasing,
    afInadimplencia,
    setAfInadimplencia,
    afCustoOperacional,
    setAfCustoOperacional,
    afMesesProjecao,
    setAfMesesProjecao,
    afMensalidadeBase,
    setAfMensalidadeBase,
    afMensalidadeBaseAuto,
    setAfMensalidadeBaseAuto,
    afMargemLiquidaVenda,
    setAfMargemLiquidaVenda,
    afMargemLiquidaMinima,
    setAfMargemLiquidaMinima,
    afComissaoMinimaPercent,
    setAfComissaoMinimaPercent,
    afTaxaDesconto,
    setAfTaxaDesconto,
    afConsumoOverride,
    setAfConsumoOverride,
    afIrradiacaoOverride,
    setAfIrradiacaoOverride,
    afPROverride,
    setAfPROverride,
    afDiasOverride,
    setAfDiasOverride,
    afModuloWpOverride,
    setAfModuloWpOverride,
    afUfOverride,
    setAfUfOverride,
    afNumModulosOverride,
    setAfNumModulosOverride,
    afPlaca,
    setAfPlaca,
    afAutoMaterialCA,
    setAfAutoMaterialCA,
    afMaterialCAOverride,
    setAfMaterialCAOverride,
    afProjetoOverride,
    setAfProjetoOverride,
    afCreaOverride,
    setAfCreaOverride,
    afCidadeSuggestions,
    setAfCidadeSuggestions,
    afCidadeShowSuggestions,
    setAfCidadeShowSuggestions,

    // refs
    afBaseInitializedRef,
    afCidadeBlurTimerRef,

    // BR number fields
    afCustoKitField,
    afValorContratoField,
    afFreteField,
    afDescarregamentoField,
    afPlacaField,
    afHotelPousadaField,
    afTransporteCombustivelField,
    afOutrosField,
    afMensalidadeBaseField,
    afMaterialCAField,
    afProjetoField,
    afCreaField,

    // callbacks
    handleSelectCidade,

    // derived memos
    analiseFinanceiraResult,
    indicadorEficienciaProjeto,
  }
}

export type UseAnaliseFinanceiraStateReturn = ReturnType<typeof useAnaliseFinanceiraState>
