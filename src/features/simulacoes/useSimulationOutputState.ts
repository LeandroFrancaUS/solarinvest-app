/**
 * useSimulationOutputState.ts
 *
 * Extracted from App.tsx (Phase 2E). Owns all derived simulation output state:
 *   simulationState (main SimulationState object), selector-derived memos,
 *   leasing/financing computed values, buyout table, parcelas, ROI arrays,
 *   economy estimative sync effect, and the printableData memo.
 *
 * Zero behavioural change — exact same logic as the original App.tsx block.
 */

import { useEffect, useMemo } from 'react'
import {
  selectBuyoutLinhas,
  selectCreditoMensal,
  selectInflacaoMensal,
  selectKcAjustado,
  selectMensalidades,
  selectMensalidadesPorAno,
  selectTarifaDescontada,
  type BuyoutLinha,
  type SimulationState,
} from '../../selectors'
import {
  calcularTaxaMinima,
  tarifaDescontada as tarifaDescontadaCalc,
  tarifaProjetadaCheia,
  type EntradaModo,
} from '../../utils/calcs'
import { computeROI, type VendaForm } from '../../lib/finance/roi'
import type { RetornoProjetado } from '../../lib/finance/roi'
import { calcTusdEncargoMensal, DEFAULT_TUSD_ANO_REFERENCIA } from '../../lib/finance/tusd'
import type { TipoClienteTUSD } from '../../lib/finance/tusd'
import { buildPrintableData } from '../../lib/pdf/buildPrintableData'
import { getVendaSnapshot } from '../../store/useVendaStore'
import { vendaActions } from '../../store/useVendaStore'
import type {
  BuyoutResumo,
  BuyoutRow,
  MensalidadeRow,
  PrintableProposalImage,
  PrintableProposalProps,
  PrintableMultiUcResumo,
  UfvComposicaoTelhadoValores,
  UfvComposicaoSoloValores,
} from '../../types/printableProposal'
import { ANALISE_ANOS_PADRAO } from '../../app/config'
import type { VendasConfig } from '../../types/vendasConfig'
import type { LeasingContratoDados } from '../../store/useLeasingStore'
import type { UcBeneficiariaFormState } from '../../types/ucBeneficiaria'
import type { ParsedVendaPdfData } from '../../lib/pdf/extractVendas'
import type { StructuredItem } from '../../utils/structuredBudgetParser'
import type { Outputs as ComposicaoCalculo } from '../../lib/venda/calcComposicaoUFV'
import type { TipoRede } from '../../shared/rede'
import type { SegmentoCliente, TipoSistema } from '../../lib/finance/roi'
import type { TipoInstalacao } from '../../types/printableProposal'
import type { ArredondarPasso } from '../../lib/venda/calcComposicaoUFV'
import type { SeguroModo } from '../../app/config'

// ─── Local constants ───────────────────────────────────────────────────────────

const ECONOMIA_ESTIMATIVA_PADRAO_ANOS = 5

// ─── Hook parameter interface ─────────────────────────────────────────────────

export interface UseSimulationOutputStateParams {
  // From useComposicaoUsinaCalculo
  custoFinalProjetadoCanonico: number
  capex: number
  capexSolarInvest: number
  leasingValorDeMercadoEstimado: number

  // Analise financeira state
  kcKwhMes: number
  tarifaCheia: number
  inflacaoAa: number
  taxaMinima: number
  taxaMinimaInputEmpty: boolean

  // Seam zone memos / consts
  encargosFixos: number
  cidKwhBase: number
  entradaConsiderada: number
  descontoConsiderado: number
  prazoMesesConsiderado: number
  leasingPrazoConsiderado: number
  modoEntradaNormalizado: EntradaModo

  // Economic params
  depreciacaoAa: number
  ipcaAa: number
  inadimplenciaAa: number
  tributosAa: number
  custosFixosM: number
  opexM: number
  seguroM: number
  cashbackPct: number
  pagosAcumAteM: number
  duracaoMeses: number

  // Seguro / O&M params
  seguroModo: SeguroModo
  seguroReajuste: number
  seguroValorA: number
  seguroPercentualB: number
  oemBase: number
  oemInflacao: number

  // Financing params (from useLeasingFinanciamentoState)
  jurosFinAa: number
  entradaFinPct: number
  prazoFinMeses: number
  bandeiraEncargo: number
  mostrarFinanciamento: boolean

  // TUSD params
  tusdPercent: number
  tusdTipoCliente: TipoClienteTUSD
  tusdSubtipo: string
  tusdSimultaneidade: number | null
  tusdTarifaRkwh: number | null
  tusdAnoReferencia: number

  // System params
  tipoRede: TipoRede
  mesReajuste: number
  mesReferencia: number
  encargosFixosExtras: number
  geracaoMensalKwh: number
  potenciaInstaladaKwp: number

  // Venda
  vendaForm: VendaForm
  isVendaDiretaTab: boolean
  retornoProjetado: RetornoProjetado | null
  validateVendaForm: (form: VendaForm) => Record<string, string>
  recalcularTick: number

  // printableData — client / budget
  cliente: PrintableProposalProps['cliente']
  currentBudgetId: string | null
  numeroModulosEstimado: number
  potenciaModulo: number
  tipoSistema: TipoSistema
  segmentoCliente: SegmentoCliente
  tipoInstalacao: TipoInstalacao
  tipoInstalacaoOutro: string
  tipoEdificacaoOutro: string
  areaInstalacao: number
  distribuidoraAneelEfetiva: string | null
  valorOrcamentoConsiderado: number
  valorVendaTelhado: number
  valorVendaSolo: number
  margemManualAtiva: boolean
  margemManualValor: number | undefined
  descontosValor: number
  arredondarPasso: ArredondarPasso
  valorTotalPropostaNormalizado: number | null
  valorTotalPropostaState: number | null
  custoImplantacaoReferencia: number | null | undefined
  composicaoTelhado: UfvComposicaoTelhadoValores
  composicaoSolo: UfvComposicaoSoloValores
  composicaoTelhadoTotal: number
  composicaoSoloTotal: number
  composicaoTelhadoCalculo: ComposicaoCalculo | null | undefined
  composicaoSoloCalculo: ComposicaoCalculo | null | undefined
  vendasConfig: VendasConfig
  parsedVendaPdf: ParsedVendaPdfData | null
  multiUcPrintableResumo: PrintableMultiUcResumo | null
  ucsBeneficiarias: UcBeneficiariaFormState[]
  budgetStructuredItems: StructuredItem[]
  propostaImagens: PrintableProposalImage[]
  configuracaoUsinaObservacoes: string
  modoOrcamento: 'auto' | 'manual'
  autoCustoFinal: number | null | undefined
  mostrarValorMercadoLeasing: boolean
  leasingContrato: LeasingContratoDados
  vendaSnapshotSignal: unknown
  leasingSnapshotSignal: unknown
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSimulationOutputState(params: UseSimulationOutputStateParams) {
  const {
    custoFinalProjetadoCanonico,
    capex,
    capexSolarInvest,
    leasingValorDeMercadoEstimado,
    kcKwhMes,
    tarifaCheia,
    inflacaoAa,
    taxaMinima,
    taxaMinimaInputEmpty,
    encargosFixos,
    cidKwhBase,
    entradaConsiderada,
    descontoConsiderado,
    prazoMesesConsiderado,
    leasingPrazoConsiderado,
    modoEntradaNormalizado,
    depreciacaoAa,
    ipcaAa,
    inadimplenciaAa,
    tributosAa,
    custosFixosM,
    opexM,
    seguroM,
    cashbackPct,
    pagosAcumAteM,
    duracaoMeses,
    seguroModo,
    seguroReajuste,
    seguroValorA,
    seguroPercentualB,
    oemBase,
    oemInflacao,
    jurosFinAa,
    entradaFinPct,
    prazoFinMeses,
    bandeiraEncargo,
    mostrarFinanciamento,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    tipoRede,
    mesReajuste,
    mesReferencia,
    encargosFixosExtras,
    geracaoMensalKwh,
    potenciaInstaladaKwp,
    vendaForm,
    isVendaDiretaTab,
    retornoProjetado,
    validateVendaForm,
    recalcularTick,
    cliente,
    currentBudgetId,
    numeroModulosEstimado,
    potenciaModulo,
    tipoSistema,
    segmentoCliente,
    tipoInstalacao,
    tipoInstalacaoOutro,
    tipoEdificacaoOutro,
    areaInstalacao,
    distribuidoraAneelEfetiva,
    valorOrcamentoConsiderado,
    valorVendaTelhado,
    valorVendaSolo,
    margemManualAtiva,
    margemManualValor,
    descontosValor,
    arredondarPasso,
    valorTotalPropostaNormalizado,
    valorTotalPropostaState,
    custoImplantacaoReferencia,
    composicaoTelhado,
    composicaoSolo,
    composicaoTelhadoTotal,
    composicaoSoloTotal,
    composicaoTelhadoCalculo,
    composicaoSoloCalculo,
    vendasConfig,
    parsedVendaPdf,
    multiUcPrintableResumo,
    ucsBeneficiarias,
    budgetStructuredItems,
    propostaImagens,
    configuracaoUsinaObservacoes,
    modoOrcamento,
    autoCustoFinal,
    mostrarValorMercadoLeasing,
    leasingContrato,
    vendaSnapshotSignal,
    leasingSnapshotSignal,
  } = params

  // ── Main SimulationState ───────────────────────────────────────────────────

  const simulationState = useMemo<SimulationState>(() => {
    // Mantemos o valor de mercado (vm0) amarrado ao custo final projetado canônico neste mesmo memo
    // para evitar dependências de ordem que poderiam reaparecer em merges futuros. Assim garantimos
    // uma única fonte de verdade entre a projeção principal e o fluxo de buyout.
    const valorMercadoBase = Math.max(0, custoFinalProjetadoCanonico)
    const descontoDecimal = Math.max(0, Math.min(descontoConsiderado / 100, 1))
    const inflacaoAnual = Math.max(-0.99, inflacaoAa / 100)
    const prazoContratualMeses = Math.max(0, Math.floor(prazoMesesConsiderado))
    const prazoLeasingMeses = Math.max(0, Math.floor(leasingPrazoConsiderado * 12))
    const prazoMensalidades = Math.max(prazoContratualMeses, prazoLeasingMeses)
    const aplicaTaxaMinima = vendaForm.aplica_taxa_minima ?? true
    const tusdPercentual = Math.max(0, tusdPercent)
    const tusdSubtipoNormalizado = tusdSubtipo.trim()
    const tusdSimValue = tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null
    const tusdTarifaValue = tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null
    const tusdAno = Number.isFinite(tusdAnoReferencia)
      ? Math.max(1, Math.trunc(tusdAnoReferencia))
      : DEFAULT_TUSD_ANO_REFERENCIA
    const taxaMinimaCalculadaBase = calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
    const taxaMinimaFonte = taxaMinimaInputEmpty
      ? taxaMinimaCalculadaBase
      : Number.isFinite(taxaMinima)
        ? Math.max(0, taxaMinima)
        : 0
    return {
      kcKwhMes: Math.max(0, kcKwhMes),
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: descontoDecimal,
      inflacaoAa: inflacaoAnual,
      prazoMeses: prazoMensalidades,
      taxaMinima: taxaMinimaFonte,
      encargosFixos,
      entradaRs: Math.max(0, entradaConsiderada),
      modoEntrada: modoEntradaNormalizado,
      vm0: valorMercadoBase,
      depreciacaoAa: Math.max(0, depreciacaoAa / 100),
      ipcaAa: Math.max(0, ipcaAa / 100),
      inadimplenciaAa: Math.max(0, inadimplenciaAa / 100),
      tributosAa: Math.max(0, tributosAa / 100),
      custosFixosM: Math.max(0, custosFixosM),
      opexM: Math.max(0, opexM),
      seguroM: Math.max(0, seguroM),
      cashbackPct: Math.max(0, cashbackPct / 100),
      pagosAcumManual: Math.max(0, pagosAcumAteM),
      duracaoMeses: Math.max(0, Math.floor(duracaoMeses)),
      geracaoMensalKwh: Math.max(0, geracaoMensalKwh),
      consumoMensalKwh: Math.max(0, kcKwhMes),
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
      tusdPercent: tusdPercentual,
      tusdPercentualFioB: tusdPercentual,
      tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNormalizado.length > 0 ? tusdSubtipoNormalizado : null,
      tusdSimultaneidade: tusdSimValue,
      tusdTarifaRkwh: tusdTarifaValue,
      tusdAnoReferencia: tusdAno,
      aplicaTaxaMinima,
      cidKwhBase,
      tipoRede,
    }
  }, [
    bandeiraEncargo,
    capex,
    custoFinalProjetadoCanonico,
    cashbackPct,
    custosFixosM,
    descontoConsiderado,
    entradaConsiderada,
    geracaoMensalKwh,
    inflacaoAa,
    inadimplenciaAa,
    ipcaAa,
    kcKwhMes,
    mesReajuste,
    modoEntradaNormalizado,
    opexM,
    pagosAcumAteM,
    prazoMesesConsiderado,
    leasingPrazoConsiderado,
    seguroM,
    tarifaCheia,
    taxaMinima,
    taxaMinimaInputEmpty,
    tributosAa,
    encargosFixosExtras,
    depreciacaoAa,
    duracaoMeses,
    cidKwhBase,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    vendaForm.aplica_taxa_minima,
    tipoRede,
  ])

  const vm0 = simulationState.vm0

  const inflacaoMensal = useMemo(() => selectInflacaoMensal(simulationState), [simulationState])
  const mensalidades = useMemo(() => selectMensalidades(simulationState), [simulationState])
  const mensalidadesPorAno = useMemo(() => selectMensalidadesPorAno(simulationState), [simulationState])
  const creditoEntradaMensal = useMemo(() => selectCreditoMensal(simulationState), [simulationState])
  const kcAjustado = useMemo(() => selectKcAjustado(simulationState), [simulationState])
  const buyoutLinhas = useMemo(() => selectBuyoutLinhas(simulationState), [simulationState])

  // ── Internal helpers ───────────────────────────────────────────────────────

  const tarifaAno = (ano: number) =>
    tarifaProjetadaCheia(
      simulationState.tarifaCheia,
      simulationState.inflacaoAa,
      (ano - 1) * 12 + 1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )

  const leasingBeneficios = useMemo(() => {
    const valorInvestimento = Math.max(0, capexSolarInvest)
    const prazoLeasingValido = leasingPrazoConsiderado > 0 ? leasingPrazoConsiderado : null
    const economiaOpexAnual = prazoLeasingValido ? valorInvestimento * 0.015 : 0
    const investimentoDiluirAnual = prazoLeasingValido ? valorInvestimento / prazoLeasingValido : 0

    const contratoMeses = Math.max(0, Math.floor(leasingPrazoConsiderado * 12))
    const tusdTipoAtual = simulationState.tusdTipoCliente
    const tusdSubtipoAtual = simulationState.tusdSubtipo
    const tusdPercentAtual = simulationState.tusdPercent
    const tusdSimAtual = simulationState.tusdSimultaneidade
    const tusdTarifaAtual = simulationState.tusdTarifaRkwh
    const tusdAnoAtual = simulationState.tusdAnoReferencia
    const aplicaTaxaMinima = simulationState.aplicaTaxaMinima ?? true

    return Array.from({ length: ANALISE_ANOS_PADRAO }, (_, i) => {
      const ano = i + 1
      const inicioMes = (ano - 1) * 12 + 1
      const fimMes = inicioMes + 11
      let economiaEnergia = 0

      for (let mes = inicioMes; mes <= fimMes; mes += 1) {
        const tarifaCheiaMes = tarifaProjetadaCheia(
          simulationState.tarifaCheia,
          simulationState.inflacaoAa,
          mes,
          simulationState.mesReajuste,
          simulationState.mesReferencia,
        )
        const tarifaDescontadaMes = tarifaDescontadaCalc(
          simulationState.tarifaCheia,
          simulationState.desconto,
          simulationState.inflacaoAa,
          mes,
          simulationState.mesReajuste,
          simulationState.mesReferencia,
        )
        const aplicaTaxaMinimaNoMes = aplicaTaxaMinima || mes > contratoMeses
        const encargosFixosAplicados = aplicaTaxaMinimaNoMes ? encargosFixos : 0
        const taxaMinimaMes = calcularTaxaMinima(tipoRede, tarifaCheiaMes)
        const taxaMinimaAplicada = aplicaTaxaMinimaNoMes
          ? Math.max(0, taxaMinima) > 0
            ? Math.max(0, taxaMinima)
            : taxaMinimaMes
          : 0
        const cidAplicado = aplicaTaxaMinimaNoMes ? simulationState.cidKwhBase * tarifaCheiaMes : 0
        const custoSemSistemaMes =
          kcKwhMes * tarifaCheiaMes + encargosFixosAplicados + taxaMinimaAplicada + cidAplicado
        const dentroPrazoMes = contratoMeses > 0 ? mes <= contratoMeses : false
        const custoComSistemaEnergiaMes = dentroPrazoMes ? kcKwhMes * tarifaDescontadaMes : 0
        const custoComSistemaBaseMes =
          custoComSistemaEnergiaMes + encargosFixosAplicados + taxaMinimaAplicada + cidAplicado
        const tusdMes = aplicaTaxaMinimaNoMes
          ? calcTusdEncargoMensal({
              consumoMensal_kWh: kcKwhMes,
              tarifaCheia_R_kWh: tarifaCheiaMes,
              mes,
              anoReferencia: tusdAnoAtual,
              tipoCliente: tusdTipoAtual,
              subTipo: tusdSubtipoAtual,
              pesoTUSD: tusdPercentAtual,
              tusd_R_kWh: tusdTarifaAtual,
              simultaneidadePadrao: tusdSimAtual,
            })
          : 0
        economiaEnergia += custoSemSistemaMes - (custoComSistemaBaseMes + tusdMes)
      }

      const dentroPrazoLeasing = prazoLeasingValido ? ano <= leasingPrazoConsiderado : false
      const beneficioOpex = dentroPrazoLeasing ? economiaOpexAnual : 0
      const beneficioInvestimento = dentroPrazoLeasing ? investimentoDiluirAnual : 0
      return economiaEnergia + beneficioOpex + beneficioInvestimento
    })
  }, [
    encargosFixos,
    kcKwhMes,
    leasingPrazoConsiderado,
    simulationState.desconto,
    simulationState.inflacaoAa,
    simulationState.mesReajuste,
    simulationState.mesReferencia,
    simulationState.tarifaCheia,
    taxaMinima,
    capexSolarInvest,
  ])

  const leasingROI = useMemo(() => {
    const acc: number[] = []
    let acumulado = 0
    leasingBeneficios.forEach((beneficio) => {
      acumulado += beneficio
      acc.push(acumulado)
    })
    return acc
  }, [leasingBeneficios])

  const taxaMensalFin = useMemo(() => Math.pow(1 + jurosFinAa / 100, 1 / 12) - 1, [jurosFinAa])
  const entradaFin = useMemo(() => (capex * entradaFinPct) / 100, [capex, entradaFinPct])
  const valorFinanciado = useMemo(() => Math.max(0, capex - entradaFin), [capex, entradaFin])
  const pmt = useMemo(() => {
    if (valorFinanciado === 0) return 0
    if (prazoFinMeses <= 0) return 0
    if (taxaMensalFin === 0) return -(valorFinanciado / prazoFinMeses)
    const fator = Math.pow(1 + taxaMensalFin, prazoFinMeses)
    return -valorFinanciado * (taxaMensalFin * fator) / (fator - 1)
  }, [valorFinanciado, taxaMensalFin, prazoFinMeses])

  const custoOeM = (ano: number) => potenciaInstaladaKwp * oemBase * Math.pow(1 + oemInflacao / 100, ano - 1)
  const custoSeguro = (ano: number) => {
    if (seguroModo === 'A') {
      return potenciaInstaladaKwp * seguroValorA * Math.pow(1 + seguroReajuste / 100, ano - 1)
    }
    return vm0 * (seguroPercentualB / 100) * Math.pow(1 + seguroReajuste / 100, ano - 1)
  }

  const financiamentoFluxo = useMemo(() => {
    return Array.from({ length: ANALISE_ANOS_PADRAO }, (_, i) => {
      const ano = i + 1
      const _economia = 12 * kcKwhMes * tarifaAno(ano)
      const taxaMinimaAno = Math.max(0, taxaMinima) > 0
        ? Math.max(0, taxaMinima)
        : calcularTaxaMinima(tipoRede, tarifaAno(ano))
      const custoSemSistemaMensal = Math.max(kcKwhMes * tarifaAno(ano), taxaMinimaAno)
      const economiaAnual = 12 * Math.max(custoSemSistemaMensal - taxaMinimaAno, 0)
      const inicioAno = (ano - 1) * 12
      const mesesRestantes = Math.max(0, prazoFinMeses - inicioAno)
      const mesesPagos = Math.min(12, mesesRestantes)
      const custoParcela = mesesPagos * Math.abs(pmt)
      const despesasSistema = custoParcela + custoOeM(ano) + custoSeguro(ano)
      return economiaAnual - despesasSistema
    })
  }, [kcKwhMes, inflacaoAa, jurosFinAa, oemBase, oemInflacao, pmt, prazoFinMeses, seguroModo, seguroPercentualB, seguroReajuste, seguroValorA, tarifaCheia, taxaMinima, vm0, potenciaInstaladaKwp])

  const financiamentoROI = useMemo(() => {
    const valores: number[] = []
    let acumulado = -entradaFin
    financiamentoFluxo.forEach((fluxo) => {
      acumulado += fluxo
      valores.push(acumulado)
    })
    return valores
  }, [entradaFin, financiamentoFluxo])

  const financiamentoMensalidades = useMemo(() => {
    const mesesValidos = Math.max(0, prazoFinMeses)
    const anos = Math.ceil(mesesValidos / 12)
    return Array.from({ length: anos }, () => Math.abs(pmt))
  }, [pmt, prazoFinMeses])

  const parcelasSolarInvest = useMemo(() => {
    const lista: MensalidadeRow[] = []
    let totalAcumulado = 0
    const kcContratado =
      simulationState.modoEntrada === 'REDUZ'
        ? kcAjustado
        : Math.max(0, simulationState.kcKwhMes)
    const leasingAtivo = kcContratado > 0
    const aplicaTaxaMinima = simulationState.aplicaTaxaMinima ?? true
    const margemMinimaBase = aplicaTaxaMinima
      ? Math.max(0, simulationState.taxaMinima) + Math.max(0, simulationState.encargosFixos)
      : 0
    const manutencaoPrevencaoSeguroMensal =
      leasingAtivo ? Math.max(0, (simulationState.vm0 * 0.015) / 12) : 0
    const limiteMeses = Math.max(0, Math.floor(leasingPrazoConsiderado * 12))
    const mesesConsiderados = limiteMeses > 0 ? Math.min(mensalidades.length, limiteMeses) : mensalidades.length

    for (let index = 0; index < mesesConsiderados; index += 1) {
      const mensalidade = mensalidades[index]!
      const mes = index + 1
      const tarifaCheiaMes = tarifaProjetadaCheia(
        simulationState.tarifaCheia,
        simulationState.inflacaoAa,
        mes,
        simulationState.mesReajuste,
        simulationState.mesReferencia,
      )
      const tarifaDescontadaMes = selectTarifaDescontada(simulationState, mes)
      const energiaCheia = leasingAtivo ? Math.max(0, kcContratado * tarifaCheiaMes) : 0
      const cidMensal = aplicaTaxaMinima ? Math.max(0, simulationState.cidKwhBase) * tarifaCheiaMes : 0
      const margemMinima = margemMinimaBase + cidMensal
      const mensalidadeCheia = Number(
        Math.max(0, energiaCheia + margemMinima + manutencaoPrevencaoSeguroMensal).toFixed(2),
      )
      const tusdMensal = aplicaTaxaMinima
        ? calcTusdEncargoMensal({
            consumoMensal_kWh: kcContratado,
            tarifaCheia_R_kWh: tarifaCheiaMes,
            mes,
            anoReferencia: simulationState.tusdAnoReferencia ?? null,
            tipoCliente: simulationState.tusdTipoCliente ?? null,
            subTipo: simulationState.tusdSubtipo ?? null,
            pesoTUSD: simulationState.tusdPercent ?? null,
            tusd_R_kWh: simulationState.tusdTarifaRkwh ?? null,
            simultaneidadePadrao: simulationState.tusdSimultaneidade ?? null,
          })
        : 0
      const tusdValor = Number(Math.max(0, tusdMensal).toFixed(2))
      totalAcumulado += mensalidade
      lista.push({
        mes,
        tarifaCheia: tarifaCheiaMes,
        tarifaDescontada: tarifaDescontadaMes,
        mensalidadeCheia,
        tusd: tusdValor,
        mensalidade: Number(mensalidade.toFixed(2)),
        totalAcumulado: Number(totalAcumulado.toFixed(2)),
      })
    }

    const tarifaPrimeiroMes = tarifaProjetadaCheia(
      simulationState.tarifaCheia,
      simulationState.inflacaoAa,
      1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )
    const margemMinimaResumo = aplicaTaxaMinima
      ? margemMinimaBase + simulationState.cidKwhBase * tarifaPrimeiroMes
      : 0

    return {
      lista,
      tarifaDescontadaBase: selectTarifaDescontada(simulationState, 1),
      kcAjustado,
      creditoMensal: creditoEntradaMensal,
      margemMinima: margemMinimaResumo,
      prazoEfetivo: mesesConsiderados,
      totalPago: lista.length > 0 ? lista[lista.length - 1]!.totalAcumulado : 0,
      inflacaoMensal,
    }
  }, [
    creditoEntradaMensal,
    inflacaoMensal,
    kcAjustado,
    mensalidades,
    leasingPrazoConsiderado,
    simulationState,
  ])

  const leasingMensalidades = useMemo(() => {
    if (leasingPrazoConsiderado <= 0) {
      return []
    }
    if (mensalidadesPorAno.length === 0) {
      return []
    }

    return Array.from({ length: leasingPrazoConsiderado }, (_, index) => {
      const valor = mensalidadesPorAno[index]
      if (typeof valor === 'number') {
        return valor
      }
      const ultimo = mensalidadesPorAno[mensalidadesPorAno.length - 1]
      return typeof ultimo === 'number' ? ultimo : 0
    })
  }, [leasingPrazoConsiderado, mensalidadesPorAno])

  const tabelaBuyout = useMemo<BuyoutRow[]>(() => {
    const horizonte = Math.max(60, Math.floor(simulationState.duracaoMeses))
    const linhasPorMes = new Map<number, BuyoutLinha>()
    buyoutLinhas.forEach((linha) => {
      linhasPorMes.set(linha.mes, linha)
    })

    const rows: BuyoutRow[] = []
    let ultimoCashback = 0
    let ultimoPrestacao = 0
    for (let mes = 1; mes <= horizonte; mes += 1) {
      const linha = linhasPorMes.get(mes)
      if (linha) {
        ultimoCashback = linha.cashback
        ultimoPrestacao = linha.prestacaoAcum
        rows.push({
          mes,
          tarifa: linha.tarifaCheia,
          prestacaoEfetiva: linha.prestacaoEfetiva,
          prestacaoAcum: linha.prestacaoAcum,
          cashback: linha.cashback,
          valorResidual: mes >= 7 && mes <= Math.floor(simulationState.duracaoMeses) ? linha.valorResidual : null,
        })
      } else {
        const fator = Math.pow(1 + inflacaoMensal, Math.max(0, mes - 1))
        const tarifaProjetada = simulationState.tarifaCheia * fator
        rows.push({
          mes,
          tarifa: tarifaProjetada,
          prestacaoEfetiva: 0,
          prestacaoAcum: ultimoPrestacao,
          cashback: ultimoCashback,
          valorResidual: null,
        })
      }
    }

    const mesAceiteFinal = Math.floor(simulationState.duracaoMeses) + 1
    const tarifaAceite = simulationState.tarifaCheia * Math.pow(1 + inflacaoMensal, Math.max(0, mesAceiteFinal - 1))
    rows.push({
      mes: mesAceiteFinal,
      tarifa: tarifaAceite,
      prestacaoEfetiva: 0,
      prestacaoAcum: ultimoPrestacao,
      cashback: ultimoCashback,
      valorResidual: 0,
    })

    return rows
  }, [buyoutLinhas, inflacaoMensal, simulationState])

  const duracaoMesesNormalizada = Math.max(0, Math.floor(duracaoMeses))
  const buyoutMesAceiteFinal = duracaoMesesNormalizada + 1
  const duracaoMesesExibicao = Math.max(7, buyoutMesAceiteFinal)
  const buyoutAceiteFinal = tabelaBuyout.find((row) => row.mes === buyoutMesAceiteFinal)
  const buyoutReceitaRows = useMemo(
    () => tabelaBuyout.filter((row) => row.mes >= 7 && row.mes <= duracaoMesesNormalizada),
    [tabelaBuyout, duracaoMesesNormalizada],
  )

  const buyoutResumo: BuyoutResumo = {
    // valorBaseOriginalAtivo = vm0 = Preço ideal da Análise Financeira (custoFinalProjetadoCanonico).
    // É o valor-base/original do ativo no início do contrato — não é mensalidade nem CAPEX do PDF.
    valorBaseOriginalAtivo: vm0,
    vm0, // @deprecated: alias de compatibilidade com snapshots antigos
    depreciacaoPct: depreciacaoAa,
    infEnergia: inflacaoAa,
    ipca: ipcaAa,
    duracao: duracaoMeses,
  }

  const anosArray = useMemo(
    () => Array.from({ length: ANALISE_ANOS_PADRAO }, (_, i) => i + 1),
    [],
  )

  const vendaRetornoAuto = useMemo(() => {
    if (!isVendaDiretaTab) {
      return null
    }
    if (retornoProjetado) {
      return retornoProjetado
    }
    const errors = validateVendaForm(vendaForm)
    if (Object.keys(errors).length > 0) {
      return null
    }
    try {
      return computeROI(vendaForm)
    } catch (error) {
      console.warn('Não foi possível calcular o retorno para impressão.', error)
      return null
    }
  }, [isVendaDiretaTab, retornoProjetado, validateVendaForm, vendaForm])

  const economiaEstimativaValorCalculado = useMemo(() => {
    if (!isVendaDiretaTab) {
      return null
    }
    if (!vendaRetornoAuto || !Array.isArray(vendaRetornoAuto.economia)) {
      return null
    }
    const horizonteMeses = Math.max(1, ECONOMIA_ESTIMATIVA_PADRAO_ANOS * 12)
    const valores = vendaRetornoAuto.economia.slice(0, horizonteMeses)
    const total = valores.reduce((acc, valor) => acc + Math.max(0, Number(valor ?? 0)), 0)
    if (!Number.isFinite(total) || total <= 0) {
      return null
    }
    return total
  }, [isVendaDiretaTab, vendaRetornoAuto])

  useEffect(() => {
    if (!isVendaDiretaTab) {
      vendaActions.updateResumoProposta({
        economia_estimativa_valor: null,
        economia_estimativa_horizonte_anos: null,
      })
      return
    }
    vendaActions.updateResumoProposta({
      economia_estimativa_valor: economiaEstimativaValorCalculado,
      economia_estimativa_horizonte_anos:
        economiaEstimativaValorCalculado != null ? ECONOMIA_ESTIMATIVA_PADRAO_ANOS : null,
    })
  }, [economiaEstimativaValorCalculado, isVendaDiretaTab, recalcularTick])

  const printableData = useMemo<PrintableProposalProps>(
    () => buildPrintableData({
      vendaSnapshot: getVendaSnapshot(),
      cliente,
      currentBudgetId,
      isVendaDiretaTab,
      potenciaInstaladaKwp,
      geracaoMensalKwh,
      numeroModulosEstimado,
      potenciaModulo,
      tipoSistema,
      tipoRede,
      segmentoCliente,
      tipoInstalacao,
      tipoInstalacaoOutro,
      tipoEdificacaoOutro,
      tusdTipoCliente,
      tusdSubtipo,
      areaInstalacao,
      capex,
      descontoConsiderado,
      kcKwhMes,
      tarifaCheia,
      distribuidoraAneelEfetiva,
      valorOrcamentoConsiderado,
      valorVendaTelhado,
      valorVendaSolo,
      margemManualAtiva,
      margemManualValor,
      descontosValor,
      arredondarPasso,
      valorTotalPropostaNormalizado,
      valorTotalPropostaState,
      custoImplantacaoReferencia,
      parcelasSolarInvest,
      leasingPrazoConsiderado,
      leasingValorDeMercadoEstimado,
      mostrarValorMercadoLeasing,
      inflacaoAa,
      leasingContrato,
      leasingROI,
      financiamentoFluxo,
      financiamentoROI,
      mostrarFinanciamento,
      tabelaBuyout,
      buyoutResumo,
      composicaoTelhado,
      composicaoSolo,
      composicaoTelhadoTotal,
      composicaoSoloTotal,
      composicaoTelhadoCalculo,
      composicaoSoloCalculo,
      vendasConfig,
      vendaForm,
      vendaRetornoAuto,
      parsedVendaPdf,
      multiUcPrintableResumo,
      ucsBeneficiarias,
      budgetStructuredItems,
      propostaImagens,
      configuracaoUsinaObservacoes,
      modoOrcamento,
      autoCustoFinal,
      anosArray,
    }),
    [
      composicaoSolo,
      composicaoSoloTotal,
      composicaoTelhado,
      composicaoTelhadoTotal,
      composicaoSoloCalculo,
      composicaoTelhadoCalculo,
      vendasConfig.comissao_default_tipo,
      vendasConfig.comissao_percent_base,
      vendasConfig.teto_comissao_percent,
      vendasConfig.margem_operacional_padrao_percent,
      vendasConfig.preco_minimo_percent_sobre_capex,
      vendasConfig.desconto_max_percent_sem_aprovacao,
      vendasConfig.workflow_aprovacao_ativo,
      vendasConfig.regime_tributario_default,
      vendasConfig.imposto_retido_aliquota_default,
      vendasConfig.impostosRegime_overrides,
      vendasConfig.incluirImpostosNoCAPEX_default,
      vendasConfig.exibir_precos_unitarios,
      vendasConfig.exibir_margem,
      vendasConfig.exibir_comissao,
      vendasConfig.exibir_impostos,
      vendasConfig.mostrar_quebra_impostos_no_pdf_cliente,
      vendasConfig.observacao_padrao_proposta,
      margemManualAtiva,
      margemManualValor,
      descontosValor,
      arredondarPasso,
      areaInstalacao,
      currentBudgetId,
      anosArray,
      buyoutResumo,
      capex,
      custoFinalProjetadoCanonico,
      cliente,
      descontoConsiderado,
      financiamentoFluxo,
      financiamentoROI,
      geracaoMensalKwh,
      kcKwhMes,
      leasingROI,
      mostrarFinanciamento,
      numeroModulosEstimado,
      parcelasSolarInvest,
      duracaoMeses,
      distribuidoraAneelEfetiva,
      tipoInstalacao,
      tipoInstalacaoOutro,
      tipoSistema,
      segmentoCliente,
      tusdSubtipo,
      tusdTipoCliente,
      valorOrcamentoConsiderado,
      valorVendaSolo,
      valorVendaTelhado,
      potenciaInstaladaKwp,
      potenciaModulo,
      tabelaBuyout,
      tarifaCheia,
      inflacaoAa,
      isVendaDiretaTab,
      vendaForm,
      vendaRetornoAuto,
      parsedVendaPdf,
      budgetStructuredItems,
      leasingValorDeMercadoEstimado,
      multiUcPrintableResumo,
      valorTotalPropostaNormalizado,
      valorTotalPropostaState,
      custoImplantacaoReferencia,
      propostaImagens,
      configuracaoUsinaObservacoes,
      ucsBeneficiarias,
      vendaSnapshotSignal,
      leasingSnapshotSignal,
      leasingContrato,
    ],
  )

  return {
    simulationState,
    vm0,
    inflacaoMensal,
    mensalidades,
    mensalidadesPorAno,
    creditoEntradaMensal,
    kcAjustado,
    buyoutLinhas,
    leasingBeneficios,
    leasingROI,
    taxaMensalFin,
    entradaFin,
    valorFinanciado,
    pmt,
    financiamentoFluxo,
    financiamentoROI,
    financiamentoMensalidades,
    parcelasSolarInvest,
    leasingMensalidades,
    tabelaBuyout,
    buyoutResumo,
    buyoutAceiteFinal,
    buyoutReceitaRows,
    duracaoMesesNormalizada,
    buyoutMesAceiteFinal,
    duracaoMesesExibicao,
    anosArray,
    vendaRetornoAuto,
    economiaEstimativaValorCalculado,
    printableData,
  }
}
