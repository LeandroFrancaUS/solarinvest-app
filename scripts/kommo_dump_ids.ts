/*
 * Script para listar pipelines, statuses e campos customizados no Kommo.
 * Uso com Node.js 22+: node --experimental-strip-types scripts/kommo_dump_ids.ts
 */

const BASE_LANGUAGE = 'pt'

type KommoListResponse<T> = {
  data?: T[]
}

type PipelineStatus = {
  id: number
  name: string
}

type Pipeline = {
  id: number
  name: string
  _embedded?: { statuses?: PipelineStatus[] }
}

type CustomFieldValue = {
  id: number
  name: string
  type?: string
}

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${key}`)
  }
  return value
}

const buildHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'X-Language': BASE_LANGUAGE,
})

const logPipelineInfo = (pipelines: Pipeline[]) => {
  if (pipelines.length === 0) {
    console.warn('Nenhum pipeline encontrado.')
    return
  }

  console.log('=== Pipelines e Status ===')
  pipelines.forEach((pipeline) => {
    console.log(`Pipeline ${pipeline.id}: ${pipeline.name}`)
    const statuses = pipeline._embedded?.statuses ?? []
    statuses.forEach((status) => {
      console.log(`  - Status ${status.id}: ${status.name}`)
    })
  })
}

const logCustomFields = (title: string, fields: CustomFieldValue[]) => {
  console.log(`=== ${title} ===`)
  if (fields.length === 0) {
    console.warn('Nenhum campo encontrado.')
    return
  }
  fields.forEach((field) => {
    console.log(`Campo ${field.id}: ${field.name}${field.type ? ` (type: ${field.type})` : ''}`)
  })
}

const fetchJson = async <T>(url: string, headers: Record<string, string>): Promise<KommoListResponse<T>> => {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function main() {
  const subdomain = getEnv('KOMMO_SUBDOMAIN')
  const token = getEnv('KOMMO_LONG_LIVED_TOKEN')
  const baseUrl = `https://${subdomain}.kommo.com/api/v4`
  const headers = buildHeaders(token)

  try {
    const pipelinesResponse = await fetchJson<Pipeline>(`${baseUrl}/leads/pipelines`, headers)
    logPipelineInfo(pipelinesResponse.data ?? [])
  } catch (error) {
    console.error('Não foi possível listar pipelines/statuses:', (error as Error).message)
  }

  try {
    const contactsResponse = await fetchJson<CustomFieldValue>(`${baseUrl}/contacts/custom_fields`, headers)
    logCustomFields('Campos de Contato', contactsResponse.data ?? [])
  } catch (error) {
    console.error('Não foi possível listar campos de contato:', (error as Error).message)
  }

  try {
    const leadsResponse = await fetchJson<CustomFieldValue>(`${baseUrl}/leads/custom_fields`, headers)
    logCustomFields('Campos de Lead', leadsResponse.data ?? [])
  } catch (error) {
    console.error('Não foi possível listar campos de lead:', (error as Error).message)
  }
}

main().catch((error) => {
  console.error('Erro inesperado ao executar script:', error)
})
