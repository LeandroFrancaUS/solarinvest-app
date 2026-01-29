const stripDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const sanitizeFileNamePart = (value: string) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return ''
  }

  const withoutDiacritics = stripDiacritics(trimmed)
  const replaced = withoutDiacritics.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  return replaced || ''
}

const buildDefaultFileName = ({
  budgetId,
  clientName,
  proposalType,
}: {
  budgetId?: string | undefined
  clientName?: string | undefined
  proposalType?: string | undefined
}) => {
  const parts = ['Proposta']
  if (proposalType) {
    parts.push(proposalType)
  }
  if (budgetId) {
    parts.push(budgetId)
  }
  if (clientName) {
    parts.push(clientName)
  }

  const sanitized = parts
    .map((part) => sanitizeFileNamePart(part))
    .filter((part) => part && part.length > 0)

  const baseName = sanitized.length > 0 ? sanitized.join('-') : 'Proposta-SolarInvest'
  return `${baseName}.pdf`
}

const formatUnknownError = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Falha desconhecida.'
}

type ProposalPdfBridgePayload = {
  html: string
  fileName: string
  budgetId?: string
  clientName?: string
  proposalType?: string
  metadata?: Record<string, unknown>
}

type ProposalPdfBridgeResult = void | boolean | { success?: boolean; message?: string }

type ProposalPdfBridge = (
  payload: ProposalPdfBridgePayload,
) => ProposalPdfBridgeResult | Promise<ProposalPdfBridgeResult>

const resolveProposalPdfBridge = (): ProposalPdfBridge | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const candidates: (ProposalPdfBridge | undefined)[] = [
    window.solarinvestNative?.saveProposalPdf,
    window.solarinvestNative?.saveProposal,
    window.solarinvestNative?.savePdf,
    window.solarinvestOneDrive?.saveProposalPdf,
    window.solarinvestOneDrive?.saveProposal,
    window.solarinvestOneDrive?.savePdf,
    window.solarinvestFiles?.saveProposalPdf,
    window.solarinvestFiles?.saveProposal,
    window.solarinvestFiles?.savePdf,
    window.electronAPI?.saveProposalPdf,
    window.electronAPI?.saveProposal,
    window.desktopAPI?.saveProposalPdf,
    window.desktopAPI?.saveProposal,
    window.saveProposalPdf,
  ]

  return candidates.find((candidate): candidate is ProposalPdfBridge => typeof candidate === 'function') ?? null
}

const getProposalPdfEndpoint = () =>
  import.meta.env?.VITE_PROPOSAL_PDF_ENDPOINT?.trim() || '/api/proposal/pdf'

export const isProposalPdfIntegrationAvailable = (): boolean => {
  if (typeof window !== 'undefined' && resolveProposalPdfBridge()) {
    return true
  }

  return getProposalPdfEndpoint().length > 0
}

export class ProposalPdfIntegrationMissingError extends Error {
  constructor(message = 'Nenhuma integração para salvar o PDF da proposta foi encontrada. Configure o conector desktop ou defina a variável VITE_PROPOSAL_PDF_ENDPOINT.') {
    super(message)
    this.name = 'ProposalPdfIntegrationMissingError'
  }
}

export type PersistProposalPdfInput = {
  html: string
  budgetId?: string | undefined
  clientName?: string | undefined
  proposalType?: string | undefined
  fileName?: string | undefined
  metadata?: Record<string, unknown>
}

export const persistProposalPdf = async ({
  html,
  budgetId,
  clientName,
  proposalType,
  fileName,
  metadata,
}: PersistProposalPdfInput): Promise<void> => {
  const trimmedHtml = html?.trim()
  if (!trimmedHtml) {
    throw new Error('Conteúdo da proposta indisponível para gerar o PDF.')
  }

  const resolvedFileName = fileName?.trim() || buildDefaultFileName({ budgetId, clientName, proposalType })
  const resolvedBudgetId = budgetId?.trim() || undefined
  const resolvedClientName = clientName?.trim() || undefined
  const resolvedProposalType = proposalType?.trim() || undefined
  const resolvedMetadata = {
    generatedAt: new Date().toISOString(),
    ...(metadata ?? {}),
  }

  const payload: ProposalPdfBridgePayload = {
    html: trimmedHtml,
    fileName: resolvedFileName,
  }

  if (resolvedBudgetId) {
    payload.budgetId = resolvedBudgetId
  }
  if (resolvedClientName) {
    payload.clientName = resolvedClientName
  }
  if (resolvedProposalType) {
    payload.proposalType = resolvedProposalType
  }
  if (Object.keys(resolvedMetadata).length > 0) {
    payload.metadata = resolvedMetadata
  }

  const bridge = resolveProposalPdfBridge()

  if (bridge) {
    try {
      const result = await bridge(payload)
      const failed =
        result === false ||
        (typeof result === 'object' && result !== null && 'success' in result && result.success === false)

      if (failed) {
        const message =
          typeof result === 'object' && result !== null && 'message' in result && typeof result.message === 'string'
            ? result.message
            : 'A integração de PDF retornou uma falha.'
        throw new Error(message)
      }

      return
    } catch (error) {
      throw new Error(`Não foi possível salvar a proposta em PDF: ${formatUnknownError(error)}`)
    }
  }

  const endpoint = getProposalPdfEndpoint()
  if (endpoint) {
    try {
      const body: Record<string, unknown> = {
        html: trimmedHtml,
        fileName: resolvedFileName,
      }
      if (resolvedBudgetId) {
        body.budgetId = resolvedBudgetId
        body.id = resolvedBudgetId
      }
      if (resolvedClientName) {
        body.clientName = resolvedClientName
      }
      if (resolvedProposalType) {
        body.proposalType = resolvedProposalType
      }
      if (payload.metadata) {
        body.metadata = payload.metadata
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const texto = await response.text().catch(() => '')
        const mensagem = texto || `Falha ao salvar a proposta em PDF via endpoint (${response.status}).`
        throw new Error(mensagem)
      }

      return
    } catch (error) {
      throw new Error(`Não foi possível enviar o PDF da proposta para o endpoint configurado: ${formatUnknownError(error)}`)
    }
  }

  throw new ProposalPdfIntegrationMissingError()
}
