const CRLF = Buffer.from('\r\n')

const parseContentDisposition = (value) => {
  const result = {}
  const parts = value.split(';').map((part) => part.trim())
  for (const part of parts) {
    const [key, rawValue] = part.split('=')
    if (!rawValue) continue
    const cleaned = rawValue.trim().replace(/^"|"$/g, '')
    if (key) {
      result[key.trim()] = cleaned
    }
  }
  return result
}

export const parseMultipartFormData = (bodyBuffer, boundary) => {
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`)
  const parts = []

  let position = bodyBuffer.indexOf(boundaryBuffer)
  if (position === -1) {
    return parts
  }

  position += boundaryBuffer.length

  while (position < bodyBuffer.length) {
    if (bodyBuffer.slice(position, position + 2).equals(Buffer.from('--'))) {
      break
    }

    if (bodyBuffer.slice(position, position + 2).equals(CRLF)) {
      position += 2
    }

    const headerEnd = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), position)
    if (headerEnd === -1) {
      break
    }

    const headerRaw = bodyBuffer.slice(position, headerEnd).toString('utf8')
    const headers = {}
    for (const line of headerRaw.split('\r\n')) {
      const [headerName, ...rest] = line.split(':')
      if (!headerName || rest.length === 0) continue
      headers[headerName.toLowerCase()] = rest.join(':').trim()
    }

    const contentStart = headerEnd + 4
    let nextBoundary = bodyBuffer.indexOf(boundaryBuffer, contentStart)
    if (nextBoundary === -1) {
      nextBoundary = bodyBuffer.indexOf(endBoundaryBuffer, contentStart)
    }
    if (nextBoundary === -1) {
      break
    }

    const contentEnd = nextBoundary - CRLF.length
    const content = bodyBuffer.slice(contentStart, contentEnd)

    const disposition = headers['content-disposition']
      ? parseContentDisposition(headers['content-disposition'])
      : {}

    parts.push({
      headers,
      name: disposition.name,
      filename: disposition.filename,
      content,
    })

    position = nextBoundary + boundaryBuffer.length
  }

  return parts
}
