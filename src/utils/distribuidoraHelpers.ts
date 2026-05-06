import { normalizeCidade } from './textUtils'

/**
 * Retorna o valor padrão dos custos fixos da conta de energia (R$/mês)
 * para cidades-alvo conhecidas.  Retorna null quando a cidade não é reconhecida.
 */
export const getCustosFixosContaEnergiaPadrao = (cidade?: string | null): number | null => {
  const normalized = normalizeCidade(cidade ?? '')
  if (!normalized) return null
  if (normalized.includes('goiania')) return 15
  if (normalized.includes('brasilia')) return 10
  if (normalized.includes('anapolis')) return 6
  return null
}

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
