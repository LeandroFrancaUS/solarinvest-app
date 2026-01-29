import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    const categoria = req.query.categoria === 'vendas' ? 'vendas' : 'leasing'
    const filename = req.query.filename
    if (!filename) {
      res.status(400).json({ error: 'Missing filename.' })
      return
    }

    const filePath = path.join(process.cwd(), 'assets', 'templates', 'contratos', categoria, filename)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  } catch (error) {
    console.error('[contracts/download] Error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download error' })
    } else {
      res.end()
    }
  }
}
