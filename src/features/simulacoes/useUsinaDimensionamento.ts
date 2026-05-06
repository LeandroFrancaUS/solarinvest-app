/**
 * useUsinaDimensionamento.ts
 *
 * Owns all usina (solar system) dimensioning calculations:
 *   - Normalised irradiation, efficiency, days/month
 *   - Module count (manual vs auto) and installed power
 *   - Normative precheck derived memos & effects
 *   - Auto-budget eligibility effect
 *   - Multi-UC energy generation sync effect
 *   - VendaActions parametros/configuracao/resultados/orcamento/pagamento sync effects
 *   - UC beneficiária helpers
 *   - Area, daily generation, generation params
 *   - Proposal alerts helpers
 *
 * Params — every external dependency is explicit.
 * Returns — all derived values App.tsx needs downstream.
 */

import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  calcPotenciaSistemaKwp,
  calcProjectedCostsByConsumption,
  getRedeByPotencia,
  type Rede,
} from '../../lib/pricing/pricingPorKwp'
import { calcularPrecheckNormativo } from '../../domain/normas/precheckNormativo'
import {
  getAutoEligibility,
  normalizeInstallType,
  normalizeSystemType,
  type InstallType,
  type SystemType,
} from '../../lib/pricing/autoEligibility'
import { estimateMonthlyGenerationKWh, estimateMonthlyKWh } from '../../lib/energy/generation'
import { normalizeTusdTipoClienteValue } from '../../features/propostas/proposalHelpers'
import {
  formatTipoLigacaoLabel,
  type TipoLigacaoNorma,
  type NormComplianceResult,
  type PrecheckDecision,
  type PrecheckDecisionAction,
} from '../../domain/normas/padraoEntradaRules'
import {
  formatNumberBRWithOptions,
} from '../../lib/locale/br-number'
import {
  normalizeTipoBasico,
} from '../../types/tipoBasico'
import {
  DIAS_MES_PADRAO,
  INITIAL_VALUES,
  createDefaultMultiUcRow,
  type TipoRede,
  type MultiUcRowState,
} from '../../app/config'
import { getPotenciaModuloW, type PropostaState } from '../../lib/selectors/proposta'
import { normalizeTipoSistemaValue } from './useUsinaConfigState'
import { calcularTaxaMinima } from '../../utils/calcs'
import {
  vendaActions,
  type VendaKitItem,
} from '../../store/useVendaStore'
import type {
  SegmentoCliente,
  TipoSistema,
  VendaForm,
} from '../../lib/finance/roi'
import type { TipoClienteTUSD } from '../../lib/finance/tusd'
import type { TipoInstalacao } from '../../types/printableProposal'
import type { UcBeneficiariaFormState } from '../../types/ucBeneficiaria'
import type { VendasConfig } from '../../types/vendasConfig'
import type { KitBudgetState } from '../../app/config'
import type { MultiUcClasse } from '../../types/multiUc'
import type { StructuredItem } from '../../utils/structuredBudgetParser'

// ── Local helpers (mirrored from App.tsx module scope) ────────────────────────

const TUSD_TO_SEGMENTO: Record<TipoClienteTUSD, SegmentoCliente> = {
  residencial: 'residencial' as SegmentoCliente,
  comercial: 'comercial' as SegmentoCliente,
  cond_vertical: 'cond_vertical' as SegmentoCliente,
  cond_horizontal: 'cond_horizontal' as SegmentoCliente,
  industrial: 'industrial' as SegmentoCliente,
  outros: 'outros' as SegmentoCliente,
} as Record<TipoClienteTUSD, SegmentoCliente>

const SEGMENTO_TO_TUSD: Record<SegmentoCliente, TipoClienteTUSD> = {
  '': 'residencial' as TipoClienteTUSD,
  residencial: 'residencial' as TipoClienteTUSD,
  comercial: 'comercial' as TipoClienteTUSD,
  cond_vertical: 'cond_vertical' as TipoClienteTUSD,
  cond_horizontal: 'cond_horizontal' as TipoClienteTUSD,
  industrial: 'industrial' as TipoClienteTUSD,
  outros: 'outros' as TipoClienteTUSD,
} as Record<SegmentoCliente, TipoClienteTUSD>

const numbersAreClose = (
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance = 0.01,
) => {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= tolerance
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface UseUsinaDimensionamentoParams {
  // From useUsinaConfigState
  eficiencia: number
  diasMes: number
  tipoInstalacao: TipoInstalacao
  tipoSistema: TipoSistema
  setTipoSistema: (value: TipoSistema) => void
  tipoRede: TipoRede
  setTipoRede: (value: TipoRede) => void
  tipoRedeControle: string
  potenciaModulo: number
  potenciaFonteManual: boolean
  numeroModulosManual: number | ''
  setNumeroModulosManual: Dispatch<SetStateAction<number | ''>>

  // From App.tsx direct state
  kcKwhMes: number
  setKcKwhMes: (value: number, origin?: 'auto' | 'user') => number
  irradiacao: number
  tarifaCheia: number
  desconto: number
  inflacaoAa: number
  ufTarifa: string
  taxaMinima: number
  taxaMinimaInputEmpty: boolean
  distribuidoraAneelEfetiva: string
  consumoManual: boolean
  consumoAnteriorRef: MutableRefObject<number>
  recalcularTick: number

  // vendaForm and its setters
  vendaForm: VendaForm
  setVendaForm: Dispatch<SetStateAction<VendaForm>>
  setVendaFormErrors: Dispatch<SetStateAction<Record<string, string>>>
  resetRetorno: () => void

  // vendasConfig
  vendasConfig: VendasConfig

  // Budget / auto-pricing
  budgetStructuredItems: StructuredItem[]
  kitBudget: KitBudgetState
  modoOrcamento: 'auto' | 'manual'
  setModoOrcamento: Dispatch<SetStateAction<'auto' | 'manual'>>
  autoPricingRede: Rede | null
  autoBudgetReason: string | null
  autoBudgetReasonCode: string | null
  setAutoKitValor: (value: number | null) => void
  setAutoCustoFinal: (value: number | null) => void
  setAutoPricingRede: Dispatch<SetStateAction<Rede | null>>
  setAutoPricingVersion: (value: string | null) => void
  setAutoBudgetReason: (value: string | null) => void
  setAutoBudgetReasonCode: (value: string | null) => void

  // isVendaDiretaTab
  isVendaDiretaTab: boolean

  // Client / leasing context
  cliente: { uf?: string | null }
  leasingContrato: {
    ucGeradoraTitularDraft?: { endereco: { uf?: string | null } } | null
    ucGeradoraTitular?: { endereco: { uf?: string | null } } | null
  }

  // Precheck normativo (from usePrecheckNormativo)
  precheckClienteCiente: boolean
  setPrecheckClienteCiente: (value: boolean) => void
  precheckModalData: NormComplianceResult | null
  setPrecheckModalData: Dispatch<SetStateAction<NormComplianceResult | null>>
  setPrecheckModalClienteCiente: (value: boolean) => void
  buildPrecheckObservationBlock: (params: {
    result: NormComplianceResult
    action: PrecheckDecisionAction
    clienteCiente: boolean
  }) => string
  isPrecheckObservationTextValid: (text: string) => boolean
  upsertPrecheckObservation: (text: string) => void
  removePrecheckObservation: () => void
  requestPrecheckDecision: (compliance: NormComplianceResult) => Promise<PrecheckDecision>

  // Normative adjustment
  applyNormativeAdjustment: (params: {
    potenciaKw: number
    tipoLigacao?: TipoLigacaoNorma
  }) => void

  // TUSD/segmento update callbacks
  updateSegmentoCliente: (
    segmento: SegmentoCliente,
    opts?: { updateVenda?: boolean },
  ) => void
  updateTusdTipoCliente: (
    tusd: TipoClienteTUSD,
    opts?: { updateVenda?: boolean; reset?: boolean },
  ) => void

  // Multi-UC state (from useMultiUcState)
  multiUcAtivo: boolean
  setMultiUcAtivo: Dispatch<SetStateAction<boolean>>
  multiUcConsumoAnteriorRef: MutableRefObject<number | null>
  multiUcIdCounterRef: MutableRefObject<number>
  multiUcEnergiaGeradaTouched: boolean
  setMultiUcEnergiaGeradaTouched: Dispatch<SetStateAction<boolean>>
  setMultiUcRows: Dispatch<SetStateAction<MultiUcRowState[]>>
  applyTarifasAutomaticas: (row: MultiUcRowState, classe?: MultiUcClasse, init?: boolean) => MultiUcRowState
  setMultiUcEnergiaGeradaKWhState: Dispatch<SetStateAction<number>>

  // UC beneficiárias
  ucsBeneficiarias: UcBeneficiariaFormState[]

  // segmentoCliente (for updateConfiguracao)
  segmentoCliente: SegmentoCliente
}

// ── Return ────────────────────────────────────────────────────────────────────

export interface UseUsinaDimensionamentoReturn {
  eficienciaNormalizada: number
  baseIrradiacao: number
  diasMesNormalizado: number
  diasMesConsiderado: number
  vendaPotenciaCalculada: { potenciaKwp: number; quantidadeModulos: number | null } | null
  vendaAutoPotenciaKwp: number | null
  numeroModulosEstimado: number
  potenciaInstaladaKwp: number
  ufNorma: string
  normCompliance: NormComplianceResult | null
  normComplianceBanner: {
    tone: string
    title: string
    statusLabel: string
    message: string
    details: string[]
  }
  tipoRedeCompatMessage: string
  ensureNormativePrecheck: () => Promise<boolean>
  installTypeNormalized: InstallType | null
  systemTypeNormalized: SystemType | null
  margemLucroPadraoFracao: number
  comissaoPadraoFracao: number
  autoBudgetFallbackMessage: string
  parseUcBeneficiariaConsumo: (valor: string) => number
  consumoTotalUcsBeneficiarias: number
  consumoUcsExcedeInformado: boolean
  recalcularRateioAutomatico: (lista: UcBeneficiariaFormState[]) => UcBeneficiariaFormState[]
  vendaGeracaoParametros: { hsp: number; pr: number }
  areaInstalacao: number
  geracaoMensalKwh: number
  coletarAlertasProposta: () => string[]
  confirmarAlertasGerarProposta: () => boolean
  handleMultiUcToggle: (checked: boolean) => void
  normalizarPotenciaKwp: (valor: number) => number
  normalizarGeracaoMensal: (valor: number) => number
  calcularPotenciaSistemaKwp: (modulos: number, potenciaModuloOverride?: number) => number
  estimarGeracaoPorPotencia: (potenciaKwp: number) => number
  calcularModulosPorGeracao: (geracaoAlvo: number, potenciaModuloOverride?: number) => number | null
  geracaoDiariaKwh: number
  tipoRedeAutoSugestao: TipoRede | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUsinaDimensionamento({
  eficiencia,
  diasMes,
  tipoInstalacao,
  tipoSistema,
  setTipoSistema,
  tipoRede,
  setTipoRede,
  tipoRedeControle,
  potenciaModulo,
  potenciaFonteManual,
  numeroModulosManual,
  setNumeroModulosManual,
  kcKwhMes,
  setKcKwhMes,
  irradiacao,
  tarifaCheia,
  desconto,
  inflacaoAa,
  ufTarifa,
  taxaMinima,
  taxaMinimaInputEmpty,
  distribuidoraAneelEfetiva,
  consumoManual,
  consumoAnteriorRef,
  recalcularTick,
  vendaForm,
  setVendaForm,
  setVendaFormErrors,
  resetRetorno,
  vendasConfig,
  budgetStructuredItems,
  kitBudget,
  modoOrcamento,
  setModoOrcamento,
  autoPricingRede,
  autoBudgetReason,
  autoBudgetReasonCode,
  setAutoKitValor,
  setAutoCustoFinal,
  setAutoPricingRede,
  setAutoPricingVersion,
  setAutoBudgetReason,
  setAutoBudgetReasonCode,
  isVendaDiretaTab,
  cliente,
  leasingContrato,
  precheckClienteCiente,
  setPrecheckClienteCiente,
  precheckModalData,
  setPrecheckModalData,
  setPrecheckModalClienteCiente,
  buildPrecheckObservationBlock,
  isPrecheckObservationTextValid,
  upsertPrecheckObservation,
  removePrecheckObservation,
  requestPrecheckDecision,
  applyNormativeAdjustment,
  updateSegmentoCliente,
  updateTusdTipoCliente,
  multiUcAtivo,
  setMultiUcAtivo,
  multiUcConsumoAnteriorRef,
  multiUcIdCounterRef,
  multiUcEnergiaGeradaTouched,
  setMultiUcEnergiaGeradaTouched,
  setMultiUcRows,
  applyTarifasAutomaticas,
  setMultiUcEnergiaGeradaKWhState,
  ucsBeneficiarias,
  segmentoCliente,
}: UseUsinaDimensionamentoParams): UseUsinaDimensionamentoReturn {

  // ── Normalised scalars ────────────────────────────────────────────────────

  const eficienciaNormalizada = useMemo(() => {
    if (eficiencia <= 0) return 0
    if (eficiencia >= 1.5) return eficiencia / 100
    return eficiencia
  }, [eficiencia])

  const baseIrradiacao = useMemo(
    () => (irradiacao > 0 ? irradiacao : 0),
    [irradiacao],
  )

  const diasMesNormalizado = useMemo(
    () => (diasMes > 0 ? diasMes : 0),
    [diasMes],
  )

  // ── Power / module calculations ───────────────────────────────────────────

  const vendaPotenciaCalculada = useMemo(() => {
    const dias = diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO
    return calcPotenciaSistemaKwp({
      consumoKwhMes: kcKwhMes,
      irradiacao: baseIrradiacao,
      performanceRatio: eficienciaNormalizada,
      diasMes: dias,
      potenciaModuloWp: potenciaModulo,
    })
  }, [baseIrradiacao, diasMesNormalizado, eficienciaNormalizada, kcKwhMes, potenciaModulo])

  const numeroModulosInformado = useMemo(() => {
    if (typeof numeroModulosManual !== 'number') return null
    if (!Number.isFinite(numeroModulosManual) || numeroModulosManual <= 0) return null
    return Math.max(1, Math.round(numeroModulosManual))
  }, [numeroModulosManual])

  const numeroModulosCalculado = useMemo(() => {
    if (potenciaFonteManual) {
      const manual = Number(vendaForm.potencia_instalada_kwp)
      if (Number.isFinite(manual) && manual > 0 && potenciaModulo > 0) {
        const estimado = Math.round((manual * 1000) / potenciaModulo)
        if (Number.isFinite(estimado) && estimado > 0) {
          return estimado
        }
      }
    }

    if (vendaPotenciaCalculada?.quantidadeModulos) {
      return vendaPotenciaCalculada.quantidadeModulos
    }

    if (vendaPotenciaCalculada?.potenciaKwp && potenciaModulo > 0) {
      const estimado = Math.ceil((vendaPotenciaCalculada.potenciaKwp * 1000) / potenciaModulo)
      if (Number.isFinite(estimado) && estimado > 0) {
        return estimado
      }
    }

    return 0
  }, [
    potenciaFonteManual,
    potenciaModulo,
    vendaForm.potencia_instalada_kwp,
    vendaPotenciaCalculada?.potenciaKwp,
    vendaPotenciaCalculada?.quantidadeModulos,
  ])

  const potenciaInstaladaKwp = useMemo(() => {
    if (potenciaFonteManual) {
      const manual = Number(vendaForm.potencia_instalada_kwp)
      if (Number.isFinite(manual) && manual > 0) {
        return Math.round(manual * 100) / 100
      }
    }

    const modulos = numeroModulosInformado ?? numeroModulosCalculado
    if (modulos && potenciaModulo > 0) {
      return (modulos * potenciaModulo) / 1000
    }

    return vendaPotenciaCalculada?.potenciaKwp ?? 0
  }, [
    numeroModulosInformado,
    numeroModulosCalculado,
    potenciaModulo,
    potenciaFonteManual,
    vendaForm.potencia_instalada_kwp,
    vendaPotenciaCalculada?.potenciaKwp,
  ])

  // ── Normative precheck ────────────────────────────────────────────────────

  const ufNorma = useMemo(() => {
    const uf =
      cliente.uf ||
      leasingContrato.ucGeradoraTitularDraft?.endereco.uf ||
      leasingContrato.ucGeradoraTitular?.endereco.uf ||
      ufTarifa
    return (uf ?? '').toUpperCase()
  }, [
    cliente.uf,
    leasingContrato.ucGeradoraTitular?.endereco.uf,
    leasingContrato.ucGeradoraTitularDraft?.endereco.uf,
    ufTarifa,
  ])

  const precheckNormativo = useMemo(
    () =>
      calcularPrecheckNormativo({
        uf: ufNorma,
        tipoRede,
        potenciaKw: potenciaInstaladaKwp,
      }),
    [potenciaInstaladaKwp, tipoRede, ufNorma],
  )

  const normCompliance = precheckNormativo.compliance

  const tipoRedeCompatMessage = useMemo(() => {
    if (!normCompliance) {
      return ''
    }

    if (normCompliance.status === 'FORA_DA_NORMA' || normCompliance.status === 'LIMITADO') {
      return `Padrão de entrada: atenção — potência acima do limite do padrão atual (${normCompliance.uf}). Clique para revisar.`
    }

    return ''
  }, [normCompliance])

  const normComplianceBanner = useMemo(() => {
    if (!normCompliance) {
      if (precheckNormativo.status === 'INDETERMINADO') {
        return {
          tone: 'neutral',
          title: 'Pré-check normativo (padrão de entrada)',
          statusLabel: 'INDETERMINADO',
          message: precheckNormativo.observacoes.join(' '),
          details: [] as string[],
        }
      }
      return {
        tone: 'neutral',
        title: 'Pré-check normativo (padrão de entrada)',
        statusLabel: 'PENDENTE',
        message: 'Informe UF, tipo de rede e potência para validar o padrão de entrada.',
        details: [] as string[],
      }
    }

    const tipoLabel = formatTipoLigacaoLabel(normCompliance.tipoLigacao)
    const formatKw = (value?: number | null) =>
      value != null
        ? formatNumberBRWithOptions(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : null
    const details: string[] = []
    if (normCompliance.kwMaxPermitido != null) {
      const limiteLabel = formatKw(normCompliance.kwMaxPermitido)
      details.push(`Limite ${tipoLabel}: ${limiteLabel} kW.`)
    }
    const isAboveLimit =
      normCompliance.status === 'FORA_DA_NORMA' || normCompliance.status === 'LIMITADO'
    if (isAboveLimit && normCompliance.upgradeTo && normCompliance.kwMaxUpgrade != null) {
      const limiteUpgradeLabel = formatKw(normCompliance.kwMaxUpgrade)
      details.push(
        `Upgrade sugerido: ${formatTipoLigacaoLabel(normCompliance.upgradeTo)} até ${limiteUpgradeLabel} kW.`,
      )
    }

    const statusMap = {
      OK: { tone: 'ok', label: 'Dentro do limite', message: 'Dentro do limite do padrão informado.' },
      WARNING: {
        tone: 'error',
        label: 'Regra provisória',
        message: 'Regra provisória: valide com a distribuidora antes do envio.',
      },
      FORA_DA_NORMA: {
        tone: 'error',
        label: 'Acima do limite',
        message: 'A potência informada está acima do limite do padrão atual.',
      },
      LIMITADO: {
        tone: 'danger',
        label: 'Acima do limite',
        message: 'A potência informada excede o limite mesmo com upgrade.',
      },
    } as const

    const statusInfo = statusMap[normCompliance.status]
    return {
      tone: statusInfo.tone,
      title: `Pré-check normativo (padrão de entrada)`,
      statusLabel: statusInfo.label,
      message: statusInfo.message,
      details,
    }
  }, [normCompliance, precheckNormativo, ufNorma])

  useEffect(() => {
    setPrecheckClienteCiente(false)
    setPrecheckModalClienteCiente(false)
  }, [
    normCompliance?.status,
    normCompliance?.uf,
    normCompliance?.tipoLigacao,
    normCompliance?.potenciaInversorKw,
    normCompliance?.kwMaxPermitido,
    normCompliance?.kwMaxUpgrade,
  ])

  useEffect(() => {
    if (!precheckModalData || !normCompliance) {
      return
    }
    setPrecheckModalData(normCompliance)
  }, [normCompliance, precheckModalData])

  useEffect(() => {
    if (!normCompliance) {
      if (precheckNormativo.status === 'INDETERMINADO') {
        removePrecheckObservation()
      }
      return
    }

    const observation = buildPrecheckObservationBlock({
      result: normCompliance,
      action: 'proceed',
      clienteCiente: precheckClienteCiente,
    })

    if (!isPrecheckObservationTextValid(observation)) {
      return
    }

    upsertPrecheckObservation(observation)
  }, [
    buildPrecheckObservationBlock,
    isPrecheckObservationTextValid,
    normCompliance,
    precheckClienteCiente,
    precheckNormativo.status,
    removePrecheckObservation,
    upsertPrecheckObservation,
  ])

  const ensureNormativePrecheck = useCallback(async (): Promise<boolean> => {
    if (!normCompliance) {
      return true
    }

    if (normCompliance.status === 'OK' || normCompliance.status === 'WARNING') {
      return true
    }

    const decision = await requestPrecheckDecision(normCompliance)
    if (decision.action === 'cancel') {
      return false
    }

    if (decision.action === 'adjust_current') {
      const limite = normCompliance.kwMaxPermitido ?? normCompliance.potenciaInversorKw
      applyNormativeAdjustment({ potenciaKw: limite })
      await Promise.resolve()
      return true
    }

    if (decision.action === 'adjust_upgrade') {
      const limite =
        normCompliance.kwMaxUpgrade ?? normCompliance.kwMaxPermitido ?? normCompliance.potenciaInversorKw
      const tipo = normCompliance.upgradeTo ?? normCompliance.tipoLigacao
      applyNormativeAdjustment({ potenciaKw: limite, tipoLigacao: tipo })
      await Promise.resolve()
      return true
    }

    if (decision.action === 'proceed' && decision.clienteCiente) {
      setPrecheckClienteCiente(true)
      return true
    }

    return false
  }, [
    applyNormativeAdjustment,
    normCompliance,
    requestPrecheckDecision,
    setPrecheckClienteCiente,
  ])

  // ── Module count (estimated) ──────────────────────────────────────────────

  const numeroModulosEstimado = useMemo(() => {
    if (numeroModulosInformado) return numeroModulosInformado
    return numeroModulosCalculado
  }, [numeroModulosInformado, numeroModulosCalculado])

  const vendaAutoPotenciaKwp = useMemo(
    () => vendaPotenciaCalculada?.potenciaKwp ?? null,
    [vendaPotenciaCalculada?.potenciaKwp],
  )

  // ── Normalised install / system types ────────────────────────────────────

  const installTypeNormalized = useMemo<InstallType | null>(() => {
    if (tipoInstalacao === 'solo') return 'solo'
    if (tipoInstalacao === 'outros') return 'outros'
    return normalizeInstallType('telhado')
  }, [tipoInstalacao])

  const systemTypeNormalized = useMemo<SystemType | null>(
    () => normalizeSystemType(tipoSistema === 'OFF_GRID' ? 'offgrid' : tipoSistema.toLowerCase()),
    [tipoSistema],
  )

  const potenciaKwpElegivel = useMemo(
    () => (Number.isFinite(potenciaInstaladaKwp) && potenciaInstaladaKwp > 0 ? potenciaInstaladaKwp : null),
    [potenciaInstaladaKwp],
  )

  // ── Auto-suggested rede ───────────────────────────────────────────────────

  const tipoRedeAutoSugestao = useMemo<TipoRede | null>(() => {
    if (autoPricingRede) {
      return autoPricingRede === 'mono' ? 'monofasico' : 'trifasico'
    }

    if (!Number.isFinite(potenciaInstaladaKwp) || potenciaInstaladaKwp <= 0) {
      return null
    }

    const rede = getRedeByPotencia(potenciaInstaladaKwp)
    return rede === 'mono' ? 'monofasico' : 'trifasico'
  }, [autoPricingRede, potenciaInstaladaKwp])

  useEffect(() => {
    if (tipoRedeControle !== 'auto') {
      return
    }
    if (!tipoRedeAutoSugestao) {
      return
    }
    if (tipoRede === tipoRedeAutoSugestao) {
      return
    }
    setTipoRede(tipoRedeAutoSugestao)
  }, [tipoRede, tipoRedeAutoSugestao, tipoRedeControle])

  // ── Margin / commission fractions ─────────────────────────────────────────

  const margemLucroPadraoFracao = useMemo(() => {
    const percentual = Number(vendasConfig.margem_operacional_padrao_percent)
    if (!Number.isFinite(percentual)) return 0
    return Math.max(0, percentual) / 100
  }, [vendasConfig.margem_operacional_padrao_percent])

  const comissaoPadraoFracao = useMemo(() => {
    const percentual = Number(vendasConfig.comissao_default_percent)
    if (!Number.isFinite(percentual)) return 0
    return Math.max(0, percentual) / 100
  }, [vendasConfig.comissao_default_percent])

  // ── Auto-budget fallback message ─────────────────────────────────────────

  const autoBudgetFallbackMessage = useMemo(() => {
    switch (autoBudgetReasonCode) {
      case 'INSTALL_NOT_ELIGIBLE':
        return 'Instalação em solo/outros exige orçamento personalizado. Modo manual ativado.'
      case 'SYSTEM_NOT_ELIGIBLE':
        return 'Sistemas híbridos ou off-grid exigem orçamento personalizado. Modo manual ativado.'
      case 'KWP_LIMIT':
        return 'Para sistemas acima de 90 kWp, o orçamento é realizado de forma personalizada. Modo manual ativado.'
      case 'MISSING_SELECTION':
        return 'Selecione o tipo de instalação e o tipo de sistema para continuar.'
      default:
        return autoBudgetReason ?? ''
    }
  }, [autoBudgetReason, autoBudgetReasonCode])

  // ── Auto-budget effect ────────────────────────────────────────────────────

  useEffect(() => {
    const eligibility = getAutoEligibility({
      installType: installTypeNormalized,
      systemType: systemTypeNormalized,
      kwp: potenciaKwpElegivel,
    })

    setAutoBudgetReason(eligibility.reason ?? null)
    setAutoBudgetReasonCode(eligibility.reasonCode ?? null)

    if (modoOrcamento !== 'auto') {
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    if (!eligibility.eligible) {
      setModoOrcamento('manual')
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    const projectedCosts = calcProjectedCostsByConsumption({
      consumoKwhMes: kcKwhMes,
      uf: ufTarifa,
      tarifaCheia,
      descontoPercentual: desconto,
      irradiacao: baseIrradiacao,
      performanceRatio: eficienciaNormalizada,
      diasMes: diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO,
      potenciaModuloWp: potenciaModulo,
      margemLucroPct: margemLucroPadraoFracao,
      comissaoVendaPct: comissaoPadraoFracao,
    })

    if (!projectedCosts) {
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    const custoFinalProjetado = isVendaDiretaTab
      ? projectedCosts.custoFinalVenda
      : projectedCosts.custoFinalLeasing

    setAutoKitValor(projectedCosts.kitAtualizado)
    setAutoCustoFinal(custoFinalProjetado)
    setAutoPricingRede(projectedCosts.potenciaKwp > 23.22 ? 'trifasico' : 'mono')
    setAutoPricingVersion('pricing_consumo_v3')
  }, [
    installTypeNormalized,
    systemTypeNormalized,
    modoOrcamento,
    potenciaKwpElegivel,
    setModoOrcamento,
    kcKwhMes,
    ufTarifa,
    tarifaCheia,
    desconto,
    baseIrradiacao,
    eficienciaNormalizada,
    diasMesNormalizado,
    potenciaModulo,
    isVendaDiretaTab,
    margemLucroPadraoFracao,
    comissaoPadraoFracao,
  ])

  // ── UC beneficiária helpers ───────────────────────────────────────────────

  const parseUcBeneficiariaConsumo = (valor: string): number => {
    const normalizado = valor.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalizado)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0
    }
    return parsed
  }

  const consumoTotalUcsBeneficiarias = ucsBeneficiarias.reduce(
    (acc, item) => acc + parseUcBeneficiariaConsumo(item.consumoKWh),
    0,
  )

  const consumoUcsExcedeInformado =
    kcKwhMes > 0 && consumoTotalUcsBeneficiarias > kcKwhMes

  const recalcularRateioAutomatico = (
    lista: UcBeneficiariaFormState[],
  ): UcBeneficiariaFormState[] => {
    const totalConsumo = lista.reduce(
      (acc, item) => acc + parseUcBeneficiariaConsumo(item.consumoKWh),
      0,
    )

    if (totalConsumo <= 0) {
      return lista
    }

    return lista.map((item) => {
      const consumo = parseUcBeneficiariaConsumo(item.consumoKWh)
      const percentual = consumo > 0 ? (consumo / totalConsumo) * 100 : 0
      const percentualFormatado = Number.isFinite(percentual)
        ? percentual.toFixed(2).replace('.', ',')
        : '0'
      return { ...item, rateioPercentual: percentualFormatado }
    })
  }

  // ── Generation parameters ─────────────────────────────────────────────────

  const vendaGeracaoParametros = useMemo(
    () => ({
      hsp: baseIrradiacao > 0 ? baseIrradiacao : 0,
      pr: eficienciaNormalizada > 0 ? eficienciaNormalizada : 0,
    }),
    [baseIrradiacao, eficienciaNormalizada],
  )

  // ── TUSD/segmento sync ────────────────────────────────────────────────────

  useEffect(() => {
    const tusdValido: TipoClienteTUSD = vendaForm.tusd_tipo_cliente
      ? normalizeTusdTipoClienteValue(vendaForm.tusd_tipo_cliente)
      : INITIAL_VALUES.tusdTipoCliente
    const segmentoPreferido = TUSD_TO_SEGMENTO[tusdValido] ?? INITIAL_VALUES.segmentoCliente
    const segmentoAtual = vendaForm.segmento_cliente
      ? normalizeTipoBasico(vendaForm.segmento_cliente)
      : null
    const segmentoResolvido: SegmentoCliente = segmentoAtual ?? segmentoPreferido
    const tusdResolvido = SEGMENTO_TO_TUSD[segmentoResolvido] ?? INITIAL_VALUES.tusdTipoCliente

    updateSegmentoCliente(segmentoResolvido, {
      updateVenda: segmentoAtual !== segmentoResolvido,
    })
    updateTusdTipoCliente(tusdResolvido, {
      updateVenda: tusdValido !== tusdResolvido,
      reset: false,
    })
  }, [
    updateSegmentoCliente,
    updateTusdTipoCliente,
    vendaForm.segmento_cliente,
    vendaForm.tusd_tipo_cliente,
  ])

  useEffect(() => {
    const tipoAtual = normalizeTipoSistemaValue(vendaForm.tipo_sistema)
    if (tipoAtual && tipoAtual !== tipoSistema) {
      setTipoSistema(tipoAtual)
    }
  }, [setTipoSistema, tipoSistema, vendaForm.tipo_sistema])

  // ── Area and generation ───────────────────────────────────────────────────

  const areaInstalacao = useMemo(() => {
    if (numeroModulosEstimado <= 0) return 0
    const fator = tipoInstalacao === 'solo' ? 7 : 3.3
    return Math.round(numeroModulosEstimado * fator)
  }, [numeroModulosEstimado, tipoInstalacao])

  const geracaoMensalKwh = useMemo(() => {
    if (potenciaInstaladaKwp <= 0) {
      return 0
    }
    const estimada = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: potenciaInstaladaKwp,
      irradiacao_kwh_m2_dia: baseIrradiacao,
      performance_ratio: eficienciaNormalizada,
      dias_mes: diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO,
    })
    return estimada > 0 ? estimada : 0
  }, [baseIrradiacao, diasMesNormalizado, eficienciaNormalizada, potenciaInstaladaKwp])

  // ── Proposal alert helpers ────────────────────────────────────────────────

  const coletarAlertasProposta = useCallback(() => {
    const alertas: string[] = []

    if (consumoUcsExcedeInformado) {
      alertas.push(
        `A soma dos consumos das UCs beneficiárias (${formatNumberBRWithOptions(consumoTotalUcsBeneficiarias, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} kWh/mês) excede o consumo mensal informado (${formatNumberBRWithOptions(kcKwhMes, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} kWh/mês).`,
      )
    }

    return alertas
  }, [consumoTotalUcsBeneficiarias, consumoUcsExcedeInformado, kcKwhMes])

  const confirmarAlertasGerarProposta = useCallback(() => {
    const alertas = coletarAlertasProposta()

    if (!alertas.length) {
      return true
    }

    const mensagem = `${
      alertas.length === 1 ? 'Encontramos um alerta:' : 'Encontramos alguns alertas:'
    }\n\n- ${alertas.join('\n- ')}\n\nPressione "OK" para gerar a proposta assim mesmo ou "Cancelar" para voltar e ajustar os valores.`

    return window.confirm(mensagem)
  }, [coletarAlertasProposta])

  // ── Multi-UC toggle handler and effect ───────────────────────────────────

  const handleMultiUcToggle = useCallback(
    (checked: boolean) => {
      setMultiUcAtivo(checked)
      if (checked) {
        multiUcConsumoAnteriorRef.current = kcKwhMes
        setMultiUcEnergiaGeradaTouched(false)
        setMultiUcRows((prev: MultiUcRowState[]) => {
          if (prev.length > 0) {
            return prev
          }
          const novoId = multiUcIdCounterRef.current
          multiUcIdCounterRef.current += 1
          return [applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true)]
        })
        const sugeridoBase = geracaoMensalKwh > 0 ? geracaoMensalKwh : kcKwhMes
        if (sugeridoBase > 0) {
          setMultiUcEnergiaGeradaKWhState((prev) => (prev > 0 ? prev : Math.max(0, sugeridoBase)))
        }
      } else {
        setMultiUcEnergiaGeradaTouched(false)
        if (multiUcConsumoAnteriorRef.current != null) {
          setKcKwhMes(multiUcConsumoAnteriorRef.current, 'auto')
        }
        multiUcConsumoAnteriorRef.current = null
      }
    },
    [
      applyTarifasAutomaticas,
      geracaoMensalKwh,
      kcKwhMes,
      setKcKwhMes,
    ],
  )

  useEffect(() => {
    if (!multiUcAtivo) {
      return
    }
    const sugerido = Math.max(0, geracaoMensalKwh)
    setMultiUcEnergiaGeradaKWhState((prev) => {
      if (multiUcEnergiaGeradaTouched && prev > 0) {
        return prev
      }
      if (sugerido > 0 && Math.abs(prev - sugerido) > 0.1) {
        return sugerido
      }
      return prev
    })
  }, [geracaoMensalKwh, multiUcAtivo, multiUcEnergiaGeradaTouched])

  const diasMesConsiderado = diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO

  // ── Normalisation helpers ─────────────────────────────────────────────────

  const normalizarPotenciaKwp = useCallback((valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      return 0
    }
    return Math.round(valor * 100) / 100
  }, [])

  const normalizarGeracaoMensal = useCallback((valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      return 0
    }
    return Math.round(valor * 10) / 10
  }, [])

  const calcularPotenciaSistemaKwpLocal = useCallback(
    (modulos: number, potenciaModuloOverride?: number) => {
      const potenciaWp =
        Number.isFinite(potenciaModuloOverride) && (potenciaModuloOverride ?? 0) > 0
          ? Number(potenciaModuloOverride)
          : potenciaModulo
      if (!Number.isFinite(modulos) || modulos <= 0) {
        return 0
      }
      if (!Number.isFinite(potenciaWp) || potenciaWp <= 0) {
        return 0
      }
      return (modulos * potenciaWp) / 1000
    },
    [potenciaModulo],
  )

  const estimarGeracaoPorPotencia = useCallback(
    (potenciaKwp: number) => {
      if (!Number.isFinite(potenciaKwp) || potenciaKwp <= 0) {
        return 0
      }
      return estimateMonthlyGenerationKWh({
        potencia_instalada_kwp: potenciaKwp,
        irradiacao_kwh_m2_dia: baseIrradiacao,
        performance_ratio: eficienciaNormalizada,
        dias_mes: diasMesConsiderado,
      })
    },
    [baseIrradiacao, eficienciaNormalizada, diasMesConsiderado],
  )

  const fatorGeracaoMensalCompleto = useMemo(() => {
    if (baseIrradiacao <= 0 || eficienciaNormalizada <= 0 || diasMesConsiderado <= 0) {
      return 0
    }
    return baseIrradiacao * eficienciaNormalizada * diasMesConsiderado
  }, [baseIrradiacao, diasMesConsiderado, eficienciaNormalizada])

  const calcularModulosPorGeracao = useCallback(
    (geracaoAlvo: number, potenciaModuloOverride?: number) => {
      if (!Number.isFinite(geracaoAlvo) || geracaoAlvo <= 0) {
        return null
      }
      if (!Number.isFinite(fatorGeracaoMensalCompleto) || fatorGeracaoMensalCompleto <= 0) {
        return null
      }
      const potenciaWp =
        Number.isFinite(potenciaModuloOverride) && (potenciaModuloOverride ?? 0) > 0
          ? Number(potenciaModuloOverride)
          : potenciaModulo
      if (!Number.isFinite(potenciaWp) || potenciaWp <= 0) {
        return null
      }
      const potenciaNecessaria = geracaoAlvo / fatorGeracaoMensalCompleto
      if (!Number.isFinite(potenciaNecessaria) || potenciaNecessaria <= 0) {
        return null
      }
      const modulosCalculados = Math.ceil((potenciaNecessaria * 1000) / potenciaWp)
      if (!Number.isFinite(modulosCalculados) || modulosCalculados <= 0) {
        return null
      }
      return modulosCalculados
    },
    [fatorGeracaoMensalCompleto, potenciaModulo],
  )

  // ── VendaActions sync effects ─────────────────────────────────────────────

  useEffect(() => {
    const consumo = Number.isFinite(vendaForm.consumo_kwh_mes)
      ? Number(vendaForm.consumo_kwh_mes)
      : kcKwhMes
    const tarifaAtual = Number.isFinite(vendaForm.tarifa_r_kwh)
      ? Number(vendaForm.tarifa_r_kwh)
      : tarifaCheia
    const inflacaoEnergia = Number.isFinite(vendaForm.inflacao_energia_aa_pct)
      ? Number(vendaForm.inflacao_energia_aa_pct)
      : inflacaoAa
    const aplicaTaxaMinima =
      typeof vendaForm.aplica_taxa_minima === 'boolean' ? vendaForm.aplica_taxa_minima : true
    const taxaMinimaCalculada = calcularTaxaMinima(tipoRede, Math.max(0, tarifaAtual))
    const taxaMinimaEnergia = aplicaTaxaMinima
      ? taxaMinimaInputEmpty
        ? taxaMinimaCalculada
        : Number.isFinite(taxaMinima)
          ? Math.max(0, taxaMinima)
          : 0
      : 0
    const taxaDesconto = Number.isFinite(vendaForm.taxa_desconto_aa_pct)
      ? Number(vendaForm.taxa_desconto_aa_pct)
      : 0

    vendaActions.updateParametros({
      consumo_kwh_mes: consumo > 0 ? consumo : 0,
      tarifa_r_kwh: tarifaAtual > 0 ? tarifaAtual : 0,
      inflacao_energia_aa: inflacaoEnergia > 0 ? inflacaoEnergia : 0,
      taxa_minima_rs_mes: taxaMinimaEnergia > 0 ? taxaMinimaEnergia : 0,
      taxa_desconto_aa: taxaDesconto > 0 ? taxaDesconto : 0,
      horizonte_meses: 360,
      uf: cliente.uf ?? '',
      distribuidora: distribuidoraAneelEfetiva,
      irradiacao_kwhm2_dia: baseIrradiacao > 0 ? baseIrradiacao : 0,
      aplica_taxa_minima: aplicaTaxaMinima,
    })
  }, [
    baseIrradiacao,
    cliente.uf,
    distribuidoraAneelEfetiva,
    inflacaoAa,
    kcKwhMes,
    tarifaCheia,
    taxaMinima,
    taxaMinimaInputEmpty,
    vendaForm.consumo_kwh_mes,
    vendaForm.inflacao_energia_aa_pct,
    vendaForm.tarifa_r_kwh,
    vendaForm.aplica_taxa_minima,
    vendaForm.taxa_desconto_aa_pct,
    vendaForm.taxa_minima_r_mes,
    recalcularTick,
  ])

  useEffect(() => {
    const quantidadeInformada = Number.isFinite(vendaForm.quantidade_modulos)
      ? Number(vendaForm.quantidade_modulos)
      : null
    const quantidadeFinal = quantidadeInformada ?? numeroModulosEstimado ?? 0
    const potenciaSistema = Number.isFinite(vendaForm.potencia_instalada_kwp)
      ? Number(vendaForm.potencia_instalada_kwp)
      : potenciaInstaladaKwp
    const geracaoEstimativa = Number.isFinite(vendaForm.geracao_estimada_kwh_mes)
      ? Number(vendaForm.geracao_estimada_kwh_mes)
      : geracaoMensalKwh

    const potenciaState: PropostaState = {
      orcamento: {
        modulo: { potenciaW: potenciaModulo },
      },
    }
    const potenciaModuloSeguro = getPotenciaModuloW(potenciaState)

    vendaActions.updateConfiguracao({
      potencia_modulo_wp: potenciaModuloSeguro,
      n_modulos: Number.isFinite(quantidadeFinal) ? Math.max(0, Number(quantidadeFinal)) : 0,
      potencia_sistema_kwp: potenciaSistema > 0 ? potenciaSistema : 0,
      geracao_estimada_kwh_mes: geracaoEstimativa > 0 ? geracaoEstimativa : 0,
      area_m2: areaInstalacao > 0 ? areaInstalacao : 0,
      tipo_instalacao: tipoInstalacao,
      segmento: segmentoCliente,
      modelo_modulo: vendaForm.modelo_modulo ?? '',
      modelo_inversor: vendaForm.modelo_inversor ?? '',
      estrutura_suporte: vendaForm.estrutura_suporte ?? '',
      tipo_sistema: tipoSistema,
    })
  }, [
    areaInstalacao,
    geracaoMensalKwh,
    numeroModulosEstimado,
    potenciaInstaladaKwp,
    potenciaModulo,
    segmentoCliente,
    tipoSistema,
    tipoInstalacao,
    vendaForm.geracao_estimada_kwh_mes,
    vendaForm.modelo_inversor,
    vendaForm.modelo_modulo,
    vendaForm.estrutura_suporte,
    vendaForm.potencia_instalada_kwp,
    vendaForm.quantidade_modulos,
    recalcularTick,
  ])

  useEffect(() => {
    const autonomia = kcKwhMes > 0 && geracaoMensalKwh > 0 ? geracaoMensalKwh / kcKwhMes : null
    vendaActions.updateResultados({
      autonomia_frac: autonomia,
      energia_contratada_kwh_mes: kcKwhMes > 0 ? kcKwhMes : null,
    })
  }, [geracaoMensalKwh, kcKwhMes, recalcularTick])

  useEffect(() => {
    const itensNormalizados = budgetStructuredItems.map((item) => {
      const normalizado: VendaKitItem = {
        produto: item.produto ?? '',
        descricao: item.descricao ?? '',
        quantidade: Number.isFinite(item.quantidade) ? Number(item.quantidade) : null,
        unidade: item.unidade?.trim() ? item.unidade.trim() : null,
        precoUnit: Number.isFinite(item.precoUnitario) ? Number(item.precoUnitario) : null,
        precoTotal: Number.isFinite(item.precoTotal) ? Number(item.precoTotal) : null,
      }
      if (item.codigo?.trim()) {
        normalizado.codigo = item.codigo.trim()
      }
      if (item.modelo?.trim()) {
        normalizado.modelo = item.modelo.trim()
      }
      if (item.fabricante?.trim()) {
        normalizado.fabricante = item.fabricante.trim()
      }
      return normalizado
    })
    const valorTotal =
      kitBudget.total != null && Number.isFinite(kitBudget.total)
        ? Number(kitBudget.total)
        : 0
    vendaActions.updateOrcamento({ itens: itensNormalizados, valor_total_orcamento: valorTotal })
  }, [budgetStructuredItems, kitBudget.total, recalcularTick])

  useEffect(() => {
    vendaActions.updatePagamento({
      forma_pagamento: vendaForm.condicao,
      moeda: 'BRL',
      mdr_pix: Number.isFinite(vendaForm.taxa_mdr_pix_pct) ? Number(vendaForm.taxa_mdr_pix_pct) : 0,
      mdr_debito: Number.isFinite(vendaForm.taxa_mdr_debito_pct) ? Number(vendaForm.taxa_mdr_debito_pct) : 0,
      mdr_credito_avista: Number.isFinite(vendaForm.taxa_mdr_credito_vista_pct)
        ? Number(vendaForm.taxa_mdr_credito_vista_pct)
        : 0,
      validade_proposta_txt: vendaForm.validade_proposta ?? '',
      prazo_execucao_txt: vendaForm.prazo_execucao ?? '',
      condicoes_adicionais_txt: vendaForm.condicoes_adicionais ?? '',
    })
  }, [
    vendaForm.condicao,
    vendaForm.condicoes_adicionais,
    vendaForm.prazo_execucao,
    vendaForm.taxa_mdr_credito_vista_pct,
    vendaForm.taxa_mdr_debito_pct,
    vendaForm.taxa_mdr_pix_pct,
    vendaForm.validade_proposta,
    recalcularTick,
  ])

  useEffect(() => {
    const deveEstimarQuantidade =
      !Number.isFinite(vendaForm.quantidade_modulos) || (vendaForm.quantidade_modulos ?? 0) <= 0

    let updated = false
    setVendaForm((prev) => {
      const next = { ...prev }
      const potenciaNormalizada = Math.round(potenciaInstaladaKwp * 100) / 100
      if (
        !potenciaFonteManual &&
        potenciaNormalizada > 0 &&
        !numbersAreClose(prev.potencia_instalada_kwp, potenciaNormalizada, 0.005)
      ) {
        next.potencia_instalada_kwp = potenciaNormalizada
        updated = true
      }

      const geracaoNormalizada = Math.round(geracaoMensalKwh * 10) / 10
      if (geracaoNormalizada > 0 && !numbersAreClose(prev.geracao_estimada_kwh_mes, geracaoNormalizada, 0.05)) {
        next.geracao_estimada_kwh_mes = geracaoNormalizada
        updated = true
      }

      if (
        deveEstimarQuantidade &&
        numeroModulosEstimado > 0 &&
        prev.quantidade_modulos !== numeroModulosEstimado
      ) {
        next.quantidade_modulos = numeroModulosEstimado
        updated = true
      }

      return updated ? next : prev
    })
    if (updated) {
      resetRetorno()
    }
  }, [
    geracaoMensalKwh,
    numeroModulosEstimado,
    potenciaInstaladaKwp,
    resetRetorno,
    potenciaFonteManual,
    vendaForm.quantidade_modulos,
    recalcularTick,
  ])

  // Sincroniza Consumo (kWh/mês) com a geração estimada sempre que o sistema
  // tiver potência suficiente para calcular geracaoMensalKwh e o consumo ainda
  // não foi editado manualmente pelo usuário (consumoManual === false).
  useEffect(() => {
    if (consumoManual) {
      return
    }

    if (geracaoMensalKwh <= 0) {
      return
    }

    const geracaoArredondada = Math.round(geracaoMensalKwh * 10) / 10

    if (numbersAreClose(kcKwhMes, geracaoArredondada, 0.05)) {
      return
    }

    setKcKwhMes(geracaoArredondada, 'auto')

    setVendaForm((prev) => {
      if (numbersAreClose(prev.consumo_kwh_mes ?? 0, geracaoArredondada, 0.05)) {
        return prev
      }
      return { ...prev, consumo_kwh_mes: geracaoArredondada }
    })

    setVendaFormErrors((prev) => {
      if (!prev.consumo_kwh_mes) {
        return prev
      }
      const { consumo_kwh_mes: _omit, ...rest } = prev
      return rest
    })
  }, [
    consumoManual,
    geracaoMensalKwh,
    kcKwhMes,
    setKcKwhMes,
    setVendaForm,
    setVendaFormErrors,
    recalcularTick,
  ])

  useEffect(() => {
    const { hsp, pr } = vendaGeracaoParametros
    if (hsp <= 0 || pr <= 0) {
      return
    }

    const potenciaManualValida =
      potenciaFonteManual &&
      Number.isFinite(vendaForm.potencia_instalada_kwp) &&
      (vendaForm.potencia_instalada_kwp ?? 0) > 0
    const potenciaBase = potenciaManualValida
      ? Number(vendaForm.potencia_instalada_kwp)
      : vendaAutoPotenciaKwp ?? null

    if (!potenciaBase || potenciaBase <= 0) {
      return
    }

    const estimada = estimateMonthlyKWh(potenciaBase, vendaGeracaoParametros)
    if (estimada <= 0) {
      return
    }

    const potenciaNormalizadaAuto = potenciaBase ? Math.round(potenciaBase * 100) / 100 : 0
    const geracaoNormalizadaAuto = Math.round(estimada * 10) / 10

    let consumoAtualizado = false
    let geracaoAtualizada = false

    setVendaForm((prev) => {
      const updates: Partial<VendaForm> = {}
      let changed = false

      if (
        potenciaNormalizadaAuto > 0 &&
        !numbersAreClose(prev.potencia_instalada_kwp, potenciaNormalizadaAuto, 0.005)
      ) {
        updates.potencia_instalada_kwp = potenciaNormalizadaAuto
        changed = true
      }

      if (
        geracaoNormalizadaAuto > 0 &&
        !numbersAreClose(prev.geracao_estimada_kwh_mes, geracaoNormalizadaAuto, 0.05)
      ) {
        updates.geracao_estimada_kwh_mes = geracaoNormalizadaAuto
        geracaoAtualizada = true
        changed = true
      }

      if (
        !consumoManual &&
        !numbersAreClose(prev.consumo_kwh_mes, geracaoNormalizadaAuto, 0.05)
      ) {
        updates.consumo_kwh_mes = geracaoNormalizadaAuto
        consumoAtualizado = true
        changed = true
      }

      if (!changed) {
        return prev
      }

      return { ...prev, ...updates }
    })

    if (consumoAtualizado) {
      setKcKwhMes(geracaoNormalizadaAuto)
      setVendaFormErrors((prev) => {
        if (!prev.consumo_kwh_mes) {
          return prev
        }
        const { consumo_kwh_mes: _omit, ...rest } = prev
        return rest
      })
    }

    if (geracaoAtualizada) {
      setVendaFormErrors((prev) => {
        if (!prev.geracao_estimada_kwh_mes) {
          return prev
        }
        const { geracao_estimada_kwh_mes: _omit, ...rest } = prev
        return rest
      })
    }
  }, [
    consumoManual,
    vendaAutoPotenciaKwp,
    potenciaFonteManual,
    vendaForm.potencia_instalada_kwp,
    vendaGeracaoParametros,
    setKcKwhMes,
    setVendaFormErrors,
    setVendaForm,
    recalcularTick,
  ])

  useEffect(() => {
    const consumoAnterior = consumoAnteriorRef.current
    if (consumoAnterior === kcKwhMes) {
      return
    }

    consumoAnteriorRef.current = kcKwhMes

    setNumeroModulosManual((valorAtual) => {
      if (valorAtual === '') {
        return valorAtual
      }

      if (kcKwhMes <= 0) {
        return ''
      }

      const valorArredondado = Math.round(Number(valorAtual))
      if (!Number.isFinite(valorArredondado)) {
        return ''
      }

      if (valorArredondado === numeroModulosCalculado) {
        return ''
      }

      return valorAtual
    })
  }, [kcKwhMes, numeroModulosCalculado, recalcularTick])

  // ── Daily generation ──────────────────────────────────────────────────────

  const geracaoDiariaKwh = useMemo(
    () => (geracaoMensalKwh > 0 && diasMesNormalizado > 0 ? geracaoMensalKwh / diasMesNormalizado : 0),
    [geracaoMensalKwh, diasMesNormalizado],
  )

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    eficienciaNormalizada,
    baseIrradiacao,
    diasMesNormalizado,
    diasMesConsiderado,
    vendaPotenciaCalculada,
    vendaAutoPotenciaKwp,
    numeroModulosEstimado,
    potenciaInstaladaKwp,
    ufNorma,
    normCompliance,
    normComplianceBanner,
    tipoRedeCompatMessage,
    ensureNormativePrecheck,
    installTypeNormalized,
    systemTypeNormalized,
    margemLucroPadraoFracao,
    comissaoPadraoFracao,
    autoBudgetFallbackMessage,
    parseUcBeneficiariaConsumo,
    consumoTotalUcsBeneficiarias,
    consumoUcsExcedeInformado,
    recalcularRateioAutomatico,
    vendaGeracaoParametros,
    areaInstalacao,
    geracaoMensalKwh,
    coletarAlertasProposta,
    confirmarAlertasGerarProposta,
    handleMultiUcToggle,
    normalizarPotenciaKwp,
    normalizarGeracaoMensal,
    calcularPotenciaSistemaKwp: calcularPotenciaSistemaKwpLocal,
    estimarGeracaoPorPotencia,
    calcularModulosPorGeracao,
    geracaoDiariaKwh,
    tipoRedeAutoSugestao,
  }
}
