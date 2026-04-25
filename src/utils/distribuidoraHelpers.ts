export const getDistribuidoraDefaultForUf = (uf?: string | null): string => {
  const normalized = uf?.trim().toUpperCase() ?? ''
  if (normalized === 'GO') {
    return 'Equatorial Goiás'
  }
  if (normalized === 'DF') {
    return 'Neoenergia Brasilia'
  }
  return ''
}

export const resolveUfForDistribuidora = (
  distribuidorasPorUf: Record<string, string[]>,
  distribuidora?: string | null,
): string => {
  const alvo = distribuidora?.trim()
  if (!alvo) {
    return ''
  }
  const alvoNormalizado = alvo.toLowerCase()
  for (const [uf, distribuidoras] of Object.entries(distribuidorasPorUf)) {
    if (distribuidoras.some((item) => item.toLowerCase() === alvoNormalizado)) {
      return uf
    }
  }
  return ''
}
