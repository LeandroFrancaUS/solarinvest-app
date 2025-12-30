export type Rede = 'mono' | 'trifasico'

type Anchor = { kwp: number; custoFinal: number; kitValor: number; rede: Rede }

const monoAnchors: Anchor[] = [
  { kwp: 2.7, custoFinal: 7912.83, kitValor: 4138.79, rede: 'mono' },
  { kwp: 4.32, custoFinal: 10063.53, kitValor: 5590.18, rede: 'mono' },
  { kwp: 8.1, custoFinal: 16931.2, kitValor: 9416.0, rede: 'mono' },
  { kwp: 15.66, custoFinal: 30328.53, kitValor: 17647.64, rede: 'mono' },
  { kwp: 23.22, custoFinal: 44822.0, kitValor: 26982.46, rede: 'mono' },
]

const triAnchors: Anchor[] = [
  { kwp: 23.22, custoFinal: 46020.29, kitValor: 27904.22, rede: 'trifasico' },
  { kwp: 38.88, custoFinal: 73320.83, kitValor: 46665.64, rede: 'trifasico' },
]

const MAX_KWP = 90

const clampPositive = (value: number): number => (value <= 0 ? 1 : value)

export function getRedeByPotencia(kwp: number): Rede {
  return kwp > triAnchors[0].kwp ? 'trifasico' : 'mono'
}

const interpolate = (kwp: number, anchors: Anchor[]): { custoFinal: number; kitValor: number } => {
  if (kwp <= anchors[0].kwp) {
    return { custoFinal: anchors[0].custoFinal, kitValor: anchors[0].kitValor }
  }

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (kwp >= a.kwp && kwp <= b.kwp) {
      const t = (kwp - a.kwp) / (b.kwp - a.kwp)
      const custoFinal = a.custoFinal + t * (b.custoFinal - a.custoFinal)
      const kitValor = a.kitValor + t * (b.kitValor - a.kitValor)
      return { custoFinal, kitValor }
    }
  }

  const last = anchors[anchors.length - 1]
  const penultimate = anchors[anchors.length - 2]
  const slopeCusto = (last.custoFinal - penultimate.custoFinal) / (last.kwp - penultimate.kwp)
  const slopeKit = (last.kitValor - penultimate.kitValor) / (last.kwp - penultimate.kwp)
  const custoFinal = last.custoFinal + slopeCusto * (kwp - last.kwp)
  const kitValor = last.kitValor + slopeKit * (kwp - last.kwp)
  return { custoFinal, kitValor }
}

export function calcPricingPorKwp(
  kwp: number,
): { rede: Rede; custoFinal: number; kitValor: number } | null {
  if (!Number.isFinite(kwp) || kwp <= 0 || kwp > MAX_KWP) {
    return null
  }

  const rede = getRedeByPotencia(kwp)
  const anchors = rede === 'mono' ? monoAnchors : triAnchors
  const { custoFinal, kitValor } = interpolate(kwp, anchors)

  return {
    rede,
    custoFinal: clampPositive(custoFinal),
    kitValor: clampPositive(kitValor),
  }
}

export function formatBRL(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0
  return safeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
