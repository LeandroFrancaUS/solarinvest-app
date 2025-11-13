export const normalizeNewlines = (value: string): string => {
  return value.split("\r\n").join("\n").split("\r").join("\n")
}

export const splitOnBlankLines = (value: string): string[] => {
  const normalized = normalizeNewlines(value)
  const lines = normalized.split("\n")
  const paragraphs: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        const paragraph = current.join("\n").trim()
        if (paragraph) {
          paragraphs.push(paragraph)
        }
        current = []
      }
    } else {
      current.push(line)
    }
  }

  if (current.length > 0) {
    const paragraph = current.join("\n").trim()
    if (paragraph) {
      paragraphs.push(paragraph)
    }
  }

  return paragraphs
}
