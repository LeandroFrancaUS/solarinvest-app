import path from 'path'
import fs from 'fs'
import mammoth from 'mammoth'

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

    const filePath = path.join(process.cwd(), 'public', 'contracts', categoria, filename)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const { value: text } = await mammoth.extractRawText({ path: filePath })
    res.status(200).json({ text, categoria, filename })
  } catch (error) {
    console.error('[contracts/text] Error:', error)
    res.status(500).json({ error: 'Text extraction error' })
  }
}
