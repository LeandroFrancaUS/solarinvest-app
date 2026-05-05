/**
 * useBudgetUploadState.ts
 *
 * Owns the kit-budget processing state and all related handlers:
 *   - budgetId tracking (budgetIdRef, currentBudgetId, switchBudgetId)
 *   - kit budget items (kitBudget, CRUD callbacks, totals)
 *   - upload processing flags (isBudgetProcessing, budgetProcessingError, …)
 *   - modoOrcamento + auto-override detection (isManualBudgetForced)
 *   - derived memos: budgetItemsTotal, budgetMissingSummary, kitBudgetTotal,
 *     valorOrcamentoConsiderado
 *
 * Params:
 *   - renameVendasSimulacao — store action for budget-id rename
 *   - tipoInstalacao        — from App.tsx (drives isManualBudgetForced)
 *   - tipoSistema           — from App.tsx (drives isManualBudgetForced)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createEmptyKitBudget,
  type KitBudgetItemState,
  type KitBudgetMissingInfo,
  type KitBudgetState,
} from '../../app/config'
import {
  DEFAULT_OCR_DPI,
  type BudgetUploadProgress,
} from '../../app/services/budgetUpload'
import { analyzeEssentialInfo } from '../../utils/moduleDetection'
import { parseNumericInput } from '../../utils/vendasHelpers'
import { formatMoneyBR } from '../../lib/locale/br-number'
import { createDraftBudgetId as createDraftBudgetIdHelper } from '../../features/propostas/proposalHelpers'
import type { TipoInstalacao } from '../../shared/ufvComposicao'
import type { TipoSistema } from '../../lib/finance/roi'
import type { StructuredItem } from '../../utils/structuredBudgetParser'
import type { Rede } from '../../lib/pricing/pricingPorKwp'

// ---------------------------------------------------------------------------
// Module-level pure helpers (no React dependencies)
// ---------------------------------------------------------------------------

const numbersAreClose = (
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance = 0.01,
): boolean => {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= tolerance
}

const formatCurrencyInputValue = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return ''
  return formatMoneyBR(value)
}

const normalizeCurrencyNumber = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100

const computeBudgetItemsTotalValue = (items: KitBudgetItemState[]): number | null => {
  if (!items.length) return null
  let total = 0
  for (const item of items) {
    if (item.wasQuantityInferred || item.quantity === null || item.unitPrice === null) {
      return null
    }
    total += item.quantity * item.unitPrice
  }
  return Math.round(total * 100) / 100
}

const computeBudgetMissingInfo = (items: KitBudgetItemState[]): KitBudgetMissingInfo => {
  if (!items.length) return null
  return analyzeEssentialInfo(
    items.map((item) => ({
      id: item.id,
      product: item.productName,
      description: item.description,
      quantity: item.wasQuantityInferred ? null : item.quantity,
    })),
  )
}

const formatList = (values: string[]): string => {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]!
  if (values.length === 2) return `${values[0]!} e ${values[1]!}`
  const [last, ...rest] = values.slice().reverse()
  return `${rest.reverse().join(', ')} e ${last}`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseBudgetUploadStateParams {
  renameVendasSimulacao: (prevId: string, nextId: string) => void
  tipoInstalacao: TipoInstalacao
  tipoSistema: TipoSistema
}

export function useBudgetUploadState({
  renameVendasSimulacao,
  tipoInstalacao,
  tipoSistema,
}: UseBudgetUploadStateParams) {
  // Budget identity tracking
  const budgetIdRef = useRef<string>(createDraftBudgetIdHelper())
  const budgetIdTransitionRef = useRef(false)
  const [currentBudgetId, setCurrentBudgetId] = useState<string>(budgetIdRef.current)

  // Structured items (from OCR/upload)
  const [budgetStructuredItems, setBudgetStructuredItems] = useState<StructuredItem[]>([])

  // DOM ref for the hidden file-input used to upload budget files
  const budgetUploadInputRef = useRef<HTMLInputElement | null>(null)

  // Kit budget items & processing
  const [kitBudget, setKitBudget] = useState<KitBudgetState>(() => createEmptyKitBudget())
  const [isBudgetProcessing, setIsBudgetProcessing] = useState(false)
  const [budgetProcessingError, setBudgetProcessingError] = useState<string | null>(null)
  const [budgetProcessingProgress, setBudgetProcessingProgress] =
    useState<BudgetUploadProgress | null>(null)
  const [ocrDpi, setOcrDpi] = useState(DEFAULT_OCR_DPI)
  const [isBudgetTableCollapsed, setIsBudgetTableCollapsed] = useState(false)

  // Budget mode
  const [modoOrcamento, setModoOrcamento] = useState<'auto' | 'manual'>('auto')
  const [autoKitValor, setAutoKitValor] = useState<number | null>(null)
  const [autoCustoFinal, setAutoCustoFinal] = useState<number | null>(null)
  const [autoPricingRede, setAutoPricingRede] = useState<Rede | null>(null)
  const [autoPricingVersion, setAutoPricingVersion] = useState<string | null>(null)
  const [autoBudgetReasonCode, setAutoBudgetReasonCode] = useState<string | null>(null)
  const [autoBudgetReason, setAutoBudgetReason] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Derived — manual-budget forced by installation/system type
  // -------------------------------------------------------------------------
  const isManualBudgetForced = useMemo(
    () =>
      tipoInstalacao === 'solo' ||
      tipoInstalacao === 'outros' ||
      tipoSistema === 'HIBRIDO' ||
      tipoSistema === 'OFF_GRID',
    [tipoInstalacao, tipoSistema],
  )

  const manualBudgetForceReason = useMemo(() => {
    const reasons: string[] = []
    if (tipoInstalacao === 'solo' || tipoInstalacao === 'outros') {
      reasons.push('instalações em solo ou outros formatos')
    }
    if (tipoSistema === 'HIBRIDO' || tipoSistema === 'OFF_GRID') {
      reasons.push('sistemas híbridos ou off-grid')
    }
    return reasons.length > 0
      ? `Modo automático indisponível para ${reasons.join(' ou ')}.`
      : ''
  }, [tipoInstalacao, tipoSistema])

  // -------------------------------------------------------------------------
  // Auto-switch modoOrcamento when forced
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isManualBudgetForced && modoOrcamento !== 'manual') {
      setModoOrcamento('manual')
    }
  }, [isManualBudgetForced, modoOrcamento])

  // -------------------------------------------------------------------------
  // Budget ID callbacks
  // -------------------------------------------------------------------------
  const getActiveBudgetId = useCallback(() => budgetIdRef.current, [])

  const switchBudgetId = useCallback(
    (nextId: string) => {
      const prevId = getActiveBudgetId()
      if (!nextId || nextId === prevId) return

      try {
        renameVendasSimulacao(prevId, nextId)
      } catch (error) {
        console.warn('[switchBudgetId] rename failed', error)
      }
      budgetIdTransitionRef.current = true
      budgetIdRef.current = nextId
      setCurrentBudgetId(nextId)
    },
    [getActiveBudgetId, renameVendasSimulacao],
  )

  // -------------------------------------------------------------------------
  // Budget-mode change handler
  // -------------------------------------------------------------------------
  const handleModoOrcamentoChange = useCallback(
    (value: 'auto' | 'manual') => {
      if (value === 'auto' && isManualBudgetForced) return
      setModoOrcamento(value)
    },
    [isManualBudgetForced],
  )

  // -------------------------------------------------------------------------
  // valorOrcamentoConsiderado
  // -------------------------------------------------------------------------
  const valorOrcamentoConsiderado = useMemo(() => {
    const total = kitBudget.total
    return typeof total === 'number' && Number.isFinite(total) ? total : 0
  }, [kitBudget.total])

  // -------------------------------------------------------------------------
  // Budget item totals
  // -------------------------------------------------------------------------
  const budgetItemsTotal = useMemo(
    () => computeBudgetItemsTotalValue(kitBudget.items),
    [kitBudget.items],
  )

  const budgetMissingSummary = useMemo(() => {
    const info = kitBudget?.missingInfo
    if (!info || !info.modules || !info.inverter || kitBudget.items.length === 0) return null
    const fieldSet = new Set<string>()
    const moduleFields = Array.isArray(info.modules.missingFields) ? info.modules.missingFields : []
    const inverterFields = Array.isArray(info.inverter.missingFields)
      ? info.inverter.missingFields
      : []
    moduleFields.forEach((field) => fieldSet.add(field))
    inverterFields.forEach((field) => fieldSet.add(field))
    if (fieldSet.size === 0) return null
    const fieldsText = formatList(Array.from(fieldSet))
    return { info, fieldsText }
  }, [kitBudget.items.length, kitBudget.missingInfo])

  // Sync calculated total back into kitBudget when items change
  useEffect(() => {
    if (kitBudget.totalSource !== 'calculated') return
    const nextTotal = budgetItemsTotal
    const formatted = formatCurrencyInputValue(nextTotal)
    if (numbersAreClose(nextTotal, kitBudget.total) && formatted === kitBudget.totalInput) return
    setKitBudget((prev) => ({
      ...prev,
      total: nextTotal,
      totalInput: formatted,
    }))
  }, [budgetItemsTotal, kitBudget.totalSource, kitBudget.total, kitBudget.totalInput])

  // -------------------------------------------------------------------------
  // Kit budget item handlers
  // -------------------------------------------------------------------------
  const updateKitBudgetItem = useCallback(
    (itemId: string, updater: (item: KitBudgetItemState) => KitBudgetItemState) => {
      setKitBudget((prev) => {
        const safeItems = Array.isArray(prev?.items) ? prev.items : []
        const nextItems = safeItems.map((item) => (item.id === itemId ? updater(item) : item))
        return {
          ...prev,
          items: nextItems,
          missingInfo: computeBudgetMissingInfo(nextItems),
        }
      })
    },
    [],
  )

  const handleBudgetItemTextChange = useCallback(
    (itemId: string, field: 'productName' | 'description', value: string) => {
      updateKitBudgetItem(itemId, (item) => ({ ...item, [field]: value }))
    },
    [updateKitBudgetItem],
  )

  const handleBudgetItemQuantityChange = useCallback(
    (itemId: string, value: string) => {
      const parsed = parseNumericInput(value)
      const isValidQuantity = typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
      updateKitBudgetItem(itemId, (item) => ({
        ...item,
        quantity: isValidQuantity ? Math.round(parsed) : null,
        quantityInput: value,
        wasQuantityInferred: !isValidQuantity,
      }))
    },
    [updateKitBudgetItem],
  )

  const handleRemoveBudgetItem = useCallback((itemId: string) => {
    setKitBudget((prev) => {
      const nextItems = prev.items.filter((item) => item.id !== itemId)
      return {
        ...prev,
        items: nextItems,
        missingInfo: computeBudgetMissingInfo(nextItems),
      }
    })
  }, [])

  const handleAddBudgetItem = useCallback(() => {
    const baseId = Date.now().toString(36)
    setKitBudget((prev) => {
      const nextItems = [
        ...prev.items,
        {
          id: `manual-${baseId}-${prev.items.length + 1}`,
          productName: '',
          description: '',
          quantity: null,
          quantityInput: '',
          unitPrice: null,
          unitPriceInput: '',
          wasQuantityInferred: true,
        },
      ]
      return {
        ...prev,
        items: nextItems,
        missingInfo: computeBudgetMissingInfo(nextItems),
      }
    })
  }, [])

  const handleBudgetTotalValueChange = useCallback(
    (value: number | null) => {
      setKitBudget((prev) => {
        if (value === null) {
          if (budgetItemsTotal !== null) {
            const formattedCalculated = formatCurrencyInputValue(budgetItemsTotal)
            if (
              prev.totalSource === 'calculated' &&
              numbersAreClose(prev.total, budgetItemsTotal) &&
              prev.totalInput === formattedCalculated
            ) {
              return prev
            }
            return {
              ...prev,
              totalInput: formattedCalculated,
              total: budgetItemsTotal,
              totalSource: 'calculated',
            }
          }
          const formattedZero = formatCurrencyInputValue(0)
          if (
            prev.totalSource === null &&
            numbersAreClose(prev.total, 0) &&
            prev.totalInput === formattedZero
          ) {
            return prev
          }
          return {
            ...prev,
            totalInput: formattedZero,
            total: 0,
            totalSource: null,
          }
        }

        const normalized = normalizeCurrencyNumber(value)
        if (normalized === null) {
          const formattedZero = formatCurrencyInputValue(0)
          if (
            prev.totalSource === null &&
            numbersAreClose(prev.total, 0) &&
            prev.totalInput === formattedZero
          ) {
            return prev
          }
          return {
            ...prev,
            totalInput: formattedZero,
            total: 0,
            totalSource: null,
          }
        }

        const formatted = formatCurrencyInputValue(normalized)
        if (
          prev.totalSource === 'explicit' &&
          numbersAreClose(prev.total, normalized) &&
          prev.totalInput === formatted
        ) {
          return prev
        }
        return {
          ...prev,
          totalInput: formatted,
          total: normalized,
          totalSource: 'explicit',
        }
      })
    },
    [budgetItemsTotal],
  )

  const kitBudgetTotal = useMemo(() => {
    if (kitBudget.totalSource === 'explicit') return kitBudget.total ?? 0
    if (budgetItemsTotal != null) return budgetItemsTotal
    if (kitBudget.total != null) return kitBudget.total
    return 0
  }, [kitBudget.totalSource, kitBudget.total, budgetItemsTotal])

  return {
    // Budget identity
    budgetIdRef,
    budgetIdTransitionRef,
    currentBudgetId,
    setCurrentBudgetId,
    budgetStructuredItems,
    setBudgetStructuredItems,
    budgetUploadInputRef,

    // Kit budget
    kitBudget,
    setKitBudget,
    isBudgetProcessing,
    setIsBudgetProcessing,
    budgetProcessingError,
    setBudgetProcessingError,
    budgetProcessingProgress,
    setBudgetProcessingProgress,
    ocrDpi,
    setOcrDpi,
    isBudgetTableCollapsed,
    setIsBudgetTableCollapsed,

    // Budget mode
    modoOrcamento,
    setModoOrcamento,
    autoKitValor,
    setAutoKitValor,
    autoCustoFinal,
    setAutoCustoFinal,
    autoPricingRede,
    setAutoPricingRede,
    autoPricingVersion,
    setAutoPricingVersion,
    autoBudgetReasonCode,
    setAutoBudgetReasonCode,
    autoBudgetReason,
    setAutoBudgetReason,

    // Derived / memos
    isManualBudgetForced,
    manualBudgetForceReason,
    valorOrcamentoConsiderado,
    budgetItemsTotal,
    budgetMissingSummary,
    kitBudgetTotal,

    // Callbacks
    getActiveBudgetId,
    switchBudgetId,
    handleModoOrcamentoChange,
    updateKitBudgetItem,
    handleBudgetItemTextChange,
    handleBudgetItemQuantityChange,
    handleRemoveBudgetItem,
    handleAddBudgetItem,
    handleBudgetTotalValueChange,
  }
}
