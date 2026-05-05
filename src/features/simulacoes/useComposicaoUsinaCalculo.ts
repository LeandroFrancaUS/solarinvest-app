/**
 * useComposicaoUsinaCalculo.ts
 *
 * Owns all composição/CAPEX calculations for rooftop (telhado) and ground-mount
 * (solo) UFV systems, including:
 *   - composicaoTelhadoCalculo / composicaoSoloCalculo  (calcularComposicaoUFV)
 *   - capex / capexSolarInvest / custoFinalProjetadoCanonico
 *   - resumo field values and their change handlers
 *   - useLeasingValorDeMercadoEstimado
 *   - sync effects to vendaActions and vendaForm
 *
 * State (`composicaoTelhado`, `composicaoSolo`, `capexManualOverride`) is kept in
 * App.tsx and passed as params together with their setters, because those values
 * are needed for snapshot restoration and global resets.
 */

import { useCallback, useEffect, useMemo } from 'react'
import type React from 'react'
import {
  calcularComposicaoUFV,
  type Inputs as ComposicaoUFVInputs,
} from '../../lib/venda/calcComposicaoUFV'
import { calcProjectedCostsByConsumption } from '../../lib/pricing/pricingPorKwp'
import { DIAS_MES_PADRAO } from '../../app/config'
import { useBRNumberField } from '../../lib/locale/useBRNumberField'
import { useLeasingValorDeMercadoEstimado } from '../../store/useLeasingStore'
import { parseNumericInput, toNumberSafe } from '../../utils/vendasHelpers'
import type {
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
} from '../../types/printableProposal'
import type { VendasConfig } from '../../types/vendasConfig'
import type { VendasSimulacao } from '../../store/useVendasSimulacoesStore'
import { vendaActions as vendaActionsModule } from '../../store/useVendaStore'
import type { VendaForm } from '../../lib/finance/roi'

// ── Local helpers (mirrors of module-level helpers in App.tsx) ────────────────

const numbersAreClose = (
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance = 0.01,
) => {
  if (a == null && b == null) {
    return true
  }
  if (a == null || b == null) {
    return false
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false
  }
  return Math.abs(a - b) <= tolerance
}

const sumComposicaoValores = <T extends Record<string, number>>(valores: T): number => {
  return (
    Math.round(
      Object.values(valores).reduce(
        (acc, valor) => (Number.isFinite(valor) ? acc + Number(valor) : acc),
        0,
      ) * 100,
    ) / 100
  )
}

const normalizeCurrencyNumber = (value: number | null) =>
  value === null ? null : Math.round(value * 100) / 100

// ── Params ────────────────────────────────────────────────────────────────────

export interface UseComposicaoUsinaCalculoParams {
  composicaoTelhado: UfvComposicaoTelhadoValores
  setComposicaoTelhado: React.Dispatch<React.SetStateAction<UfvComposicaoTelhadoValores>>
  composicaoSolo: UfvComposicaoSoloValores
  setComposicaoSolo: React.Dispatch<React.SetStateAction<UfvComposicaoSoloValores>>
  capexManualOverride: boolean
  setCapexManualOverride: React.Dispatch<React.SetStateAction<boolean>>
  capexBaseManualValor: number | null | undefined
  arredondarPasso: number
  vendasConfig: VendasConfig
  margemManualAtiva: boolean
  margemManualValor: number | undefined
  descontosValor: number
  valorOrcamentoConsiderado: number
  tipoInstalacao: string
  analiseFinanceiraResult: {
    preco_ideal_rs?: number | null
    preco_minimo_saudavel_rs?: number | null
  } | null | undefined
  autoCustoFinal: number | null
  modoOrcamento: string
  recalcularTick: number
  custoImplantacaoReferencia: number | null | undefined
  vendaActions: typeof vendaActionsModule
  currentBudgetId: string
  updateVendasSimulacao: (id: string, data: Partial<VendasSimulacao>) => void
  updateVendasConfig: (data: Partial<VendasConfig>) => void
  kcKwhMes: number
  ufTarifa: string
  tarifaCheia: number
  desconto: number
  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number
  potenciaInstaladaKwp: number
  potenciaModulo: number
  precoPorKwp: number
  margemLucroPadraoFracao: number
  comissaoPadraoFracao: number
  setVendaForm: React.Dispatch<React.SetStateAction<VendaForm>>
  setVendaFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  resetRetorno: () => void
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseComposicaoUsinaCalculoReturn {
  // Handlers
  handleComposicaoTelhadoChange: (campo: keyof UfvComposicaoTelhadoValores, valor: string) => void
  handleComposicaoSoloChange: (campo: keyof UfvComposicaoSoloValores, valor: string) => void
  handleMargemManualInput: (valor: number | null) => void
  handleCapexBaseResumoChange: (valor: number | null) => void
  handleMargemOperacionalResumoChange: (valor: number | null) => void
  // Calculations
  composicaoTelhadoCalculo: ReturnType<typeof calcularComposicaoUFV> | undefined
  composicaoSoloCalculo: ReturnType<typeof calcularComposicaoUFV> | undefined
  capexBaseResumoValor: number
  margemOperacionalResumoValor: number | null
  capexBaseResumoField: ReturnType<typeof useBRNumberField>
  capexBaseResumoSettingsField: ReturnType<typeof useBRNumberField>
  margemOperacionalResumoField: ReturnType<typeof useBRNumberField>
  margemOperacionalResumoSettingsField: ReturnType<typeof useBRNumberField>
  composicaoTelhadoTotal: number
  composicaoSoloTotal: number
  valorVendaTelhado: number
  valorVendaSolo: number
  valorVendaAtual: number
  capex: number
  custoFinalProjetadoCanonico: number
  capexSolarInvest: number
  leasingValorDeMercadoEstimado: ReturnType<typeof useLeasingValorDeMercadoEstimado>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useComposicaoUsinaCalculo(
  params: UseComposicaoUsinaCalculoParams,
): UseComposicaoUsinaCalculoReturn {
  const {
    composicaoTelhado,
    setComposicaoTelhado,
    composicaoSolo,
    setComposicaoSolo,
    capexManualOverride,
    capexBaseManualValor,
    arredondarPasso,
    vendasConfig,
    margemManualAtiva,
    margemManualValor,
    descontosValor,
    valorOrcamentoConsiderado,
    tipoInstalacao,
    analiseFinanceiraResult,
    autoCustoFinal,
    modoOrcamento,
    recalcularTick,
    custoImplantacaoReferencia,
    vendaActions,
    currentBudgetId,
    updateVendasSimulacao,
    updateVendasConfig,
    kcKwhMes,
    ufTarifa,
    tarifaCheia,
    desconto,
    baseIrradiacao,
    eficienciaNormalizada,
    diasMesNormalizado,
    potenciaInstaladaKwp,
    potenciaModulo,
    precoPorKwp,
    margemLucroPadraoFracao,
    comissaoPadraoFracao,
    setVendaForm,
    setVendaFormErrors,
    resetRetorno,
  } = params

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleComposicaoTelhadoChange = useCallback(
    (campo: keyof UfvComposicaoTelhadoValores, valor: string) => {
      const parsed = parseNumericInput(valor)
      const normalizado = normalizeCurrencyNumber(parsed)
      const finalValue = normalizado === null ? 0 : normalizado
      setComposicaoTelhado((prev) => {
        if (prev[campo] === finalValue) {
          return prev
        }
        return { ...prev, [campo]: finalValue }
      })
      if (campo === 'lucroBruto') {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: finalValue })
      }
    },
    [currentBudgetId, updateVendasSimulacao, setComposicaoTelhado],
  )

  const handleComposicaoSoloChange = useCallback(
    (campo: keyof UfvComposicaoSoloValores, valor: string) => {
      const parsed = parseNumericInput(valor)
      const normalizado = normalizeCurrencyNumber(parsed)
      const finalValue = normalizado === null ? 0 : normalizado
      setComposicaoSolo((prev) => {
        if (prev[campo] === finalValue) {
          return prev
        }
        return { ...prev, [campo]: finalValue }
      })
      if (campo === 'lucroBruto') {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: finalValue })
      }
    },
    [currentBudgetId, updateVendasSimulacao, setComposicaoSolo],
  )

  const handleMargemManualInput = useCallback(
    (valor: number | null) => {
      if (valor === null || !Number.isFinite(valor)) {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: null })
        return
      }
      const finalValue = normalizeCurrencyNumber(valor)
      if (finalValue === null) {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: null })
        return
      }
      updateVendasSimulacao(currentBudgetId, { margemManualValor: finalValue })
      setComposicaoTelhado((prev) =>
        numbersAreClose(prev.lucroBruto, finalValue) ? prev : { ...prev, lucroBruto: finalValue },
      )
      setComposicaoSolo((prev) =>
        numbersAreClose(prev.lucroBruto, finalValue) ? prev : { ...prev, lucroBruto: finalValue },
      )
    },
    [currentBudgetId, updateVendasSimulacao, setComposicaoTelhado, setComposicaoSolo],
  )

  const handleCapexBaseResumoChange = useCallback(
    (valor: number | null) => {
      if (valor === null) {
        updateVendasSimulacao(currentBudgetId, { capexBaseManual: null })
        return
      }
      const sanitized = Number.isFinite(valor) ? Math.max(0, Number(valor)) : 0
      updateVendasSimulacao(currentBudgetId, { capexBaseManual: sanitized })
    },
    [currentBudgetId, updateVendasSimulacao],
  )

  // ── Composição calculations ──────────────────────────────────────────────────

  const composicaoTelhadoCalculo = useMemo(() => {
    const input: ComposicaoUFVInputs = {
      projeto: toNumberSafe(composicaoTelhado.projeto),
      instalacao: toNumberSafe(composicaoTelhado.instalacao),
      material_ca: toNumberSafe(composicaoTelhado.materialCa),
      crea: toNumberSafe(composicaoTelhado.crea),
      art: toNumberSafe(composicaoTelhado.art),
      placa: toNumberSafe(composicaoTelhado.placa),
      capex_base_manual: capexBaseManualValor ?? null,
      comissao_liquida_input: toNumberSafe(composicaoTelhado.comissaoLiquida),
      comissao_tipo: vendasConfig.comissao_default_tipo,
      comissao_percent_base: vendasConfig.comissao_percent_base,
      teto_comissao_percent: vendasConfig.teto_comissao_percent,
      margem_operacional_padrao_percent: vendasConfig.margem_operacional_padrao_percent,
      margem_manual_valor:
        margemManualAtiva && margemManualValor !== undefined ? margemManualValor : null,
      usar_margem_manual: margemManualAtiva,
      valor_total_orcamento: valorOrcamentoConsiderado,
      descontos: toNumberSafe(descontosValor),
      preco_minimo_percent_sobre_capex: vendasConfig.preco_minimo_percent_sobre_capex,
      arredondar_venda_para: arredondarPasso,
      desconto_max_percent_sem_aprovacao: vendasConfig.desconto_max_percent_sem_aprovacao,
      workflow_aprovacao_ativo: vendasConfig.workflow_aprovacao_ativo,
      regime: vendasConfig.regime_tributario_default,
      imposto_retido_aliquota: toNumberSafe(vendasConfig.imposto_retido_aliquota_default),
      incluirImpostosNoCAPEX: vendasConfig.incluirImpostosNoCAPEX_default,
      ...(vendasConfig.impostosRegime_overrides
        ? { impostosRegime: vendasConfig.impostosRegime_overrides }
        : {}),
    }

    return calcularComposicaoUFV(input)
  }, [
    capexBaseManualValor,
    arredondarPasso,
    composicaoTelhado.art,
    composicaoTelhado.crea,
    composicaoTelhado.instalacao,
    composicaoTelhado.materialCa,
    composicaoTelhado.placa,
    composicaoTelhado.projeto,
    composicaoTelhado.comissaoLiquida,
    descontosValor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
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
    recalcularTick,
  ])

  const composicaoSoloCalculo = useMemo(() => {
    const extrasSolo =
      toNumberSafe(composicaoSolo.estruturaSolo) +
      toNumberSafe(composicaoSolo.tela) +
      toNumberSafe(composicaoSolo.portaoTela) +
      toNumberSafe(composicaoSolo.maoObraTela) +
      toNumberSafe(composicaoSolo.casaInversor) +
      toNumberSafe(composicaoSolo.brita) +
      toNumberSafe(composicaoSolo.terraplanagem) +
      toNumberSafe(composicaoSolo.trafo) +
      toNumberSafe(composicaoSolo.rede)

    const input: ComposicaoUFVInputs = {
      projeto: toNumberSafe(composicaoSolo.projeto),
      instalacao: toNumberSafe(composicaoSolo.instalacao),
      material_ca: toNumberSafe(composicaoSolo.materialCa) + extrasSolo,
      crea: toNumberSafe(composicaoSolo.crea),
      art: toNumberSafe(composicaoSolo.art),
      placa: toNumberSafe(composicaoSolo.placa),
      capex_base_manual: capexBaseManualValor ?? null,
      comissao_liquida_input: toNumberSafe(composicaoSolo.comissaoLiquida),
      comissao_tipo: vendasConfig.comissao_default_tipo,
      comissao_percent_base: vendasConfig.comissao_percent_base,
      teto_comissao_percent: vendasConfig.teto_comissao_percent,
      margem_operacional_padrao_percent: vendasConfig.margem_operacional_padrao_percent,
      margem_manual_valor:
        margemManualAtiva && margemManualValor !== undefined ? margemManualValor : null,
      usar_margem_manual: margemManualAtiva,
      valor_total_orcamento: valorOrcamentoConsiderado,
      descontos: toNumberSafe(descontosValor),
      preco_minimo_percent_sobre_capex: vendasConfig.preco_minimo_percent_sobre_capex,
      arredondar_venda_para: arredondarPasso,
      desconto_max_percent_sem_aprovacao: vendasConfig.desconto_max_percent_sem_aprovacao,
      workflow_aprovacao_ativo: vendasConfig.workflow_aprovacao_ativo,
      regime: vendasConfig.regime_tributario_default,
      imposto_retido_aliquota: toNumberSafe(vendasConfig.imposto_retido_aliquota_default),
      incluirImpostosNoCAPEX: vendasConfig.incluirImpostosNoCAPEX_default,
      ...(vendasConfig.impostosRegime_overrides
        ? { impostosRegime: vendasConfig.impostosRegime_overrides }
        : {}),
    }

    return calcularComposicaoUFV(input)
  }, [
    capexBaseManualValor,
    arredondarPasso,
    composicaoSolo.art,
    composicaoSolo.crea,
    composicaoSolo.instalacao,
    composicaoSolo.materialCa,
    composicaoSolo.placa,
    composicaoSolo.projeto,
    composicaoSolo.comissaoLiquida,
    composicaoSolo.estruturaSolo,
    composicaoSolo.tela,
    composicaoSolo.portaoTela,
    composicaoSolo.maoObraTela,
    composicaoSolo.casaInversor,
    composicaoSolo.brita,
    composicaoSolo.terraplanagem,
    composicaoSolo.trafo,
    composicaoSolo.rede,
    descontosValor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
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
    recalcularTick,
  ])

  const capexBaseResumoValor = useMemo(() => {
    if (typeof capexBaseManualValor === 'number') {
      return capexBaseManualValor
    }
    const calculoAtual =
      tipoInstalacao === 'solo' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valor = calculoAtual?.capex_base
    return Number.isFinite(valor ?? Number.NaN) ? Math.max(0, Number(valor)) : 0
  }, [capexBaseManualValor, tipoInstalacao, composicaoSoloCalculo, composicaoTelhadoCalculo])

  const margemOperacionalResumoValor = useMemo(() => {
    if (margemManualAtiva && margemManualValor !== undefined) {
      return margemManualValor
    }
    const calculoAtual =
      tipoInstalacao === 'solo' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valor = calculoAtual?.margem_operacional_valor
    if (!Number.isFinite(valor ?? Number.NaN)) {
      return null
    }
    return Math.round(Number(valor) * 100) / 100
  }, [
    margemManualAtiva,
    margemManualValor,
    tipoInstalacao,
    composicaoSoloCalculo?.margem_operacional_valor,
    composicaoTelhadoCalculo?.margem_operacional_valor,
  ])

  const handleMargemOperacionalResumoChange = useCallback(
    (valor: number | null) => {
      if (valor === null || !Number.isFinite(valor)) {
        handleMargemManualInput(null)
        return
      }
      const finalValue = normalizeCurrencyNumber(valor)
      if (finalValue === null) {
        handleMargemManualInput(null)
        return
      }
      handleMargemManualInput(finalValue)

      const capexBaseAtual =
        tipoInstalacao === 'solo'
          ? composicaoSoloCalculo?.capex_base
          : composicaoTelhadoCalculo?.capex_base

      const baseComOrcamento = (capexBaseAtual ?? 0) + Math.max(0, valorOrcamentoConsiderado)

      if (Number.isFinite(baseComOrcamento) && baseComOrcamento > 0) {
        const percent = (finalValue / baseComOrcamento) * 100
        const percentClamped = Math.min(Math.max(percent, 0), 80)
        const percentNormalizado = Math.round(percentClamped * 10000) / 10000
        if (
          !numbersAreClose(
            percentNormalizado,
            vendasConfig.margem_operacional_padrao_percent,
            0.0001,
          )
        ) {
          updateVendasConfig({ margem_operacional_padrao_percent: percentNormalizado })
        }
      }
    },
    [
      composicaoSoloCalculo?.capex_base,
      composicaoTelhadoCalculo?.capex_base,
      handleMargemManualInput,
      tipoInstalacao,
      updateVendasConfig,
      valorOrcamentoConsiderado,
      vendasConfig.margem_operacional_padrao_percent,
    ],
  )

  const capexBaseResumoField = useBRNumberField({
    mode: 'money',
    value: capexBaseResumoValor,
    onChange: handleCapexBaseResumoChange,
  })

  const capexBaseResumoSettingsField = useBRNumberField({
    mode: 'money',
    value: capexBaseResumoValor,
    onChange: handleCapexBaseResumoChange,
  })

  const margemOperacionalResumoField = useBRNumberField({
    mode: 'money',
    value: margemOperacionalResumoValor ?? null,
    onChange: handleMargemOperacionalResumoChange,
  })

  const margemOperacionalResumoSettingsField = useBRNumberField({
    mode: 'money',
    value: margemOperacionalResumoValor ?? null,
    onChange: handleMargemOperacionalResumoChange,
  })

  useEffect(() => {
    const calculoAtual =
      tipoInstalacao === 'solo' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valores = calculoAtual ?? {
      capex_base: 0,
      margem_operacional_valor: 0,
      venda_total: 0,
      venda_liquida: 0,
      comissao_liquida_valor: 0,
      imposto_retido_valor: 0,
      impostos_regime_valor: 0,
      impostos_totais_valor: 0,
      capex_total: 0,
      total_contrato_R$: 0,
      regime_breakdown: [],
    }

    vendaActions.updateComposicao({
      ...valores,
      regime_breakdown: valores.regime_breakdown.map((item) => ({ ...item })),
      descontos: toNumberSafe(descontosValor),
    })
    const custoReferencia = Number.isFinite(valores.capex_total)
      ? Number(valores.capex_total)
      : null
    if (custoImplantacaoReferencia == null) {
      vendaActions.updateResumoProposta({ custo_implantacao_referencia: custoReferencia })
    }
  }, [
    descontosValor,
    composicaoSoloCalculo,
    composicaoTelhadoCalculo,
    custoImplantacaoReferencia,
    tipoInstalacao,
    recalcularTick,
    vendaActions,
  ])

  const composicaoTelhadoTotal = useMemo(() => {
    if (composicaoTelhadoCalculo) {
      return Math.round(composicaoTelhadoCalculo.venda_total * 100) / 100
    }
    return sumComposicaoValores(composicaoTelhado)
  }, [composicaoTelhadoCalculo, composicaoTelhado])

  const composicaoSoloTotal = useMemo(() => {
    if (composicaoSoloCalculo) {
      return Math.round(composicaoSoloCalculo.venda_total * 100) / 100
    }
    return sumComposicaoValores(composicaoSolo)
  }, [composicaoSoloCalculo, composicaoSolo])

  const valorVendaTelhado = useMemo(() => {
    const capexBaseCalculadoValor = Number(composicaoTelhadoCalculo?.capex_base)
    const capexBaseFallback =
      toNumberSafe(composicaoTelhado.projeto) +
      toNumberSafe(composicaoTelhado.instalacao) +
      toNumberSafe(composicaoTelhado.materialCa) +
      toNumberSafe(composicaoTelhado.crea) +
      toNumberSafe(composicaoTelhado.art) +
      toNumberSafe(composicaoTelhado.placa)
    const capexBase = Number.isFinite(capexBaseCalculadoValor)
      ? Math.max(0, capexBaseCalculadoValor)
      : Math.max(0, capexBaseFallback)

    const margemManualValorNormalizado = Number(margemManualValor)
    const margemManualNormalizada =
      margemManualAtiva && Number.isFinite(margemManualValorNormalizado)
        ? Math.max(0, margemManualValorNormalizado)
        : null
    const margemCalculadaValor = Number(composicaoTelhadoCalculo?.margem_operacional_valor)
    const margemOperacional =
      margemManualNormalizada ??
      (Number.isFinite(margemCalculadaValor)
        ? Math.max(0, margemCalculadaValor)
        : Math.max(0, toNumberSafe(composicaoTelhado.lucroBruto)))

    const total = Math.max(0, valorOrcamentoConsiderado) + capexBase + margemOperacional

    return Math.round(total * 100) / 100
  }, [
    composicaoTelhado.art,
    composicaoTelhado.crea,
    composicaoTelhado.instalacao,
    composicaoTelhado.lucroBruto,
    composicaoTelhado.materialCa,
    composicaoTelhado.placa,
    composicaoTelhado.projeto,
    composicaoTelhadoCalculo?.capex_base,
    composicaoTelhadoCalculo?.margem_operacional_valor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
  ])

  const valorVendaSolo = useMemo(() => {
    const capexBaseCalculadoValor = Number(composicaoSoloCalculo?.capex_base)
    const extrasSolo =
      toNumberSafe(composicaoSolo.estruturaSolo) +
      toNumberSafe(composicaoSolo.tela) +
      toNumberSafe(composicaoSolo.portaoTela) +
      toNumberSafe(composicaoSolo.maoObraTela) +
      toNumberSafe(composicaoSolo.casaInversor) +
      toNumberSafe(composicaoSolo.brita) +
      toNumberSafe(composicaoSolo.terraplanagem) +
      toNumberSafe(composicaoSolo.trafo) +
      toNumberSafe(composicaoSolo.rede)
    const capexBaseFallback =
      toNumberSafe(composicaoSolo.projeto) +
      toNumberSafe(composicaoSolo.instalacao) +
      (toNumberSafe(composicaoSolo.materialCa) + extrasSolo) +
      toNumberSafe(composicaoSolo.crea) +
      toNumberSafe(composicaoSolo.art) +
      toNumberSafe(composicaoSolo.placa)
    const capexBase = Number.isFinite(capexBaseCalculadoValor)
      ? Math.max(0, capexBaseCalculadoValor)
      : Math.max(0, capexBaseFallback)

    const margemManualValorNormalizado = Number(margemManualValor)
    const margemManualNormalizada =
      margemManualAtiva && Number.isFinite(margemManualValorNormalizado)
        ? Math.max(0, margemManualValorNormalizado)
        : null
    const margemCalculadaValor = Number(composicaoSoloCalculo?.margem_operacional_valor)
    const margemOperacional =
      margemManualNormalizada ??
      (Number.isFinite(margemCalculadaValor)
        ? Math.max(0, margemCalculadaValor)
        : Math.max(0, toNumberSafe(composicaoSolo.lucroBruto)))

    const total = Math.max(0, valorOrcamentoConsiderado) + capexBase + margemOperacional

    return Math.round(total * 100) / 100
  }, [
    composicaoSolo.art,
    composicaoSolo.brita,
    composicaoSolo.casaInversor,
    composicaoSolo.crea,
    composicaoSolo.instalacao,
    composicaoSolo.lucroBruto,
    composicaoSolo.maoObraTela,
    composicaoSolo.materialCa,
    composicaoSolo.placa,
    composicaoSolo.portaoTela,
    composicaoSolo.projeto,
    composicaoSolo.rede,
    composicaoSolo.estruturaSolo,
    composicaoSolo.tela,
    composicaoSolo.terraplanagem,
    composicaoSolo.trafo,
    composicaoSoloCalculo?.capex_base,
    composicaoSoloCalculo?.margem_operacional_valor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
  ])

  useEffect(() => {
    const margemCalculada =
      margemManualAtiva && margemManualValor !== undefined
        ? margemManualValor
        : (tipoInstalacao === 'solo'
            ? composicaoSoloCalculo?.margem_operacional_valor
            : composicaoTelhadoCalculo?.margem_operacional_valor) ?? 0
    setComposicaoTelhado((prev) =>
      numbersAreClose(prev.lucroBruto, margemCalculada)
        ? prev
        : { ...prev, lucroBruto: margemCalculada },
    )
    setComposicaoSolo((prev) =>
      numbersAreClose(prev.lucroBruto, margemCalculada)
        ? prev
        : { ...prev, lucroBruto: margemCalculada },
    )
  }, [
    margemManualAtiva,
    margemManualValor,
    composicaoTelhadoCalculo?.margem_operacional_valor,
    composicaoSoloCalculo?.margem_operacional_valor,
    tipoInstalacao,
    recalcularTick,
    setComposicaoTelhado,
    setComposicaoSolo,
  ])

  const valorVendaAtual = tipoInstalacao === 'solo' ? valorVendaSolo : valorVendaTelhado

  const capex = useMemo(() => {
    const projected = calcProjectedCostsByConsumption({
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
    if (projected) {
      return Math.max(0, projected.custoBaseProjeto)
    }
    return potenciaInstaladaKwp * precoPorKwp
  }, [
    baseIrradiacao,
    kcKwhMes,
    desconto,
    diasMesNormalizado,
    eficienciaNormalizada,
    potenciaInstaladaKwp,
    potenciaModulo,
    precoPorKwp,
    tarifaCheia,
    ufTarifa,
    margemLucroPadraoFracao,
    comissaoPadraoFracao,
  ])

  const custoFinalProjetadoCanonico = useMemo(() => {
    // Este valor é o "Preço ideal" da Análise Financeira — corresponde ao
    // valorBaseOriginalAtivo (VM contratual) para o cálculo de buyout.
    // Prioridade:
    //   1. preco_ideal_rs     — "Preço Ideal" da AF (venda com margem-alvo configurada).
    //      É o valor canônico exibido na página de Análise Financeira como "Preço Ideal".
    //   2. preco_minimo_saudavel_rs — fallback quando preco_ideal não está disponível
    //      (ex.: modo leasing, ou sem margem-alvo configurada).
    //   3. autoCustoFinal     — engine de auto-pricing (quando modoOrcamento === 'auto').
    //   4. valorVendaAtual    — valor informado manualmente.
    //   5. capex              — CAPEX bruto como último recurso.
    // NÃO confundir com CAPEX do orçamento PDF nem com mensalidade.
    const precoIdeal = analiseFinanceiraResult?.preco_ideal_rs
    if (Number.isFinite(precoIdeal) && precoIdeal != null && precoIdeal > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'preco_ideal_rs',
        value: precoIdeal,
        isReady: true,
      })
      return precoIdeal
    }

    const precoMinSaudavel = analiseFinanceiraResult?.preco_minimo_saudavel_rs
    if (Number.isFinite(precoMinSaudavel) && precoMinSaudavel != null && precoMinSaudavel > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'preco_minimo_saudavel_rs',
        value: precoMinSaudavel,
        isReady: true,
      })
      return precoMinSaudavel
    }

    const auto = Number(autoCustoFinal)
    if (modoOrcamento === 'auto' && Number.isFinite(auto) && auto > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'autoCustoFinal',
        value: auto,
        isReady: true,
      })
      return auto
    }

    const venda = Number(valorVendaAtual)
    if (Number.isFinite(venda) && venda > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'valorVendaAtual',
        value: venda,
        isReady: true,
      })
      return venda
    }

    console.info('[current-sale-value] recompute', {
      source: 'capex-fallback',
      value: Math.max(0, capex),
      isReady: false,
      reasons: [
        analiseFinanceiraResult == null
          ? 'analiseFinanceiraResult ausente (afCustoKit <= 0 ou consumo <= 0?)'
          : null,
        !analiseFinanceiraResult?.preco_ideal_rs ? 'preco_ideal_rs ausente' : null,
        !analiseFinanceiraResult?.preco_minimo_saudavel_rs
          ? 'preco_minimo_saudavel_rs ausente'
          : null,
      ].filter(Boolean),
    })
    return Math.max(0, capex)
  }, [analiseFinanceiraResult, autoCustoFinal, capex, modoOrcamento, valorVendaAtual])

  const capexSolarInvest = useMemo(
    () => Math.max(0, custoFinalProjetadoCanonico * 0.7),
    [custoFinalProjetadoCanonico],
  )

  const leasingValorDeMercadoEstimado = useLeasingValorDeMercadoEstimado()

  useEffect(() => {
    if (capexManualOverride) {
      return
    }
    const valorVendaBruto =
      Number.isFinite(valorVendaAtual) && valorVendaAtual > 0 ? valorVendaAtual : 0
    const normalizedCapex = Math.max(valorVendaBruto - descontosValor, 0)
    let changed = false
    setVendaForm((prev) => {
      if (Math.abs((prev.capex_total ?? 0) - normalizedCapex) < 0.005) {
        return prev
      }
      changed = true
      return { ...prev, capex_total: normalizedCapex }
    })
    if (changed) {
      setVendaFormErrors((prev) => {
        if (!prev.capex_total) {
          return prev
        }
        const { capex_total: _removed, ...rest } = prev
        return rest
      })
      resetRetorno()
    }
  }, [
    capexManualOverride,
    descontosValor,
    resetRetorno,
    valorVendaAtual,
    recalcularTick,
    setVendaForm,
    setVendaFormErrors,
  ])

  return {
    handleComposicaoTelhadoChange,
    handleComposicaoSoloChange,
    handleMargemManualInput,
    handleCapexBaseResumoChange,
    handleMargemOperacionalResumoChange,
    composicaoTelhadoCalculo,
    composicaoSoloCalculo,
    capexBaseResumoValor,
    margemOperacionalResumoValor,
    capexBaseResumoField,
    capexBaseResumoSettingsField,
    margemOperacionalResumoField,
    margemOperacionalResumoSettingsField,
    composicaoTelhadoTotal,
    composicaoSoloTotal,
    valorVendaTelhado,
    valorVendaSolo,
    valorVendaAtual,
    capex,
    custoFinalProjetadoCanonico,
    capexSolarInvest,
    leasingValorDeMercadoEstimado,
  }
}
