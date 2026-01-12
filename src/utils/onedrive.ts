const CLIENT_ONEDRIVE_BASE_PATH =
  '/Users/leandrofranca/Library/CloudStorage/OneDrive-7-Office/SolarInvest/Controle de Clientes'
const CLIENT_FOLDER_SEPARATOR = '-'
const CLIENT_FILE_PREFIX = 'SLRINVST-'
const CLIENT_FILE_PURPOSE = 'Leasing'

export type ClienteRegistroSyncPayload = {
  id: string
  criadoEm: string
  atualizadoEm: string
  dados: {
    nome: string
    documento: string
    rg: string
    estadoCivil: string
    nacionalidade: string
    profissao: string
    representanteLegal: string
    email: string
    telefone: string
    cep: string
    distribuidora: string
    uc: string
    endereco: string
    cidade: string
    uf: string
    temIndicacao: boolean
    indicacaoNome: string
    herdeiros: string[]
    nomeSindico: string
    cpfSindico: string
    contatoSindico: string
    diaVencimento: string
  }
  propostaSnapshot?: unknown
}

type OneDriveBridgePayload = {
  folderPath: string
  fileName: string
  content: string
}

type OneDriveBridgeResult =
  | void
  | boolean
  | { success?: boolean; message?: string }

type OneDriveBridge = (
  payload: OneDriveBridgePayload,
) => OneDriveBridgeResult | Promise<OneDriveBridgeResult>

type OneDriveLoadBridgeResult =
  | void
  | string
  | unknown[]
  | { success?: boolean; message?: string; content?: unknown; clientes?: unknown }

type OneDriveLoadBridge = () => OneDriveLoadBridgeResult | Promise<OneDriveLoadBridgeResult>

const stripDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const extractFirstName = (nome: string) => {
  const trimmed = (nome ?? '').trim()
  if (!trimmed) {
    return 'Cliente'
  }

  const [first] = trimmed.split(/\s+/)
  return first || 'Cliente'
}

const sanitizeFolderNamePart = (nome: string) => {
  const semDiacriticos = stripDiacritics(nome)
  const alfanumerico = semDiacriticos.replace(/[^A-Za-z0-9]/g, '')
  if (!alfanumerico) {
    return 'Cliente'
  }

  const lower = alfanumerico.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const buildFolderName = (registro: ClienteRegistroSyncPayload) => {
  const firstName = sanitizeFolderNamePart(extractFirstName(registro.dados.nome))
  return `${registro.id}${CLIENT_FOLDER_SEPARATOR}${firstName}`
}

const buildFileName = (registro: ClienteRegistroSyncPayload) =>
  `${CLIENT_FILE_PREFIX}${registro.id}${CLIENT_FOLDER_SEPARATOR}${CLIENT_FILE_PURPOSE}`

const buildFileContent = (registro: ClienteRegistroSyncPayload) =>
  JSON.stringify(
    {
      id: registro.id,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm,
      cliente: registro.dados,
      propostaSnapshot: registro.propostaSnapshot,
    },
    null,
    2,
  )

const resolveOneDriveBridge = (): OneDriveBridge | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const candidates: (OneDriveBridge | undefined)[] = [
    window.solarinvestNative?.saveClientToOneDrive,
    window.solarinvestNative?.saveClient,
    window.solarinvestOneDrive?.saveClientToOneDrive,
    window.solarinvestOneDrive?.saveClient,
    window.electronAPI?.saveClientToOneDrive,
    window.desktopAPI?.saveClientToOneDrive,
    window.saveClientToOneDrive,
  ]

  return candidates.find((candidate): candidate is OneDriveBridge => typeof candidate === 'function') ?? null
}

const resolveOneDriveLoadBridge = (): OneDriveLoadBridge | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const candidates: (OneDriveLoadBridge | undefined)[] = [
    window.solarinvestNative?.loadClientsFromOneDrive,
    window.solarinvestNative?.loadClients,
    window.solarinvestOneDrive?.loadClientsFromOneDrive,
    window.solarinvestOneDrive?.loadClients,
    window.electronAPI?.loadClientsFromOneDrive,
    window.desktopAPI?.loadClientsFromOneDrive,
    window.loadClientsFromOneDrive,
  ]

  return candidates.find((candidate): candidate is OneDriveLoadBridge => typeof candidate === 'function') ?? null
}

const getOneDriveEndpoint = () => import.meta.env?.VITE_ONEDRIVE_SYNC_ENDPOINT?.trim() || ''

export const isOneDriveIntegrationAvailable = (): boolean => {
  if (typeof window !== 'undefined' && resolveOneDriveBridge()) {
    return true
  }

  return getOneDriveEndpoint().length > 0
}

export class OneDriveIntegrationMissingError extends Error {
  constructor(message = 'Nenhuma integração com o OneDrive foi encontrada. Configure o conector desktop ou defina a variável VITE_ONEDRIVE_SYNC_ENDPOINT.') {
    super(message)
    this.name = 'OneDriveIntegrationMissingError'
  }
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

const extractOneDrivePayload = (result: OneDriveLoadBridgeResult): unknown => {
  if (typeof result === 'object' && result !== null && 'success' in result && result.success === false) {
    const message =
      'message' in result && typeof result.message === 'string'
        ? result.message
        : 'A integração com o OneDrive retornou uma falha.'
    throw new Error(message)
  }

  if (typeof result === 'object' && result !== null) {
    if ('content' in result) {
      return result.content ?? null
    }
    if ('clientes' in result) {
      return result.clientes ?? null
    }
  }

  return result ?? null
}

export const loadClientesFromOneDrive = async (): Promise<unknown | null> => {
  const bridge = resolveOneDriveLoadBridge()
  if (bridge) {
    try {
      const result = await bridge()
      return extractOneDrivePayload(result)
    } catch (error) {
      throw new Error(`Não foi possível carregar clientes do OneDrive: ${formatUnknownError(error)}`)
    }
  }

  const endpoint = getOneDriveEndpoint()
  if (endpoint) {
    try {
      const response = await fetch(endpoint, { method: 'GET' })
      if (!response.ok) {
        const texto = await response.text().catch(() => '')
        const mensagem = texto || `Falha ao consultar clientes no endpoint configurado (${response.status}).`
        throw new Error(mensagem)
      }

      const texto = await response.text()
      try {
        return JSON.parse(texto)
      } catch {
        return texto
      }
    } catch (error) {
      throw new Error(
        `Não foi possível consultar clientes no endpoint configurado do OneDrive: ${formatUnknownError(error)}`,
      )
    }
  }

  throw new OneDriveIntegrationMissingError()
}

export const persistClienteRegistroToOneDrive = async (
  registro: ClienteRegistroSyncPayload,
): Promise<void> => {
  if (!registro.id || registro.id.trim().length === 0) {
    throw new Error('Registro do cliente inválido: identificador ausente.')
  }

  const folderName = buildFolderName(registro)
  const folderPath = `${CLIENT_ONEDRIVE_BASE_PATH}/${folderName}`
  const fileName = buildFileName(registro)
  const content = buildFileContent(registro)
  const payload: OneDriveBridgePayload = { folderPath, fileName, content }

  const bridge = resolveOneDriveBridge()

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
            : 'A integração com o OneDrive retornou uma falha.'
        throw new Error(message)
      }

      return
    } catch (error) {
      throw new Error(`Não foi possível sincronizar o cliente no OneDrive: ${formatUnknownError(error)}`)
    }
  }

  const endpoint = getOneDriveEndpoint()
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, id: registro.id }),
      })

      if (!response.ok) {
        const texto = await response.text().catch(() => '')
        const mensagem = texto || `Falha ao sincronizar cliente no endpoint configurado (${response.status}).`
        throw new Error(mensagem)
      }

      return
    } catch (error) {
      throw new Error(
        `Não foi possível enviar os dados do cliente para o endpoint configurado do OneDrive: ${formatUnknownError(error)}`,
      )
    }
  }

  throw new OneDriveIntegrationMissingError()
}
