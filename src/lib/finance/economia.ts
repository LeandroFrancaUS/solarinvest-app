export interface EconomiaAnual {
  ano: number
  economiaAcumulada: number
}

export function calcularEconomiaAcumuladaPorAnos(
  alvos: number[],
  calcularEconomia: (ano: number) => number,
): EconomiaAnual[] {
  return alvos.map((ano) => ({
    ano,
    economiaAcumulada: calcularEconomia(ano),
  }))
}
