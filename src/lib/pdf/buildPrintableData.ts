/**
 * Pure helper for constructing PrintableProposalProps from App state.
 *
 * Extracted from the `printableData` useMemo in App.tsx as part of PR33.
 * No side-effects on application state.
 */
import type { Outputs as ComposicaoCalculo, ArredondarPasso } from '../venda/calcComposicaoUFV'
import { calculateCapexFromState } from '../../store/useVendaStore'
import type { VendaSnapshot } from '../../store/useVendaStore'
import type { LeasingContratoDados } from '../../store/useLeasingStore'
import { getPotenciaModuloW, type PropostaState } from '../selectors/proposta'
import { normalizeProposalId } from '../ids'
import { mapTipoBasicoToLabel, normalizeTipoBasico } from '../../types/tipoBasico'
import { toNumberSafe } from '../../utils/vendasHelpers'
import { formatUcGeradoraTitularEndereco } from '../../utils/formatters'
import { TIPOS_INSTALACAO } from '../../constants/instalacao'
import type {
  BuyoutResumo,
  BuyoutRow,
  MensalidadeRow,
  PrintableProposalImage,
  PrintableProposalProps,
  PrintableUcBeneficiaria,
  PrintableUcGeradora,
  PrintableUcGeradoraTitular,
  TipoInstalacao,
  UfvComposicaoConfiguracao,
  UfvComposicaoResumo,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
} from '../../types/printableProposal'
import type { SegmentoCliente, TipoSistema, VendaForm } from '../../lib/finance/roi'
import type { RetornoProjetado } from '../../lib/finance/roi'
import type { TipoClienteTUSD } from '../../lib/finance/tusd'
import type { TipoRede } from '../../shared/rede'
import type { VendasConfig } from '../../types/vendasConfig'
import type { UcBeneficiariaFormState } from '../../types/ucBeneficiaria'
import type { ParsedVendaPdfData } from '../pdf/extractVendas'
import type { PrintableMultiUcResumo } from '../../types/printableProposal'
import type { StructuredItem } from '../../utils/structuredBudgetParser'

// ── Local helpers (private, mirrors App.tsx module-level helpers) ────────────

const TIPO_SISTEMA_VALUES: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID'] as const

function normalizeTipoSistemaValue(value: unknown): TipoSistema | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const canonical = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
    return TIPO_SISTEMA_VALUES.includes(canonical as TipoSistema)
      ? (canonical as TipoSistema)
      : undefined
  }
  if (value == null) return undefined
  if (typeof value === 'number' || typeof value === 'boolean') {
    return normalizeTipoSistemaValue(String(value))
  }
  return undefined
}

function normalizeSegmentoClienteValue(value: unknown): SegmentoCliente | undefined {
  if (typeof value === 'string' || value == null) {
    return normalizeTipoBasico(value as string | null)
  }
  return undefined
}

function mapTipoToLabel(value: string, lista: { value: string; label: string }[]): string {
  const item = lista.find((el) => el.value === value)
  return item ? item.label : 'Outros (texto)'
}

// ── Types ────────────────────────────────────────────────────────────────────

type ParcelasSolarInvest = {
  lista: MensalidadeRow[]
}

export interface BuildPrintableDataParams {
  // Snapshot (computed by caller via getVendaSnapshot before calling)
  vendaSnapshot: VendaSnapshot

  // Client
  cliente: PrintableProposalProps['cliente']

  // Ids / budget
  currentBudgetId: string | null

  // Tab state
  isVendaDiretaTab: boolean

  // System technical params
  potenciaInstaladaKwp: number
  geracaoMensalKwh: number
  numeroModulosEstimado: number
  potenciaModulo: number
  tipoSistema: TipoSistema
  tipoRede: TipoRede
  segmentoCliente: SegmentoCliente
  tipoInstalacao: TipoInstalacao
  tipoInstalacaoOutro: string
  tipoEdificacaoOutro: string
  tusdTipoCliente: TipoClienteTUSD | null
  tusdSubtipo: string
  areaInstalacao: number

  // Financials / pricing
  capex: number
  descontoConsiderado: number
  kcKwhMes: number
  tarifaCheia: number
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

  // Leasing specific
  parcelasSolarInvest: ParcelasSolarInvest
  leasingPrazoConsiderado: number
  leasingValorDeMercadoEstimado: number
  mostrarValorMercadoLeasing: boolean
  inflacaoAa: number
  leasingContrato: LeasingContratoDados

  // ROI / flows
  leasingROI: PrintableProposalProps['leasingROI']
  financiamentoFluxo: PrintableProposalProps['financiamentoFluxo']
  financiamentoROI: PrintableProposalProps['financiamentoROI']
  mostrarFinanciamento: boolean
  tabelaBuyout: BuyoutRow[]
  buyoutResumo: BuyoutResumo

  // Composition
  composicaoTelhado: UfvComposicaoTelhadoValores
  composicaoSolo: UfvComposicaoSoloValores
  composicaoTelhadoTotal: number
  composicaoSoloTotal: number
  composicaoTelhadoCalculo: ComposicaoCalculo | null | undefined
  composicaoSoloCalculo: ComposicaoCalculo | null | undefined

  // Config
  vendasConfig: VendasConfig

  // Venda
  vendaForm: VendaForm
  vendaRetornoAuto: RetornoProjetado | null
  parsedVendaPdf: ParsedVendaPdfData | null

  // Multi-UC
  multiUcPrintableResumo: PrintableMultiUcResumo | null
  ucsBeneficiarias: UcBeneficiariaFormState[]

  // Budget items
  budgetStructuredItems: StructuredItem[]

  // Miscellaneous
  propostaImagens: PrintableProposalImage[]
  configuracaoUsinaObservacoes: string
  modoOrcamento: 'auto' | 'manual'
  autoCustoFinal: number | null | undefined

  // Aggregated computed values
  anosArray: number[]
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildPrintableData(params: BuildPrintableDataParams): PrintableProposalProps {
  const {
    vendaSnapshot,
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
  } = params

  const capexFromStore = calculateCapexFromState(vendaSnapshot)
  const capexPrintable = capexFromStore > 0 ? capexFromStore : capex

  const potenciaInstaladaSnapshot = vendaSnapshot.configuracao.potencia_sistema_kwp
  const potenciaInstaladaPrintable = isVendaDiretaTab
    ? potenciaInstaladaSnapshot > 0
      ? potenciaInstaladaSnapshot
      : Number.isFinite(vendaForm.potencia_instalada_kwp)
      ? Number(vendaForm.potencia_instalada_kwp)
      : potenciaInstaladaKwp
    : potenciaInstaladaKwp

  const geracaoMensalSnapshot = vendaSnapshot.configuracao.geracao_estimada_kwh_mes
  const geracaoMensalPrintable = isVendaDiretaTab
    ? geracaoMensalSnapshot > 0
      ? geracaoMensalSnapshot
      : Number.isFinite(vendaForm.geracao_estimada_kwh_mes)
      ? Number(vendaForm.geracao_estimada_kwh_mes)
      : geracaoMensalKwh
    : geracaoMensalKwh

  const numeroModulosSnapshot = vendaSnapshot.configuracao.n_modulos
  const numeroModulosPrintable = isVendaDiretaTab
    ? numeroModulosSnapshot > 0
      ? numeroModulosSnapshot
      : Number.isFinite(vendaForm.quantidade_modulos)
      ? Math.max(0, Number(vendaForm.quantidade_modulos))
      : numeroModulosEstimado
    : numeroModulosEstimado

  const potenciaSnapshotState: PropostaState = {
    orcamento: {
      modulo: { potenciaW: vendaSnapshot.configuracao.potencia_modulo_wp },
    },
  }
  const potenciaAtualState: PropostaState = {
    orcamento: { modulo: { potenciaW: potenciaModulo } },
  }
  const potenciaModuloSnapshot = getPotenciaModuloW(potenciaSnapshotState)
  const potenciaModuloAtual = getPotenciaModuloW(potenciaAtualState)
  const potenciaModuloPrintable = isVendaDiretaTab
    ? potenciaModuloSnapshot > 0
      ? potenciaModuloSnapshot
      : potenciaModuloAtual
    : potenciaModuloAtual

  const tipoSistemaSnapshot = normalizeTipoSistemaValue(vendaSnapshot.configuracao.tipo_sistema)
  const tipoSistemaFromForm = isVendaDiretaTab
    ? normalizeTipoSistemaValue(vendaForm.tipo_sistema)
    : undefined
  const tipoSistemaPrintable = tipoSistemaSnapshot ?? tipoSistemaFromForm ?? tipoSistema

  const segmentoSnapshot = normalizeSegmentoClienteValue(vendaSnapshot.configuracao.segmento)
  const segmentoFromForm = isVendaDiretaTab
    ? normalizeSegmentoClienteValue(vendaForm.segmento_cliente)
    : undefined
  const segmentoPrintable = segmentoSnapshot ?? segmentoFromForm ?? segmentoCliente

  const vendaResumo = isVendaDiretaTab
    ? {
        form: { ...vendaForm },
        retorno: vendaRetornoAuto,
      }
    : undefined

  const sanitizedBudgetId = normalizeProposalId(currentBudgetId)

  const sanitizeItemText = (valor?: string | null) => {
    const trimmed = valor?.toString().trim() ?? ''
    return trimmed && trimmed !== '—' ? trimmed : undefined
  }

  const printableBudgetItems = budgetStructuredItems.map((item) => ({
    produto: sanitizeItemText(item.produto) ?? '',
    descricao: sanitizeItemText(item.descricao) ?? '',
    codigo: sanitizeItemText(item.codigo),
    modelo: sanitizeItemText(item.modelo),
    fabricante: sanitizeItemText(item.fabricante),
    quantidade: Number.isFinite(item.quantidade) ? Number(item.quantidade) : null,
    valorUnitario: Number.isFinite(item.precoUnitario) ? Number(item.precoUnitario) : null,
    valorTotal: Number.isFinite(item.precoTotal) ? Number(item.precoTotal) : null,
  }))

  const composicaoConfiguracaoResumo: UfvComposicaoConfiguracao = {
    comissaoTipo: vendasConfig.comissao_default_tipo,
    comissaoBase: vendasConfig.comissao_percent_base,
    margemPadraoPercent: vendasConfig.margem_operacional_padrao_percent,
    margemManualValor: margemManualAtiva && margemManualValor !== undefined ? margemManualValor : null,
    margemManualAtiva,
    descontos: toNumberSafe(descontosValor),
    regime: vendasConfig.regime_tributario_default,
    impostoRetidoAliquota: toNumberSafe(vendasConfig.imposto_retido_aliquota_default),
    incluirImpostosNoCapex: vendasConfig.incluirImpostosNoCAPEX_default,
    precoMinimoPercent: vendasConfig.preco_minimo_percent_sobre_capex,
    arredondarPasso: arredondarPasso,
  }

  const composicaoResumo: UfvComposicaoResumo = {
    telhado: { ...composicaoTelhado },
    solo: { ...composicaoSolo },
    totalTelhado: composicaoTelhadoTotal,
    totalSolo: composicaoSoloTotal,
    valorOrcamento: valorOrcamentoConsiderado,
    valorVendaTelhado,
    valorVendaSolo,
    tipoAtual: tipoInstalacao,
    calculoTelhado: composicaoTelhadoCalculo
      ? {
          ...composicaoTelhadoCalculo,
          regime_breakdown: composicaoTelhadoCalculo.regime_breakdown.map((item) => ({ ...item })),
        }
      : undefined,
    calculoSolo: composicaoSoloCalculo
      ? {
          ...composicaoSoloCalculo,
          regime_breakdown: composicaoSoloCalculo.regime_breakdown.map((item) => ({ ...item })),
        }
      : undefined,
    configuracao: composicaoConfiguracaoResumo,
  }

  const printableVendasConfig = {
    exibir_precos_unitarios: vendasConfig.exibir_precos_unitarios,
    exibir_margem: vendasConfig.exibir_margem,
    exibir_comissao: vendasConfig.exibir_comissao,
    exibir_impostos: vendasConfig.exibir_impostos,
    mostrar_quebra_impostos_no_pdf_cliente: vendasConfig.mostrar_quebra_impostos_no_pdf_cliente,
    observacao_padrao_proposta: vendasConfig.observacao_padrao_proposta,
    validade_proposta_dias: vendasConfig.validade_proposta_dias,
  }

  const sanitizeNonNegativeNumber = (value: unknown): number | null =>
    Number.isFinite(value) ? Math.max(0, Number(value)) : null

  const sanitizeText = (value?: string | null): string | null => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  const tarifaCheiaAtual = sanitizeNonNegativeNumber(tarifaCheia)
  const tarifaFormulario = sanitizeNonNegativeNumber(vendaForm.tarifa_cheia_r_kwh)
  const tarifaSnapshot = sanitizeNonNegativeNumber(vendaSnapshot.parametros.tarifa_r_kwh)

  const energiaContratadaAtual = sanitizeNonNegativeNumber(kcKwhMes)
  const energiaContratadaSnapshotResultado = sanitizeNonNegativeNumber(
    vendaSnapshot.resultados.energia_contratada_kwh_mes,
  )
  const energiaContratadaSnapshotParametro = sanitizeNonNegativeNumber(
    vendaSnapshot.parametros.consumo_kwh_mes,
  )

  const distribuidoraAtual = sanitizeText(distribuidoraAneelEfetiva)
  const clienteDistribuidoraAtual = sanitizeText(cliente.distribuidora)
  const distribuidoraSnapshot = sanitizeText(vendaSnapshot.parametros.distribuidora)

  const formatClienteEnderecoCompleto = (): string => {
    const enderecoPrincipal = sanitizeText(cliente.endereco)
    const cidade = sanitizeText(cliente.cidade)
    const uf = sanitizeText(cliente.uf)
    const cep = sanitizeText(cliente.cep)
    const partes: string[] = []
    if (enderecoPrincipal) partes.push(enderecoPrincipal)
    if (cidade || uf) {
      if (cidade && uf) {
        partes.push(`${cidade} / ${uf}`)
      } else if (cidade) {
        partes.push(cidade)
      } else if (uf) {
        partes.push(uf)
      }
    }
    if (cep) partes.push(`CEP ${cep}`)
    return partes.join(' • ')
  }

  const ucGeradoraTitularAtivo =
    !isVendaDiretaTab &&
    leasingContrato.ucGeradoraTitularDiferente &&
    Boolean(leasingContrato.ucGeradoraTitular)
  const ucGeradoraTitularEndereco = ucGeradoraTitularAtivo
    ? sanitizeText(formatUcGeradoraTitularEndereco(leasingContrato.ucGeradoraTitular?.endereco))
    : null
  const ucGeradoraTitularPrintable: PrintableUcGeradoraTitular | null = ucGeradoraTitularAtivo
    ? {
        nomeCompleto: sanitizeText(leasingContrato.ucGeradoraTitular?.nomeCompleto) ?? '',
        cpf: sanitizeText(leasingContrato.ucGeradoraTitular?.cpf) ?? '',
        rg: sanitizeText(leasingContrato.ucGeradoraTitular?.rg) ?? '',
        endereco: ucGeradoraTitularEndereco ?? '',
      }
    : null
  const ucGeradoraNumero = sanitizeText(cliente.uc) ?? ''
  const ucGeradoraEndereco = ucGeradoraTitularEndereco ?? formatClienteEnderecoCompleto()
  const ucGeradoraPrintable: PrintableUcGeradora | null =
    ucGeradoraNumero || ucGeradoraEndereco
      ? { numero: ucGeradoraNumero, endereco: ucGeradoraEndereco }
      : null

  const normalizeRateioPercent = (valor: string): number | null => {
    if (typeof valor !== 'string') return null
    const trimmed = valor.trim()
    if (!trimmed) return null
    const normalized = trimmed.replace(/%/g, '').replace(',', '.')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }

  const normalizeConsumoKWh = (valor: string): number | null => {
    if (typeof valor !== 'string') return null
    const trimmed = valor.trim()
    if (!trimmed) return null
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }

  const ucsBeneficiariasPrintable: PrintableUcBeneficiaria[] = (ucsBeneficiarias
    .map((item) => {
      const numero = sanitizeText(item.numero) ?? ''
      const endereco = sanitizeText(item.endereco) ?? ''
      const rateio = normalizeRateioPercent(item.rateioPercentual)
      const consumo = normalizeConsumoKWh(item.consumoKWh)
      if (!numero && !endereco && rateio == null && consumo == null) {
        return null
      }
      return {
        numero,
        endereco,
        consumoKWh: consumo,
        rateioPercentual: rateio,
      }
    })
    .filter(Boolean) as PrintableUcBeneficiaria[])

  const tipoEdificacaoCodigo = segmentoPrintable ?? null
  const tipoEdificacaoLabel =
    segmentoPrintable != null ? mapTipoBasicoToLabel(segmentoPrintable) : null
  const tipoEdificacaoOutroPrintable =
    segmentoPrintable === 'outros' ? tipoEdificacaoOutro.trim() || null : null
  const tusdTipoClienteCodigo = tusdTipoCliente ?? null
  const tusdTipoClienteLabel = tusdTipoCliente ? mapTipoBasicoToLabel(tusdTipoCliente) : null
  const tusdTipoClienteOutro = tusdTipoCliente === 'outros' ? tusdSubtipo || null : null

  const formatOutroDescricao = (
    codigo: string | null | undefined,
    outro: string | null | undefined,
    label: string | null | undefined,
  ) => {
    if (codigo === 'outros') {
      const outroTexto = (outro ?? '').trim()
      return outroTexto ? `Outros (${outroTexto})` : 'Outros'
    }
    return label ?? '—'
  }

  const tipoInstalacaoLabel = mapTipoToLabel(tipoInstalacao, TIPOS_INSTALACAO)
  const tipoInstalacaoOutroTrimmed = tipoInstalacaoOutro.trim()
  const tipoInstalacaoOutroPrintable =
    tipoInstalacao === 'outros' ? tipoInstalacaoOutroTrimmed || null : null
  const tipoInstalacaoCompleto = formatOutroDescricao(
    tipoInstalacao,
    tipoInstalacaoOutroPrintable,
    tipoInstalacaoLabel,
  )
  const tipoEdificacaoCompleto = formatOutroDescricao(
    tipoEdificacaoCodigo,
    tipoEdificacaoOutroPrintable,
    tipoEdificacaoLabel,
  )
  const tusdTipoClienteCompleto = formatOutroDescricao(
    tusdTipoClienteCodigo,
    tusdTipoClienteOutro,
    tusdTipoClienteLabel,
  )

  return {
    cliente,
    budgetId: sanitizedBudgetId,
    anos: anosArray,
    leasingROI,
    financiamentoFluxo,
    financiamentoROI,
    mostrarFinanciamento,
    tabelaBuyout,
    buyoutResumo,
    mostrarTabelaBuyout: true,
    capex: capexPrintable,
    tipoProposta: isVendaDiretaTab ? 'VENDA_DIRETA' : 'LEASING',
    geracaoMensalKwh: geracaoMensalPrintable,
    potenciaModulo: potenciaModuloPrintable,
    numeroModulos: numeroModulosPrintable,
    potenciaInstaladaKwp: potenciaInstaladaPrintable,
    tipoInstalacao,
    tipoInstalacaoCodigo: tipoInstalacao,
    tipoInstalacaoLabel,
    tipoInstalacaoOutro: tipoInstalacaoOutroPrintable,
    tipoInstalacaoCompleto,
    tipoSistema: tipoSistemaPrintable,
    tipoRede,
    segmentoCliente: segmentoPrintable,
    tipoEdificacaoCodigo,
    tipoEdificacaoLabel,
    tipoEdificacaoOutro: tipoEdificacaoOutroPrintable,
    tipoEdificacaoCompleto,
    tusdTipoClienteCodigo,
    tusdTipoClienteLabel,
    tusdTipoClienteOutro,
    tusdTipoClienteCompleto,
    areaInstalacao,
    descontoContratualPct: descontoConsiderado,
    parcelasLeasing: isVendaDiretaTab ? [] : parcelasSolarInvest.lista,
    leasingValorDeMercadoEstimado: isVendaDiretaTab ? null : leasingValorDeMercadoEstimado || 0,
    mostrarValorMercadoLeasing: isVendaDiretaTab ? false : mostrarValorMercadoLeasing,
    leasingPrazoContratualMeses: isVendaDiretaTab
      ? null
      : Math.max(0, Math.round(leasingPrazoConsiderado * 12)),
    leasingValorInstalacaoCliente: isVendaDiretaTab ? null : 0,
    leasingDataInicioOperacao: isVendaDiretaTab ? null : null,
    leasingValorMercadoProjetado: isVendaDiretaTab ? null : buyoutResumo.valorBaseOriginalAtivo,
    leasingInflacaoEnergiaAa: isVendaDiretaTab ? null : inflacaoAa,
    leasingModeloInversor: isVendaDiretaTab
      ? null
      : sanitizeItemText(vendaForm.modelo_inversor) ?? null,
    leasingModeloModulo: isVendaDiretaTab
      ? null
      : sanitizeItemText(vendaForm.modelo_modulo) ?? null,
    distribuidoraTarifa:
      distribuidoraAtual ?? clienteDistribuidoraAtual ?? distribuidoraSnapshot ?? '',
    energiaContratadaKwh:
      energiaContratadaAtual ??
      energiaContratadaSnapshotResultado ??
      energiaContratadaSnapshotParametro ??
      0,
    tarifaCheia:
      tarifaCheiaAtual ??
      tarifaFormulario ??
      tarifaSnapshot ??
      0,
    vendaResumo,
    parsedPdfVenda: parsedVendaPdf ? { ...parsedVendaPdf } : null,
    orcamentoItens: printableBudgetItems,
    composicaoUfv: composicaoResumo,
    vendaSnapshot,
    multiUcResumo: multiUcPrintableResumo,
    vendasConfigSnapshot: printableVendasConfig,
    informacoesImportantesObservacao: vendasConfig.observacao_padrao_proposta,
    configuracaoUsinaObservacoes: configuracaoUsinaObservacoes.trim()
      ? configuracaoUsinaObservacoes.trim()
      : null,
    orcamentoModo: modoOrcamento,
    orcamentoAutoCustoFinal: autoCustoFinal ?? null,
    valorTotalProposta: valorTotalPropostaNormalizado ?? valorTotalPropostaState ?? null,
    custoImplantacaoReferencia: (() => {
      const snapshotValor = Number(vendaSnapshot.resumoProposta.custo_implantacao_referencia ?? 0)
      if (Number.isFinite(snapshotValor) && snapshotValor > 0) {
        return snapshotValor
      }
      const referenciaValor = Number(custoImplantacaoReferencia ?? 0)
      if (Number.isFinite(referenciaValor) && referenciaValor > 0) {
        return referenciaValor
      }
      return null
    })(),
    imagensInstalacao: propostaImagens.map((imagem) => ({ ...imagem })),
    ucGeradora: ucGeradoraPrintable,
    ucGeradoraTitular: ucGeradoraTitularPrintable,
    ucsBeneficiarias: ucsBeneficiariasPrintable,
  }
}

// ── clonePrintableData ───────────────────────────────────────────────────────
// Moved from App.tsx. Used wherever a deep copy of PrintableProposalProps is needed.

export const clonePrintableData = (dados: PrintableProposalProps): PrintableProposalProps => {
  const anos = Array.isArray(dados?.anos) ? dados.anos : []
  const leasingROI = Array.isArray(dados?.leasingROI) ? dados.leasingROI : []
  const financiamentoFluxo = Array.isArray(dados?.financiamentoFluxo) ? dados.financiamentoFluxo : []
  const financiamentoROI = Array.isArray(dados?.financiamentoROI) ? dados.financiamentoROI : []
  const tabelaBuyout = Array.isArray(dados?.tabelaBuyout) ? dados.tabelaBuyout : []
  const parcelasLeasing = Array.isArray(dados?.parcelasLeasing) ? dados.parcelasLeasing : []
  const clone: PrintableProposalProps = {
    ...dados,
    cliente: {
      ...dados.cliente,
      herdeiros: Array.isArray(dados.cliente.herdeiros)
        ? [...dados.cliente.herdeiros]
        : [''],
    },
    anos: [...anos],
    leasingROI: [...leasingROI],
    financiamentoFluxo: [...financiamentoFluxo],
    financiamentoROI: [...financiamentoROI],
    tabelaBuyout: tabelaBuyout.map((row) => ({ ...row })),
    buyoutResumo: { ...dados.buyoutResumo },
    parcelasLeasing: parcelasLeasing.map((row) => ({ ...row })),
  }

  if (dados.budgetId === undefined) {
    delete clone.budgetId
  }

  if (dados.vendaResumo) {
    clone.vendaResumo = {
      form: { ...dados.vendaResumo.form },
      retorno: dados.vendaResumo.retorno
        ? {
            ...dados.vendaResumo.retorno,
            economia: [...dados.vendaResumo.retorno.economia],
            pagamentoMensal: [...dados.vendaResumo.retorno.pagamentoMensal],
            fluxo: [...dados.vendaResumo.retorno.fluxo],
            saldo: [...dados.vendaResumo.retorno.saldo],
          }
        : null,
    }
  } else {
    delete clone.vendaResumo
  }

  if (dados.parsedPdfVenda !== undefined) {
    clone.parsedPdfVenda = dados.parsedPdfVenda ? { ...dados.parsedPdfVenda } : null
  } else {
    delete clone.parsedPdfVenda
  }

  if (dados.orcamentoItens) {
    clone.orcamentoItens = dados.orcamentoItens.map((item) => ({ ...item }))
  } else {
    delete clone.orcamentoItens
  }

  if (dados.composicaoUfv) {
    clone.composicaoUfv = {
      telhado: { ...dados.composicaoUfv.telhado },
      solo: { ...dados.composicaoUfv.solo },
      totalTelhado: dados.composicaoUfv.totalTelhado,
      totalSolo: dados.composicaoUfv.totalSolo,
      valorOrcamento: dados.composicaoUfv.valorOrcamento,
      valorVendaTelhado: dados.composicaoUfv.valorVendaTelhado,
      valorVendaSolo: dados.composicaoUfv.valorVendaSolo,
      tipoAtual: dados.composicaoUfv.tipoAtual,
    }
  } else {
    delete clone.composicaoUfv
  }

  if (dados.multiUcResumo) {
    clone.multiUcResumo = {
      ...dados.multiUcResumo,
      ucs: dados.multiUcResumo.ucs.map((uc) => ({ ...uc })),
    }
  } else {
    delete clone.multiUcResumo
  }

  if (Array.isArray(dados.imagensInstalacao)) {
    clone.imagensInstalacao = dados.imagensInstalacao.map((imagem) => ({ ...imagem }))
  } else {
    delete clone.imagensInstalacao
  }

  if (dados.ucGeradora) {
    clone.ucGeradora = { ...dados.ucGeradora }
  } else {
    delete clone.ucGeradora
  }

  if (dados.ucGeradoraTitular) {
    clone.ucGeradoraTitular = { ...dados.ucGeradoraTitular }
  } else {
    delete clone.ucGeradoraTitular
  }

  if (Array.isArray(dados.ucsBeneficiarias)) {
    clone.ucsBeneficiarias = dados.ucsBeneficiarias.map((uc) => ({ ...uc }))
  } else {
    delete clone.ucsBeneficiarias
  }

  return clone
}
