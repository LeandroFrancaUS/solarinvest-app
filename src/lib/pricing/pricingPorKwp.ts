export type Rede = 'mono' | 'trifasico'

export const CUSTO_FINAL_MONO_POINTS = [
  { kwp: 2.7, value: 7912.83 },
  { kwp: 4.32, value: 10063.53 },
  { kwp: 8.1, value: 16931.2 },
  { kwp: 15.66, value: 30328.53 },
  { kwp: 23.22, value: 44822 },
]

export const CUSTO_FINAL_TRI_POINTS = [
  { kwp: 23.22, value: 46020.29 },
  { kwp: 38.88, value: 73320.83 },
]

export const KIT_MONO_POINTS = [
  { kwp: 2.7, value: 4138.79 },
  { kwp: 4.32, value: 5590.18 },
  { kwp: 8.1, value: 9416 },
  { kwp: 15.66, value: 17647.64 },
  { kwp: 23.22, value: 26982.46 },
]

export const KIT_TRI_POINTS = [
  { kwp: 23.22, value: 27904.22 },
  { kwp: 38.88, value: 46665.64 },
]

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function getRedeByPotencia(kwp: number): Rede {
  if (!Number.isFinite(kwp) || kwp <= 0) {
    return 'mono'
  }
  return kwp > 23.22 ? 'trifasico' : 'mono'
}

const lerp = (x: number, x0: number, y0: number, x1: number, y1: number): number =>
  y0 + ((y1 - y0) / (x1 - x0)) * (x - x0)

const interpolatePiecewise = (
  x: number,
  points: Array<{ kwp: number; value: number }>,
  piso?: number,
): number => {
  if (points.length === 0) {
    return 0
  }

  if (x <= points[0].kwp) {
    return piso ?? points[0].value
  }

  if (x >= points[points.length - 1].kwp) {
    const penultimate = points[points.length - 2]
    const last = points[points.length - 1]
    return lerp(x, penultimate.kwp, penultimate.value, last.kwp, last.value)
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    if (current.kwp <= x && x <= next.kwp) {
      return lerp(x, current.kwp, current.value, next.kwp, next.value)
    }
  }

  return points[points.length - 1].value
}

export function calcPricingPorKwp(kwp: number):
  | { rede: Rede; custoFinal: number; kitValor: number }
  | null {
  if (!Number.isFinite(kwp) || kwp <= 0) {
    return null
  }

  const rede = getRedeByPotencia(kwp)
  const pisoCustoFinal = 7912.83
  const pisoKitValor = 4138.79

  const custoFinal = (() => {
    if (rede === 'mono') {
      return interpolatePiecewise(kwp, CUSTO_FINAL_MONO_POINTS, pisoCustoFinal)
    }
    return interpolatePiecewise(kwp, CUSTO_FINAL_TRI_POINTS)
  })()

  const kitValor = (() => {
    if (rede === 'mono') {
      return interpolatePiecewise(kwp, KIT_MONO_POINTS, pisoKitValor)
    }
    return interpolatePiecewise(kwp, KIT_TRI_POINTS)
  })()

  const sanitizedCusto = Math.max(1, Math.round(custoFinal * 100) / 100)
  const sanitizedKit = Math.max(1, Math.round(kitValor * 100) / 100)

  return {
    rede,
    custoFinal: sanitizedCusto,
    kitValor: sanitizedKit,
  }
}

export const __internal = {
  lerp,
  interpolatePiecewise,
}
