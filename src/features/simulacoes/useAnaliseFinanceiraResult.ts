import { useMemo } from 'react'
import { type SimulationState, selectMensalidades, selectMensalidadesPorAno } from '../../selectors'
import { calcularTaxaMinima } from '../../utils/calcs'
import { calcPotenciaSistemaKwp } from '../../lib/pricing/pricingPorKwp'
import { DEFAULT_TUSD_ANO_REFERENCIA } from '../../lib/finance/tusd'
import {
  calcularAnaliseFinanceira,
  resolveCustoProjetoPorFaixa,
  resolveCrea,
  PRECO_PLACA_RS,
} from '../../lib/finance/analiseFinanceiraSpreadsheet'
import type { AnaliseFinanceiraInput, AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'
import { useAfInputStore } from './useAfInputStore'
import {
  selectAfModo,
  selectAfConsumoOverride,
  selectAfIrradiacaoOverride,
  selectAfPROverride,
  selectAfDiasOverride,
  selectAfModuloWpOverride,
  selectAfNumModulosOverride,
  selectAfMesesProjecao,
  selectAfUfOverride,
  selectAfCustoKit,
  selectAfFrete,
  selectAfDescarregamento,
  selectAfHotelPousada,
  selectAfTransporteCombustivel,
  selectAfOutros,
  selectAfPlaca,
  selectAfValorContrato,
  selectAfMensalidadeBase,
  selectAfImpostosVenda,
  selectAfImpostosLeasing,
  selectAfInadimplencia,
  selectAfCustoOperacional,
  selectAfMargemLiquidaVenda,
  selectAfMargemLiquidaMinima,
  selectAfComissaoMinimaPercent,
  selectAfTaxaDesconto,
  selectAfAutoMaterialCA,
  selectAfMaterialCAOverride,
  selectAfProjetoOverride,
  selectAfCreaOverride,
} from './afInputSelectors'
import { useAfDeslocamentoStore } from './useAfDeslocamentoStore'
import { selectAfDeslocamentoRs } from './afDeslocamentoSelectors'
import { useVendasConfigStore, vendasConfigSelectors } from '../../store/useVendasConfigStore'

export interface TarifaContexto {
  kcKwhMes: number
  tarifaCheia: number
  descontoConsiderado: number

  inflacaoAa: number
  taxaMinima: number
  taxaMinimaInputEmpty: boolean

  tipoRede: string

  tusdPercent: number
  tusdTipoCliente: string
  tusdSubtipo: string
  tusdSimultaneidade: number
  tusdTarifaRkwh: number
  tusdAnoReferencia: number

  mesReajuste: number
  mesReferencia: number

  encargosFixos: number
  cidKwhBase: number

  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number

  potenciaModulo: number

  ufTarifa: string

  aplicaTaxaMinima: boolean
}

export function useAfSimEstadoMensalidade(ctx: TarifaContexto): SimulationState | null {
  const afConsumoOverride = useAfInputStore(selectAfConsumoOverride)
  const afIrradiacaoOverride = useAfInputStore(selectAfIrradiacaoOverride)
  const afPROverride = useAfInputStore(selectAfPROverride)
  const afDiasOverride = useAfInputStore(selectAfDiasOverride)
  const afModuloWpOverride = useAfInputStore(selectAfModuloWpOverride)
  const afNumModulosOverride = useAfInputStore(selectAfNumModulosOverride)
  const afMesesProjecao = useAfInputStore(selectAfMesesProjecao)

  return useMemo<SimulationState | null>(() => {
    const resolveOverride = (override: number, fallback: number, def: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : def
    }
    const consumo = resolveOverride(afConsumoOverride, ctx.kcKwhMes, 0)
    if (consumo <= 0) return null

    const irr = resolveOverride(afIrradiacaoOverride, ctx.baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, ctx.eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, ctx.diasMesNormalizado, 30)
    const modulo = resolveOverride(afModuloWpOverride, ctx.potenciaModulo, 550)

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

    const tusdPercentual = Math.max(0, ctx.tusdPercent)
    const tusdSubtipoNorm = ctx.tusdSubtipo.trim()
    return {
      kcKwhMes: consumo,
      consumoMensalKwh: consumo,
      geracaoMensalKwh: Math.max(0, afGeracaoKwh),
      prazoMeses: afMesesProjecao,
      entradaRs: 0,
      modoEntrada: 'NONE',
      // Tariff/TUSD fields — same normalization used in simulationState and afSimState
      tarifaCheia: Math.max(0, ctx.tarifaCheia),
      desconto: Math.max(0, Math.min(ctx.descontoConsiderado / 100, 1)),
      inflacaoAa: Math.max(-0.99, ctx.inflacaoAa / 100),
      taxaMinima: ctx.taxaMinimaInputEmpty
        ? calcularTaxaMinima(ctx.tipoRede, Math.max(0, ctx.tarifaCheia))
        : Number.isFinite(ctx.taxaMinima) ? Math.max(0, ctx.taxaMinima) : 0,
      aplicaTaxaMinima: ctx.aplicaTaxaMinima,
      tipoRede: ctx.tipoRede,
      tusdPercent: tusdPercentual,
      tusdPercentualFioB: tusdPercentual,
      tusdTipoCliente: ctx.tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNorm.length > 0 ? tusdSubtipoNorm : null,
      tusdSimultaneidade: ctx.tusdSimultaneidade != null ? Math.max(0, ctx.tusdSimultaneidade) : null,
      tusdTarifaRkwh: ctx.tusdTarifaRkwh != null ? Math.max(0, ctx.tusdTarifaRkwh) : null,
      tusdAnoReferencia: Number.isFinite(ctx.tusdAnoReferencia)
        ? Math.max(1, Math.trunc(ctx.tusdAnoReferencia))
        : DEFAULT_TUSD_ANO_REFERENCIA,
      mesReajuste: Math.min(Math.max(Math.round(ctx.mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(ctx.mesReferencia) || 1, 1), 12),
      encargosFixos: ctx.encargosFixos,
      cidKwhBase: ctx.cidKwhBase,
      // Fields not consulted by selectMensalidades — safe zero defaults
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
    afConsumoOverride, ctx.kcKwhMes,
    afIrradiacaoOverride, ctx.baseIrradiacao,
    afPROverride, ctx.eficienciaNormalizada,
    afDiasOverride, ctx.diasMesNormalizado,
    afModuloWpOverride, ctx.potenciaModulo,
    afNumModulosOverride,
    afMesesProjecao,
    ctx.tarifaCheia, ctx.descontoConsiderado, ctx.inflacaoAa, ctx.taxaMinima, ctx.taxaMinimaInputEmpty,
    ctx.tipoRede, ctx.tusdPercent, ctx.tusdTipoCliente, ctx.tusdSubtipo, ctx.tusdSimultaneidade,
    ctx.tusdTarifaRkwh, ctx.tusdAnoReferencia, ctx.mesReajuste, ctx.mesReferencia,
    ctx.aplicaTaxaMinima, ctx.encargosFixos, ctx.cidKwhBase,
  ])
}

export function useAnaliseFinanceiraResult(ctx: TarifaContexto): {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  afMensalidadeBaseAuto: number
} {
  // Step 1: AF-specific simulation state (used to derive afMensalidadeBaseAuto).
  // Declared first so afMensalidadeBaseAuto is available before analiseFinanceiraResult.
  const afSimEstadoMensalidade = useAfSimEstadoMensalidade(ctx)

  // Step 2: Mensalidades por ano — depends on afSimEstadoMensalidade.
  const mensalidadesAfPorAno = useMemo(
    () => (afSimEstadoMensalidade != null ? selectMensalidadesPorAno(afSimEstadoMensalidade) : []),
    [afSimEstadoMensalidade],
  )

  // Step 3: afMensalidadeBaseAuto — must be computed before analiseFinanceiraResult.
  const afMensalidadeBaseAuto = useMemo(
    () => mensalidadesAfPorAno[0] ?? 0,
    [mensalidadesAfPorAno],
  )

  // Step 4: Read af* values from stores.
  const afModo = useAfInputStore(selectAfModo)
  const afConsumoOverride = useAfInputStore(selectAfConsumoOverride)
  const afIrradiacaoOverride = useAfInputStore(selectAfIrradiacaoOverride)
  const afPROverride = useAfInputStore(selectAfPROverride)
  const afDiasOverride = useAfInputStore(selectAfDiasOverride)
  const afModuloWpOverride = useAfInputStore(selectAfModuloWpOverride)
  const afNumModulosOverride = useAfInputStore(selectAfNumModulosOverride)
  const afUfOverride = useAfInputStore(selectAfUfOverride)
  const afCustoKit = useAfInputStore(selectAfCustoKit)
  const afFrete = useAfInputStore(selectAfFrete)
  const afDescarregamento = useAfInputStore(selectAfDescarregamento)
  const afHotelPousada = useAfInputStore(selectAfHotelPousada)
  const afTransporteCombustivel = useAfInputStore(selectAfTransporteCombustivel)
  const afOutros = useAfInputStore(selectAfOutros)
  const afPlaca = useAfInputStore(selectAfPlaca)
  const afValorContrato = useAfInputStore(selectAfValorContrato)
  const afMensalidadeBase = useAfInputStore(selectAfMensalidadeBase)
  const afImpostosVenda = useAfInputStore(selectAfImpostosVenda)
  const afImpostosLeasing = useAfInputStore(selectAfImpostosLeasing)
  const afInadimplencia = useAfInputStore(selectAfInadimplencia)
  const afCustoOperacional = useAfInputStore(selectAfCustoOperacional)
  const afMesesProjecao = useAfInputStore(selectAfMesesProjecao)
  const afMargemLiquidaVenda = useAfInputStore(selectAfMargemLiquidaVenda)
  const afMargemLiquidaMinima = useAfInputStore(selectAfMargemLiquidaMinima)
  const afComissaoMinimaPercent = useAfInputStore(selectAfComissaoMinimaPercent)
  const afTaxaDesconto = useAfInputStore(selectAfTaxaDesconto)
  const afAutoMaterialCA = useAfInputStore(selectAfAutoMaterialCA)
  const afMaterialCAOverride = useAfInputStore(selectAfMaterialCAOverride)
  const afProjetoOverride = useAfInputStore(selectAfProjetoOverride)
  const afCreaOverride = useAfInputStore(selectAfCreaOverride)

  const afDeslocamentoRs = useAfDeslocamentoStore(selectAfDeslocamentoRs)
  const vendasConfig = useVendasConfigStore(vendasConfigSelectors.config)

  // Step 5: analiseFinanceiraResult — exact logic from App.tsx, ctx.* replaces raw vars.
  const analiseFinanceiraResult = useMemo(() => {
    const resolveOverride = (override: number, fallback: number, defaultVal: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : defaultVal
    }
    const irr = resolveOverride(afIrradiacaoOverride, ctx.baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, ctx.eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, ctx.diasMesNormalizado, 30)
    const consumo = resolveOverride(afConsumoOverride, ctx.kcKwhMes, 0)
    const modulo = resolveOverride(afModuloWpOverride, ctx.potenciaModulo, 550)
    const uf = (afUfOverride || ctx.ufTarifa) === 'DF' ? 'DF' as const : 'GO' as const

    if (consumo <= 0 || afCustoKit <= 0) {
      return null
    }

    // Pre-compute base system using the same engine as the leasing proposals page
    const nModulosOverride = afNumModulosOverride != null && afNumModulosOverride > 0
      ? afNumModulosOverride
      : undefined
    let baseSistema: { quantidade_modulos: number; potencia_sistema_kwp: number }
    if (nModulosOverride != null) {
      baseSistema = { quantidade_modulos: nModulosOverride, potencia_sistema_kwp: (nModulosOverride * modulo) / 1000 }
    } else {
      const computed = calcPotenciaSistemaKwp({
        consumoKwhMes: consumo,
        irradiacao: irr,
        performanceRatio: pr,
        diasMes: dias,
        potenciaModuloWp: modulo,
      })
      if (!computed) return null
      const qtd = computed.quantidadeModulos ?? Math.ceil((computed.potenciaKwp * 1000) / modulo)
      baseSistema = { quantidade_modulos: qtd, potencia_sistema_kwp: computed.potenciaKwp }
    }
    const instalacaoCalculada = baseSistema.quantidade_modulos * 70

    // Pre-compute variable cost for leasing (used as valor_contrato for insurance)
    const preProjetoCusto = resolveCustoProjetoPorFaixa(baseSistema.potencia_sistema_kwp)
    const preMaterialCA = afMaterialCAOverride != null ? afMaterialCAOverride : afAutoMaterialCA
    const preCrea = resolveCrea(uf)
    const prePlaca = afPlaca > 0 ? afPlaca : baseSistema.quantidade_modulos * PRECO_PLACA_RS
    const preProjetoFinal = afProjetoOverride != null ? afProjetoOverride : preProjetoCusto
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
    // Build the projected mensalidades series for leasing mode using an AF-isolated
    // SimulationState. This prevents the Proposta de Leasing's simulationState (which
    // uses the proposal's own consumo/geração/prazo) from contaminating the AF calculation.
    // Each screen uses the same motor but with its own input context.
    let mensalidadesFinal: number[]
    if (afModo === 'leasing' && afMensalidadeBase <= 0) {
      // Compute AF's monthly generation from its own irr/PR/dias/kWp inputs
      const afGeracaoKwh = baseSistema.potencia_sistema_kwp * irr * pr * dias
      // Build AF-specific SimulationState from raw component variables.
      const afSimState: SimulationState = {
        // AF-specific overrides
        kcKwhMes: consumo,
        consumoMensalKwh: consumo,
        geracaoMensalKwh: afGeracaoKwh,
        prazoMeses: afMesesProjecao,
        entradaRs: 0,
        modoEntrada: 'NONE',
        // Shared tariff/TUSD fields — same normalization as simulationState
        tarifaCheia: Math.max(0, ctx.tarifaCheia),
        desconto: Math.max(0, Math.min(ctx.descontoConsiderado / 100, 1)),
        inflacaoAa: Math.max(-0.99, ctx.inflacaoAa / 100),
        taxaMinima: ctx.taxaMinimaInputEmpty
          ? calcularTaxaMinima(ctx.tipoRede, Math.max(0, ctx.tarifaCheia))
          : Number.isFinite(ctx.taxaMinima) ? Math.max(0, ctx.taxaMinima) : 0,
        aplicaTaxaMinima: ctx.aplicaTaxaMinima,
        tipoRede: ctx.tipoRede,
        tusdPercent: Math.max(0, ctx.tusdPercent),
        tusdPercentualFioB: Math.max(0, ctx.tusdPercent),
        tusdTipoCliente: ctx.tusdTipoCliente,
        tusdSubtipo: ctx.tusdSubtipo.trim().length > 0 ? ctx.tusdSubtipo.trim() : null,
        tusdSimultaneidade: ctx.tusdSimultaneidade != null ? Math.max(0, ctx.tusdSimultaneidade) : null,
        tusdTarifaRkwh: ctx.tusdTarifaRkwh != null ? Math.max(0, ctx.tusdTarifaRkwh) : null,
        tusdAnoReferencia: Number.isFinite(ctx.tusdAnoReferencia)
          ? Math.max(1, Math.trunc(ctx.tusdAnoReferencia))
          : DEFAULT_TUSD_ANO_REFERENCIA,
        mesReajuste: Math.min(Math.max(Math.round(ctx.mesReajuste) || 6, 1), 12),
        mesReferencia: Math.min(Math.max(Math.round(ctx.mesReferencia) || 1, 1), 12),
        encargosFixos: ctx.encargosFixos,
        cidKwhBase: ctx.cidKwhBase,
        // Fields not consulted by selectMensalidades — safe zero defaults
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
      const rawSeries = selectMensalidades(afSimState)
      if (rawSeries.length >= afMesesProjecao) {
        mensalidadesFinal = rawSeries.slice(0, afMesesProjecao)
      } else if (rawSeries.length > 0) {
        const last = rawSeries[rawSeries.length - 1]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        mensalidadesFinal = [...rawSeries, ...Array(afMesesProjecao - rawSeries.length).fill(last)]
      } else {
        mensalidadesFinal = Array(afMesesProjecao).fill(afMensalidadeBaseAuto) as number[]
      }
    } else {
      const base = afMensalidadeBase > 0 ? afMensalidadeBase : afMensalidadeBaseAuto
      mensalidadesFinal = Array(afMesesProjecao).fill(base) as number[]
    }
    const margemAlvo = afMargemLiquidaVenda

    try {
      const input: AnaliseFinanceiraInput = {
        modo: afModo,
        uf,
        consumo_kwh_mes: consumo,
        irradiacao_kwh_m2_dia: irr,
        performance_ratio: pr,
        dias_mes: dias,
        potencia_modulo_wp: modulo,
        ...(nModulosOverride != null ? { quantidade_modulos_override: nModulosOverride } : {}),
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
        impostos_percent: afModo === 'venda' ? afImpostosVenda : afImpostosLeasing,
        custo_fixo_rateado_percent: vendasConfig.af_custo_fixo_rateado_percent,
        lucro_minimo_percent: vendasConfig.af_lucro_minimo_percent,
        comissao_minima_percent: afComissaoMinimaPercent,
        margem_liquida_alvo_percent: afModo === 'venda' ? margemAlvo : undefined,
        margem_liquida_minima_percent: afModo === 'venda' ? afMargemLiquidaMinima : undefined,
        inadimplencia_percent: afInadimplencia,
        custo_operacional_percent: afCustoOperacional,
        meses_projecao: mensalidadesFinal.length,
        mensalidades_previstas_rs: mensalidadesFinal,
        investimento_inicial_rs: preCustoVariavel,
        taxa_desconto_aa_pct: afTaxaDesconto > 0 ? afTaxaDesconto : null,
      }
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
    ctx.tarifaCheia,
    ctx.descontoConsiderado,
    ctx.inflacaoAa,
    ctx.taxaMinima,
    ctx.taxaMinimaInputEmpty,
    ctx.tipoRede,
    ctx.tusdPercent,
    ctx.tusdTipoCliente,
    ctx.tusdSubtipo,
    ctx.tusdSimultaneidade,
    ctx.tusdTarifaRkwh,
    ctx.tusdAnoReferencia,
    ctx.mesReajuste,
    ctx.mesReferencia,
    ctx.aplicaTaxaMinima,
    ctx.encargosFixos,
    ctx.cidKwhBase,
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
    ctx.baseIrradiacao,
    ctx.diasMesNormalizado,
    ctx.eficienciaNormalizada,
    ctx.kcKwhMes,
    afMensalidadeBaseAuto,
    ctx.potenciaModulo,
    ctx.ufTarifa,
    afComissaoMinimaPercent,
    afTaxaDesconto,
    vendasConfig.af_custo_fixo_rateado_percent,
    vendasConfig.af_lucro_minimo_percent,
  ])

  return { analiseFinanceiraResult, afMensalidadeBaseAuto }
}
