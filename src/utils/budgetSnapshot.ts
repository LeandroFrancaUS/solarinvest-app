import type { BudgetSnapshotPayload, PersistBudgetSnapshotResult } from '../types/budgetSnapshot'

const formatUnknownError = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Falha desconhecida.'
}

type BudgetSnapshotBridgeResult = void | boolean | { success?: boolean; message?: string }

type BudgetSnapshotBridge = (
  payload: BudgetSnapshotPayload,
) => BudgetSnapshotBridgeResult | Promise<BudgetSnapshotBridgeResult>

const resolveBudgetSnapshotBridge = (): BudgetSnapshotBridge | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const candidates: (BudgetSnapshotBridge | undefined)[] = [
    window.solarinvestNative?.saveBudgetSnapshot,
    window.solarinvestNative?.saveBudget,
    window.solarinvestOneDrive?.saveBudgetSnapshot,
    window.solarinvestFiles?.saveBudgetSnapshot,
    window.electronAPI?.saveBudgetSnapshot,
    window.desktopAPI?.saveBudgetSnapshot,
    window.saveBudgetSnapshot,
  ]

  return candidates.find((candidate): candidate is BudgetSnapshotBridge => typeof candidate === 'function') ?? null
}

const sanitizeSnapshotPayload = (payload: BudgetSnapshotPayload): BudgetSnapshotPayload => {
  const { printable, pageState, vendaState, leasingState, vendasConfig, ...rest } = payload

  return {
    ...rest,
    printable: { ...printable },
    pageState: { ...pageState },
    vendaState: { ...vendaState },
    leasingState: { ...leasingState },
    vendasConfig: JSON.parse(JSON.stringify(vendasConfig)),
  }
}

export const persistBudgetSnapshot = async (
  payload: BudgetSnapshotPayload,
): Promise<PersistBudgetSnapshotResult> => {
  const trimmedId = payload.id?.trim()
  if (!trimmedId) {
    throw new Error('Identificador do orçamento ausente para persistir o snapshot.')
  }

  const sanitized = sanitizeSnapshotPayload({ ...payload, id: trimmedId })
  const bridge = resolveBudgetSnapshotBridge()

  if (bridge) {
    try {
      const result = await bridge(sanitized)
      const failed =
        result === false ||
        (typeof result === 'object' && result !== null && 'success' in result && result.success === false)

      if (failed) {
        const message =
          typeof result === 'object' && result !== null && 'message' in result && typeof result.message === 'string'
            ? result.message
            : 'A integração de snapshots retornou uma falha.'
        throw new Error(message)
      }

      return { persisted: true }
    } catch (error) {
      throw new Error(`Não foi possível salvar o snapshot do orçamento: ${formatUnknownError(error)}`)
    }
  }

  const endpoint = import.meta.env?.VITE_BUDGET_SNAPSHOT_ENDPOINT?.trim()
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      })

      if (!response.ok) {
        const texto = await response.text().catch(() => '')
        const mensagem = texto || `Falha ao salvar o snapshot do orçamento (${response.status}).`
        throw new Error(mensagem)
      }

      return { persisted: true }
    } catch (error) {
      throw new Error(`Não foi possível enviar o snapshot do orçamento para o endpoint configurado: ${formatUnknownError(error)}`)
    }
  }

  console.warn('[persistBudgetSnapshot] Nenhuma integração configurada. Snapshot salvo apenas localmente.')
  return { persisted: false, message: 'Snapshot armazenado localmente. Configure a integração para salvar no banco.' }
}
