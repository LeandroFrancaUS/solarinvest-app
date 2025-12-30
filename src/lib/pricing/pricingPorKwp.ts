export type Rede = 'mono' | 'trifasico'

const MONO_ANCHORS = [
  { kwp: 2.7, custoFinal: 7912.83, kitValor: 4138.79 },
  { kwp: 4.32, custoFinal: 10063.53, kitValor: 5590.18 },
  { kwp: 8.1, custoFinal: 16931.2, kitValor: 9416.0 },
  { kwp: 15.66, custoFinal: 30328.53, kitValor: 17647.64 },
  { kwp: 23.22, custoFinal: 44822.0, kitValor: 26982.46 },
] as const

const TRIFASICO_ANCHORS = [
  { kwp: 23.22, custoFinal: 46020.29, kitValor: 27904.22 },
  { kwp: 38.88, custoFinal: 73320.83, kitValor: 46665.64 },
] as const

const MIN_KWP = MONO_ANCHORS[0].kwp
const MAX_AUTOMATIC_KWP = 90
const MIN_CUSTO_FINAL = MONO_ANCHORS[0].custoFinal
const MIN_KIT_VALOR = MONO_ANCHORS[0].kitValor

const toFixedNumber = (value: number): number => Number(value.toFixed(2))

const interpolate = (
  kwp: number,
  anchors: readonly { kwp: number; custoFinal: number; kitValor: number }[],
  key: 'custoFinal' | 'kitValor',
): number => {
  if (anchors.length < 2) {
    return anchors[0]?.[key] ?? 0
  }

  if (kwp <= anchors[0].kwp) {
    return anchors[0][key]
  }

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const current = anchors[i]
    const next = anchors[i + 1]
    if (kwp <= next.kwp) {
      const slope = (next[key] - current[key]) / (next.kwp - current.kwp)
      return current[key] + slope * (kwp - current.kwp)
    }
  }

  const last = anchors[anchors.length - 1]
  const prev = anchors[anchors.length - 2]
  const slope = (last[key] - prev[key]) / (last.kwp - prev.kwp)
  return last[key] + slope * (kwp - last.kwp)
}

export const getRedeByPotencia = (kwp: number): Rede =>
  kwp > MONO_ANCHORS[MONO_ANCHORS.length - 1].kwp ? 'trifasico' : 'mono'

export const calcPricingPorKwp = (
  kwp: number,
): { rede: Rede; custoFinal: number; kitValor: number } | null => {
  if (!Number.isFinite(kwp) || kwp <= 0 || kwp > MAX_AUTOMATIC_KWP) {
    return null
  }

  const rede = getRedeByPotencia(kwp)
  const anchors = rede === 'mono' ? MONO_ANCHORS : TRIFASICO_ANCHORS

  const custoBruto = interpolate(kwp, anchors, 'custoFinal')
  const kitBruto = interpolate(kwp, anchors, 'kitValor')

  const custoFinal = kwp <= MIN_KWP ? MIN_CUSTO_FINAL : Math.max(custoBruto, 1)
  const kitValor = kwp <= MIN_KWP ? MIN_KIT_VALOR : Math.max(kitBruto, 1)

  return {
    rede,
    custoFinal: toFixedNumber(custoFinal),
    kitValor: toFixedNumber(kitValor),
  }
}

export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
