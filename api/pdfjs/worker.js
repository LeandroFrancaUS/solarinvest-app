const WORKER_SOURCES = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs',
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs',
]

let cachedWorker = null

async function fetchRemoteWorker() {
  const errors = []
  for (const source of WORKER_SOURCES) {
    try {
      const response = await fetch(source)
      if (!response.ok) {
        errors.push(`${source}: HTTP ${response.status}`)
        continue
      }
      return await response.text()
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(errors.join(' | '))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    if (!cachedWorker) {
      cachedWorker = await fetchRemoteWorker()
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')
    res.status(200).send(cachedWorker)
  } catch (error) {
    console.error('[pdfjs/worker] proxy error', error)
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.status(200).send(`throw new Error(${JSON.stringify(
      `Falha ao carregar PDF.js worker via proxy: ${error instanceof Error ? error.message : String(error)}`,
    )})`)
  }
}
