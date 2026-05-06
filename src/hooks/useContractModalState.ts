/**
 * useContractModalState.ts
 *
 * Owns all contract-selection modal state and the lighter contract-related
 * callbacks that do not require deep access to App.tsx-level state:
 *
 *   State:
 *     gerandoContratos                — generation loading flag
 *     isContractTemplatesModalOpen    — vendas template picker visibility
 *     isLeasingContractsModalOpen     — leasing contracts modal visibility
 *     clientReadinessErrors           — pre-generation validation issues
 *     leasingAnexosSelecionados       — selected leasing annexes
 *     leasingAnexosAvailability       — server-fetched annex availability map
 *     leasingAnexosLoading            — annex availability fetch flag
 *     contractTemplatesCategory       — active template category ('vendas'|'leasing')
 *     contractTemplates               — loaded template names
 *     selectedContractTemplates       — user-selected templates
 *     contractTemplatesLoading        — template list fetch flag
 *     contractTemplatesError          — template list fetch error message
 *     contratoClientePayloadRef       — payload prepared between open → confirm
 *
 *   Callbacks (self-contained or using only this hook's own state):
 *     carregarTemplatesContrato, carregarDisponibilidadeAnexos,
 *     handleToggleContractTemplate, handleSelectAllContractTemplates,
 *     handleToggleLeasingAnexo, handleSelectAllLeasingAnexos,
 *     handleFecharModalContratos, handleFecharLeasingContractsModal,
 *     abrirSelecaoContratos
 *
 * Heavy generation handlers (handleConfirmarGeracaoLeasing, etc.) are too
 * deeply coupled to App.tsx state and remain there as callers of this hook's
 * exposed state and setters.
 *
 * Params:
 *   tipoContrato           — active leasing contract type (from useLeasingStore)
 *   corresponsavelAtivo    — whether co-signer is active (derived memo)
 *   clienteUf              — client's UF (used by annex availability fetch)
 *   adicionarNotificacao   — notification callback
 *   prepararDadosRef       — late-bound ref to prepararDadosContratoCliente;
 *                            assigned by App.tsx after that callback is declared
 *                            (same TDZ-safe pattern as applyVendaUpdatesRef).
 *
 * Zero behavioural change — exact same logic as the original App.tsx blocks.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveApiUrl } from '../utils/apiUrl'
import {
  LEASING_ANEXOS_CONFIG,
  getDefaultLeasingAnexos,
  ensureRequiredLeasingAnexos,
  type LeasingAnexoId,
  type LeasingContratoTipo,
} from '../components/modals/LeasingContractsModal'
import type { ContractTemplateCategory } from '../components/modals/ContractTemplatesModal'
import type { ValidationIssue } from '../lib/validation/clientReadiness'
import type { ClienteContratoPayload } from '../types/contratoTypes'
type NotificacaoTipo = 'success' | 'info' | 'error'


type AdicionarNotificacaoFn = (mensagem: string, tipo?: NotificacaoTipo) => void
type PrepararDadosContratoClienteFn = () => ClienteContratoPayload | null

export interface UseContractModalStateOptions {
  tipoContrato: LeasingContratoTipo
  corresponsavelAtivo: boolean
  clienteUf: string
  adicionarNotificacao: AdicionarNotificacaoFn
  /**
   * Late-bound ref pointing to prepararDadosContratoCliente.
   * App.tsx assigns this after the callback is declared, avoiding TDZ.
   */
  prepararDadosRef: React.RefObject<PrepararDadosContratoClienteFn | null>
}

export interface UseContractModalStateResult {
  // ── State ────────────────────────────────────────────────────────────────
  gerandoContratos: boolean
  setGerandoContratos: React.Dispatch<React.SetStateAction<boolean>>
  isContractTemplatesModalOpen: boolean
  setIsContractTemplatesModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  isLeasingContractsModalOpen: boolean
  setIsLeasingContractsModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  clientReadinessErrors: ValidationIssue[] | null
  setClientReadinessErrors: React.Dispatch<React.SetStateAction<ValidationIssue[] | null>>
  leasingAnexosSelecionados: LeasingAnexoId[]
  setLeasingAnexosSelecionados: React.Dispatch<React.SetStateAction<LeasingAnexoId[]>>
  leasingAnexosAvailability: Record<LeasingAnexoId, boolean>
  setLeasingAnexosAvailability: React.Dispatch<React.SetStateAction<Record<LeasingAnexoId, boolean>>>
  leasingAnexosLoading: boolean
  setLeasingAnexosLoading: React.Dispatch<React.SetStateAction<boolean>>
  contractTemplatesCategory: ContractTemplateCategory
  setContractTemplatesCategory: React.Dispatch<React.SetStateAction<ContractTemplateCategory>>
  contractTemplates: string[]
  setContractTemplates: React.Dispatch<React.SetStateAction<string[]>>
  selectedContractTemplates: string[]
  setSelectedContractTemplates: React.Dispatch<React.SetStateAction<string[]>>
  contractTemplatesLoading: boolean
  setContractTemplatesLoading: React.Dispatch<React.SetStateAction<boolean>>
  contractTemplatesError: string | null
  setContractTemplatesError: React.Dispatch<React.SetStateAction<string | null>>
  contratoClientePayloadRef: React.MutableRefObject<ClienteContratoPayload | null>
  // ── Callbacks ─────────────────────────────────────────────────────────────
  carregarTemplatesContrato: (category: ContractTemplateCategory) => Promise<void>
  carregarDisponibilidadeAnexos: () => Promise<void>
  handleToggleContractTemplate: (template: string) => void
  handleSelectAllContractTemplates: (selectAll: boolean) => void
  handleToggleLeasingAnexo: (anexoId: LeasingAnexoId) => void
  handleSelectAllLeasingAnexos: (selectAll: boolean) => void
  handleFecharModalContratos: () => void
  handleFecharLeasingContractsModal: () => void
  abrirSelecaoContratos: (category: ContractTemplateCategory) => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContractModalState({
  tipoContrato,
  corresponsavelAtivo,
  clienteUf,
  adicionarNotificacao,
  prepararDadosRef,
}: UseContractModalStateOptions): UseContractModalStateResult {
  const [gerandoContratos, setGerandoContratos] = useState(false)
  const [isContractTemplatesModalOpen, setIsContractTemplatesModalOpen] = useState(false)
  const [isLeasingContractsModalOpen, setIsLeasingContractsModalOpen] = useState(false)
  const [clientReadinessErrors, setClientReadinessErrors] = useState<ValidationIssue[] | null>(null)
  const [leasingAnexosSelecionados, setLeasingAnexosSelecionados] = useState<LeasingAnexoId[]>(() =>
    getDefaultLeasingAnexos(tipoContrato, { corresponsavelAtivo }),
  )
  const [leasingAnexosAvailability, setLeasingAnexosAvailability] = useState<
    Record<LeasingAnexoId, boolean>
  >({} as Record<LeasingAnexoId, boolean>)
  const [leasingAnexosLoading, setLeasingAnexosLoading] = useState(false)
  const [contractTemplatesCategory, setContractTemplatesCategory] =
    useState<ContractTemplateCategory>('vendas')
  const [contractTemplates, setContractTemplates] = useState<string[]>([])
  const [selectedContractTemplates, setSelectedContractTemplates] = useState<string[]>([])
  const [contractTemplatesLoading, setContractTemplatesLoading] = useState(false)
  const [contractTemplatesError, setContractTemplatesError] = useState<string | null>(null)
  const contratoClientePayloadRef = useRef<ClienteContratoPayload | null>(null)

  // Keep leasingAnexosSelecionados valid when tipoContrato or corresponsavelAtivo changes
  useEffect(() => {
    setLeasingAnexosSelecionados((prev) => {
      const anexosValidos = new Set(
        LEASING_ANEXOS_CONFIG.filter((anexo) =>
          anexo.tipos.includes(tipoContrato),
        ).map((anexo) => anexo.id),
      )
      const filtrados = prev.filter((id) => anexosValidos.has(id))
      const baseSelecionados = filtrados.length > 0
        ? filtrados
        : getDefaultLeasingAnexos(tipoContrato, { corresponsavelAtivo })
      return ensureRequiredLeasingAnexos(baseSelecionados, tipoContrato, {
        corresponsavelAtivo,
      })
    })
  }, [corresponsavelAtivo, tipoContrato])

  // Enforce required annexes when corresponsavelAtivo changes
  useEffect(() => {
    setLeasingAnexosSelecionados((prev) => {
      if (!corresponsavelAtivo) {
        return prev.filter((id) => id !== 'ANEXO_X')
      }
      return ensureRequiredLeasingAnexos(prev, tipoContrato, {
        corresponsavelAtivo,
      })
    })
  }, [corresponsavelAtivo, tipoContrato])

  // ── Callbacks ───────────────────────────────────────────────────────────────

  const carregarTemplatesContrato = useCallback(
    async (category: ContractTemplateCategory) => {
      setContractTemplatesLoading(true)
      setContractTemplatesError(null)
      try {
        const params = new URLSearchParams({ categoria: category })
        const response = await fetch(
          resolveApiUrl(`/api/contracts/templates?${params.toString()}`),
        )
        if (!response.ok) {
          let mensagemErro = 'Não foi possível listar os templates de contrato.'
          const contentType = response.headers.get('content-type') ?? ''
          try {
            if (contentType.includes('application/json')) {
              const data = (await response.json()) as { error?: string } | undefined
              if (data?.error) {
                mensagemErro = data.error
              }
            } else {
              const texto = await response.text()
              if (texto.trim()) {
                mensagemErro = texto.trim()
              }
            }
          } catch (error) {
            console.warn('Não foi possível interpretar o erro ao listar templates.', error)
          }
          throw new Error(mensagemErro)
        }

        const payload = (await response.json()) as { templates?: unknown }
        const listaBruta = Array.isArray(payload.templates) ? payload.templates : []
        const nomes = listaBruta
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
        if (nomes.length === 0) {
          setContractTemplates([])
          setSelectedContractTemplates([])
          setContractTemplatesError(
            `Nenhum template de contrato disponível para ${category}.`,
          )
          return
        }

        const unicos = Array.from(new Set(nomes))
        setContractTemplates(unicos)
        setSelectedContractTemplates((prev) => {
          const ativos = prev.filter((item) => unicos.includes(item))
          return ativos.length > 0 ? ativos : unicos
        })
      } catch (error) {
        const mensagem =
          error instanceof Error && error.message
            ? error.message
            : 'Não foi possível listar os templates de contrato.'
        console.error('Não foi possível carregar os templates de contrato.', error)
        setContractTemplatesError(mensagem)
        setContractTemplates([])
        setSelectedContractTemplates([])
        adicionarNotificacao(mensagem, 'error')
      } finally {
        setContractTemplatesLoading(false)
      }
    },
    [adicionarNotificacao],
  )

  const carregarDisponibilidadeAnexos = useCallback(async () => {
    setLeasingAnexosLoading(true)
    try {
      const params = new URLSearchParams({
        tipoContrato,
        uf: clienteUf || '',
      })
      const response = await fetch(
        resolveApiUrl(`/api/contracts/leasing/availability?${params.toString()}`),
      )
      if (!response.ok) {
        console.error('Não foi possível verificar disponibilidade dos anexos.')
        setLeasingAnexosAvailability({} as Record<LeasingAnexoId, boolean>)
        return
      }

      const responsePayload = (await response.json()) as { availability?: Record<string, boolean> }
      const availability = responsePayload.availability || {}
      setLeasingAnexosAvailability(availability as Record<LeasingAnexoId, boolean>)
      setLeasingAnexosSelecionados((prev) => {
        const filtrados = prev.filter((anexoId) => availability[anexoId] !== false)
        return ensureRequiredLeasingAnexos(filtrados, tipoContrato, {
          corresponsavelAtivo,
        })
      })
    } catch (error) {
      console.error('Erro ao verificar disponibilidade dos anexos:', error)
      setLeasingAnexosAvailability({} as Record<LeasingAnexoId, boolean>)
    } finally {
      setLeasingAnexosLoading(false)
    }
  }, [corresponsavelAtivo, tipoContrato, clienteUf])

  const handleToggleContractTemplate = useCallback((template: string) => {
    setSelectedContractTemplates((prev) => {
      if (prev.includes(template)) {
        return prev.filter((item) => item !== template)
      }
      return [...prev, template]
    })
  }, [])

  const handleSelectAllContractTemplates = useCallback(
    (selectAll: boolean) => {
      setSelectedContractTemplates(selectAll ? contractTemplates : [])
    },
    [contractTemplates],
  )

  const handleToggleLeasingAnexo = useCallback((anexoId: LeasingAnexoId) => {
    const config = LEASING_ANEXOS_CONFIG.find((item) => item.id === anexoId)
    if (config?.autoInclude || (corresponsavelAtivo && anexoId === 'ANEXO_X')) {
      return
    }
    setLeasingAnexosSelecionados((prev) => {
      if (prev.includes(anexoId)) {
        return prev.filter((item) => item !== anexoId)
      }
      return [...prev, anexoId]
    })
  }, [corresponsavelAtivo])

  const handleSelectAllLeasingAnexos = useCallback(
    (selectAll: boolean) => {
      if (!selectAll) {
        setLeasingAnexosSelecionados(
          ensureRequiredLeasingAnexos([], tipoContrato, { corresponsavelAtivo }),
        )
        return
      }
      const disponiveis = LEASING_ANEXOS_CONFIG.filter(
        (config) =>
          config.tipos.includes(tipoContrato) &&
          !(config.autoInclude || (corresponsavelAtivo && config.id === 'ANEXO_X')) &&
          leasingAnexosAvailability[config.id] !== false,
      ).map((config) => config.id)
      setLeasingAnexosSelecionados(
        ensureRequiredLeasingAnexos(disponiveis, tipoContrato, {
          corresponsavelAtivo,
        }),
      )
    },
    [corresponsavelAtivo, tipoContrato, leasingAnexosAvailability],
  )

  const handleFecharModalContratos = useCallback(() => {
    setIsContractTemplatesModalOpen(false)
    contratoClientePayloadRef.current = null
  }, [])

  const handleFecharLeasingContractsModal = useCallback(() => {
    setIsLeasingContractsModalOpen(false)
  }, [])

  const abrirSelecaoContratos = useCallback(
    (category: ContractTemplateCategory) => {
      if (gerandoContratos) {
        return
      }

      const prepararDados = prepararDadosRef.current
      if (!prepararDados) {
        return
      }

      const payload = prepararDados()
      if (!payload) {
        return
      }

      contratoClientePayloadRef.current = payload
      setContractTemplatesCategory(category)
      setIsContractTemplatesModalOpen(true)
      setContractTemplatesError(null)
      void carregarTemplatesContrato(category)
    },
    [carregarTemplatesContrato, gerandoContratos, prepararDadosRef],
  )

  return {
    // State
    gerandoContratos,
    setGerandoContratos,
    isContractTemplatesModalOpen,
    setIsContractTemplatesModalOpen,
    isLeasingContractsModalOpen,
    setIsLeasingContractsModalOpen,
    clientReadinessErrors,
    setClientReadinessErrors,
    leasingAnexosSelecionados,
    setLeasingAnexosSelecionados,
    leasingAnexosAvailability,
    setLeasingAnexosAvailability,
    leasingAnexosLoading,
    setLeasingAnexosLoading,
    contractTemplatesCategory,
    setContractTemplatesCategory,
    contractTemplates,
    setContractTemplates,
    selectedContractTemplates,
    setSelectedContractTemplates,
    contractTemplatesLoading,
    setContractTemplatesLoading,
    contractTemplatesError,
    setContractTemplatesError,
    contratoClientePayloadRef,
    // Callbacks
    carregarTemplatesContrato,
    carregarDisponibilidadeAnexos,
    handleToggleContractTemplate,
    handleSelectAllContractTemplates,
    handleToggleLeasingAnexo,
    handleSelectAllLeasingAnexos,
    handleFecharModalContratos,
    handleFecharLeasingContractsModal,
    abrirSelecaoContratos,
  }
}
