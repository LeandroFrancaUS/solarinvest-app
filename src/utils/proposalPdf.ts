const CLIENT_PROPOSAL_BASE_PATH =
  '/Users/leandrofranca/Library/CloudStorage/OneDrive-7-Office/SolarInvest/Controle de Clientes'

const stripDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const sanitizeNamePart = (value: string) => {
  const semDiacriticos = stripDiacritics(value ?? '')
  const alfanumerico = semDiacriticos.replace(/[^A-Za-z0-9]/g, '')
  if (!alfanumerico) {
    return 'Cliente'
  }

  const lower = alfanumerico.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const buildFolderName = (clienteId: string, clienteNome: string) => `${clienteId}-${sanitizeNamePart(clienteNome)}`

const buildFileName = (clienteId: string, clienteNome: string, budgetId: string) => {
  const baseName = sanitizeNamePart(clienteNome)
  const normalizedBudget = budgetId?.trim() ? `-${budgetId.trim()}` : ''
  return `Proposta-${clienteId}${normalizedBudget}-${baseName}.pdf`
}

type ProposalPdfMetadata = {
  clienteId: string
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  budgetId: string
}

type ProposalPdfBridgePayload = {
  folderPath: string
  fileName: string
  html: string
  metadata: ProposalPdfMetadata
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
    window.solarinvestOneDrive?.saveProposalPdf,
    window.electronAPI?.saveProposalPdf,
    window.desktopAPI?.saveProposalPdf,
    window.saveProposalPdf,
  ]

  return candidates.find((candidate): candidate is ProposalPdfBridge => typeof candidate === 'function') ?? null
}

const formatUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Falha desconhecida.'
}

export type PersistProposalPdfPayload = ProposalPdfMetadata & {
  layoutHtml: string
}

export const persistProposalPdf = async ({
  layoutHtml,
  clienteId,
  clienteNome,
  clienteCidade,
  clienteUf,
  budgetId,
}: PersistProposalPdfPayload): Promise<void> => {
  const trimmedClienteId = clienteId?.trim()
  if (!trimmedClienteId) {
    throw new Error('Identificador do cliente ausente para salvar a proposta.')
  }

  const trimmedNome = clienteNome?.trim()
  if (!trimmedNome) {
    throw new Error('Nome do cliente ausente para salvar a proposta.')
  }

  const htmlContent = layoutHtml?.trim()
  if (!htmlContent) {
    throw new Error('Layout da proposta vazio. Gere a proposta novamente antes de salvar.')
  }

  const folderName = buildFolderName(trimmedClienteId, trimmedNome)
  const folderPath = `${CLIENT_PROPOSAL_BASE_PATH}/${folderName}`
  const fileName = buildFileName(trimmedClienteId, trimmedNome, budgetId)

  const payload: ProposalPdfBridgePayload = {
    folderPath,
    fileName,
    html: htmlContent,
    metadata: {
      clienteId: trimmedClienteId,
      clienteNome: trimmedNome,
      clienteCidade: clienteCidade?.trim() ?? '',
      clienteUf: clienteUf?.trim() ?? '',
      budgetId,
    },
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
            : 'A integração local para salvar a proposta retornou uma falha.'
        throw new Error(message)
      }

      return
    } catch (error) {
      throw new Error(`Não foi possível salvar a proposta localmente: ${formatUnknownError(error)}`)
    }
  }

  const endpoint = import.meta.env?.VITE_PROPOSTA_PDF_ENDPOINT?.trim()
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const texto = await response.text().catch(() => '')
        const mensagem =
          texto || `Falha ao salvar a proposta no endpoint configurado (${response.status}).`
        throw new Error(mensagem)
      }

      return
    } catch (error) {
      throw new Error(
        `Não foi possível enviar a proposta para o endpoint configurado: ${formatUnknownError(error)}`,
      )
    }
  }

  throw new Error(
    'Nenhuma integração disponível para salvar a proposta. Configure o conector desktop ou defina a variável VITE_PROPOSTA_PDF_ENDPOINT.',
  )
}
