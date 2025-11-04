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
    const dir = path.join(process.cwd(), 'public', 'contracts', categoria)
    if (!fs.existsSync(dir)) {
      res.status(404).json({ error: `Category not found: ${categoria}` })
      return
    }

    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.docx'))
    const urls = files.map((file) => `/contracts/${categoria}/${file}`)
    res.status(200).json({ templates: urls })
  } catch (error) {
    console.error('[contracts/templates] Error:', error)
    res.status(500).json({ error: 'Failed to load contract templates' })
  }
}
