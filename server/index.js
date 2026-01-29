import { createServer } from 'node:http'
import { handleRequest } from './handler.js'

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)

createServer((req, res) => handleRequest(req, res))
  .listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
