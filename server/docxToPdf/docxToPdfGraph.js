import { getGraphAccessToken } from './graphAuth.js'
import { graphFetch, uploadFetch } from './graphRequest.js'
import { ensureFolderPath, getDriveBasePath, resolveFolderPath, sanitizeFileName } from './graphDrive.js'

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const CONTENT_TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const SMALL_UPLOAD_LIMIT = 4 * 1024 * 1024
const UPLOAD_CHUNK_SIZE = 3 * 1024 * 1024
const PDF_DOWNLOAD_TIMEOUT_MS = 20000

const encodeGraphPath = (pathValue) =>
  pathValue
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

const logCleanupWarning = (context, status) => {
  const payload = {
    scope: 'docx-to-pdf',
    step: 'cleanup_failed',
    status,
  }
  if (context?.requestId) {
    payload.requestId = context.requestId
  }
  if (context?.contractId) {
    payload.contractId = context.contractId
  }
  console.warn(payload)
}

const uploadSmallDocx = async (accessToken, driveBase, folderPath, fileName, docxBuffer) => {
  const encodedPath = `${encodeGraphPath(folderPath)}/${encodeURIComponent(fileName)}`
  const url = `${GRAPH_BASE_URL}${driveBase}/root:/${encodedPath}:/content`
  const response = await graphFetch(url, {
    method: 'PUT',
    accessToken,
    headers: {
      'Content-Type': CONTENT_TYPE_DOCX,
    },
    body: docxBuffer,
    expectedStatus: 201,
  })
  return response.json()
}

const createUploadSession = async (accessToken, driveBase, folderPath, fileName) => {
  const encodedPath = `${encodeGraphPath(folderPath)}/${encodeURIComponent(fileName)}`
  const url = `${GRAPH_BASE_URL}${driveBase}/root:/${encodedPath}:/createUploadSession`
  const response = await graphFetch(url, {
    method: 'POST',
    accessToken,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
        name: fileName,
      },
    }),
    expectedStatus: 200,
  })
  return response.json()
}

const uploadLargeDocx = async (accessToken, driveBase, folderPath, fileName, docxBuffer) => {
  const session = await createUploadSession(accessToken, driveBase, folderPath, fileName)
  const uploadUrl = session?.uploadUrl
  if (!uploadUrl) {
    throw new Error('Falha ao iniciar a sessão de upload no Microsoft Graph.')
  }

  let offset = 0
  const total = docxBuffer.length

  while (offset < total) {
    const chunk = docxBuffer.slice(offset, Math.min(offset + UPLOAD_CHUNK_SIZE, total))
    const start = offset
    const end = offset + chunk.length - 1
    const contentRange = `bytes ${start}-${end}/${total}`
    const response = await uploadFetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': contentRange,
      },
      body: chunk,
    })

    if (response.status === 202) {
      offset += chunk.length
      continue
    }

    if (!response.ok) {
      throw new Error('Falha ao enviar o arquivo para o Microsoft Graph.')
    }

    const payload = await response.json()
    return payload
  }

  throw new Error('Falha ao concluir o upload no Microsoft Graph.')
}

const downloadPdf = async (accessToken, driveBase, itemId) => {
  const url = `${GRAPH_BASE_URL}${driveBase}/items/${itemId}/content?format=pdf`
  const response = await graphFetch(url, {
    accessToken,
    expectedStatus: 200,
    timeoutMs: PDF_DOWNLOAD_TIMEOUT_MS,
    retryOnStatus: (status) => status === 202 || status === 429 || status >= 500,
    retries: 4,
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

const deleteItem = async (accessToken, driveBase, itemId) => {
  const url = `${GRAPH_BASE_URL}${driveBase}/items/${itemId}`
  await graphFetch(url, {
    method: 'DELETE',
    accessToken,
    expectedStatus: 204,
    allowStatus: [404],
  })
}

export const convertDocxBufferToPdfBuffer = async (docxBuffer, opts = {}) => {
  if (!Buffer.isBuffer(docxBuffer)) {
    throw new Error('Arquivo DOCX inválido para conversão.')
  }

  const accessToken = await getGraphAccessToken()
  const driveBase = getDriveBasePath()
  const folderPath = resolveFolderPath(opts.folderPath)
  const safeFileName = sanitizeFileName(opts.fileName)

  const resolvedFolder = await ensureFolderPath(accessToken, folderPath)

  const uploadResult = docxBuffer.length <= SMALL_UPLOAD_LIMIT
    ? await uploadSmallDocx(accessToken, driveBase, resolvedFolder, safeFileName, docxBuffer)
    : await uploadLargeDocx(accessToken, driveBase, resolvedFolder, safeFileName, docxBuffer)

  const itemId = uploadResult?.id
  if (!itemId) {
    throw new Error('Falha ao carregar o arquivo no Microsoft Graph.')
  }

  try {
    return await downloadPdf(accessToken, driveBase, itemId)
  } finally {
    try {
      await deleteItem(accessToken, driveBase, itemId)
    } catch (error) {
      logCleanupWarning(opts, error?.status || error?.code || 'unknown')
    }
  }
}
