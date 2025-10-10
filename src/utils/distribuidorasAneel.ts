const CSV_URL =
  'https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica/resource/fcf2906c-7c32-4b9b-a637-054e7a5234f4/download/tarifas-homologadas-distribuidoras-energia-eletrica.csv'

const FALLBACK_DISTRIBUIDORAS: Record<string, string[]> = {
  AC: ['Energisa Acre'],
  AL: ['Equatorial Alagoas'],
  AM: ['Amazonas Energia'],
  AP: ['Equatorial Amapá', 'Companhia de Eletricidade do Amapá'],
  BA: ['Neoenergia Coelba', 'Coelba'],
  CE: ['Enel Ceará', 'Enel Distribuição Ceará'],
  DF: ['Neoenergia Brasília'],
  ES: ['EDP Espírito Santo'],
  GO: ['Equatorial Goiás', 'Enel Goiás'],
  MA: ['Equatorial Maranhão'],
  MG: ['Cemig Distribuição', 'Energisa Minas Gerais', 'Energisa Sul-Sudeste'],
  MS: ['Energisa Mato Grosso do Sul'],
  MT: ['Energisa Mato Grosso'],
  PA: ['Equatorial Pará', 'Celpa'],
  PB: ['Energisa Paraíba'],
  PE: ['Neoenergia Pernambuco', 'Celpe'],
  PI: ['Equatorial Piauí'],
  PR: ['Copel Distribuição'],
  RJ: ['Light', 'Enel Rio', 'Enel Distribuição Rio'],
  RN: ['Neoenergia Cosern', 'Cosern'],
  RO: ['Energisa Rondônia'],
  RR: ['Roraima Energia'],
  RS: ['CEEE Equatorial', 'RGE Sul'],
  SC: ['Celesc Distribuição'],
  SE: ['Energisa Sergipe'],
  SP: ['Enel São Paulo', 'Enel Distribuição São Paulo', 'CPFL Paulista', 'CPFL Piratininga', 'Elektro', 'Energisa Sul-Sudeste'],
  TO: ['Energisa Tocantins'],
}

const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

const buildFallback = () => {
  const distribuidorasPorUf: Record<string, string[]> = {}
  for (const [uf, lista] of Object.entries(FALLBACK_DISTRIBUIDORAS)) {
    distribuidorasPorUf[uf] = [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }
  const ufs = Object.keys(distribuidorasPorUf).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { ufs, distribuidorasPorUf }
}

const fallbackResultado = buildFallback()

export interface DistribuidorasAneel {
  ufs: string[]
  distribuidorasPorUf: Record<string, string[]>
}

let cachePromise: Promise<DistribuidorasAneel> | null = null
let resolvedCache: DistribuidorasAneel | null = null

export function getDistribuidorasFallback(): DistribuidorasAneel {
  return fallbackResultado
}

const mergeWithFallback = (map: Map<string, Map<string, string>>): DistribuidorasAneel => {
  const combined = new Map<string, Map<string, string>>()

  for (const [uf, lista] of Object.entries(FALLBACK_DISTRIBUIDORAS)) {
    const ufKey = norm(uf).slice(0, 2)
    if (!combined.has(ufKey)) {
      combined.set(ufKey, new Map())
    }
    const existing = combined.get(ufKey)!
    for (const item of lista) {
      existing.set(norm(item), item)
    }
  }

  for (const [uf, lista] of map.entries()) {
    if (!combined.has(uf)) {
      combined.set(uf, new Map())
    }
    const existing = combined.get(uf)!
    for (const [normKey, original] of lista.entries()) {
      existing.set(normKey, original)
    }
  }

  const distribuidorasPorUf: Record<string, string[]> = {}
  const ufs = Array.from(combined.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  for (const uf of ufs) {
    const lista = combined.get(uf)!
    distribuidorasPorUf[uf] = Array.from(lista.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  return { ufs, distribuidorasPorUf }
}

export async function loadDistribuidorasAneel(): Promise<DistribuidorasAneel> {
  if (resolvedCache) {
    return resolvedCache
  }

  if (cachePromise) {
    return cachePromise
  }

  cachePromise = (async () => {
    try {
      const response = await fetch(CSV_URL, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Falha ${response.status}`)
      }

      const text = await response.text()
      const linhas = text.split(/\r?\n/).filter((linha) => linha.trim().length > 0)
      if (linhas.length === 0) {
        return fallbackResultado
      }

      const delimiter = linhas[0].includes(';') ? ';' : ','
      const cabecalho = parseCsvLine(linhas[0], delimiter)

      const idxUf = cabecalho.findIndex((cell) => ['UF', 'SIGLA_UF'].includes(norm(cell)))
      const idxDistribuidora = cabecalho.findIndex((cell) =>
        ['DISTRIBUIDORA', 'AGENTE', 'CONCESSIONARIA'].includes(norm(cell)),
      )

      if (idxUf < 0 || idxDistribuidora < 0) {
        return fallbackResultado
      }

      const mapa = new Map<string, Map<string, string>>()

      for (let i = 1; i < linhas.length; i += 1) {
        const partes = parseCsvLine(linhas[i], delimiter)
        if (partes.length <= Math.max(idxUf, idxDistribuidora)) continue

        const ufBruto = partes[idxUf]
        const distBruto = partes[idxDistribuidora]
        if (!ufBruto || !distBruto) continue

        const uf = norm(ufBruto)
        if (uf.length !== 2) continue

        const distNormalizado = norm(distBruto)
        if (!distNormalizado) continue

        if (!mapa.has(uf)) {
          mapa.set(uf, new Map())
        }

        const atual = mapa.get(uf)!
        if (!atual.has(distNormalizado)) {
          atual.set(distNormalizado, distBruto.trim())
        }
      }

      const resultado = mergeWithFallback(mapa)
      resolvedCache = resultado
      return resultado
    } catch (error) {
      console.warn('[ANEEL] Falha ao carregar lista de distribuidoras, usando fallback local.', error)
      resolvedCache = fallbackResultado
      return fallbackResultado
    }
  })()

  const resultado = await cachePromise
  cachePromise = null
  return resultado
}

