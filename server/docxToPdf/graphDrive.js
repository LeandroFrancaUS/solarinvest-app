import { graphFetch } from './graphRequest.js'
import { requireGraphConfig } from './graphConfig.js'

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

const normalizePath = (value) => {
  if (!value) return ''
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

const encodeGraphPath = (pathValue) =>
  pathValue
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

export const sanitizeFileName = (fileName) => {
  const safe = (fileName || '').replace(/[/\\?%*:|"<>]/g, '_')
  return safe || `document-${Date.now()}.docx`
}

export const getDriveBasePath = () => {
  const config = requireGraphConfig()
  if (config.driveId) {
    return `/drives/${config.driveId}`
  }
  return `/users/${config.userId}/drive`
}

export const resolveFolderPath = (folderPath) => {
  const config = requireGraphConfig()
  const basePath = normalizePath(config.basePath)
  const tempFolder = normalizePath(folderPath || config.tempFolder)
  return [basePath, tempFolder].filter(Boolean).join('/')
}

const getFolderItem = async (accessToken, folderPath) => {
  const driveBase = getDriveBasePath()
  const encodedPath = encodeGraphPath(folderPath)
  const url = `${GRAPH_BASE_URL}${driveBase}/root:/${encodedPath}`
  const response = await graphFetch(url, {
    accessToken,
    expectedStatus: 200,
    allowStatus: [404],
  })

  if (response.status === 404) {
    return null
  }

  return response.json()
}

const createFolder = async (accessToken, parentPath, name) => {
  const driveBase = getDriveBasePath()
  const parentSegment = parentPath ? `root:/${encodeGraphPath(parentPath)}:` : 'root'
  const url = `${GRAPH_BASE_URL}${driveBase}/${parentSegment}/children`
  const response = await graphFetch(url, {
    method: 'POST',
    accessToken,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
    expectedStatus: 201,
  })
  return response.json()
}

export const ensureFolderPath = async (accessToken, folderPath) => {
  const normalizedPath = normalizePath(folderPath)
  if (!normalizedPath) {
    throw new Error('Pasta temporária do Graph não configurada.')
  }

  const segments = normalizedPath.split('/')
  let currentPath = ''

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    const existing = await getFolderItem(accessToken, currentPath)
    if (!existing) {
      await createFolder(accessToken, currentPath.split('/').slice(0, -1).join('/'), segment)
    }
  }

  return normalizedPath
}
