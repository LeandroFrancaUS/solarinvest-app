export async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let length = 0
    req.on('data', (chunk) => {
      chunks.push(chunk)
      length += chunk.length
      if (length > 1_000_000) {
        reject(new Error('Payload muito grande'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks, length).toString('utf-8'))
        resolve(parsed)
      } catch (error) {
        reject(new Error('JSON inválido'))
      }
    })
    req.on('error', (error) => {
      reject(error)
    })
  })
}
