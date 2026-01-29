export function anosAlvoEconomia(prazoMeses: number): number[] {
  const prazoAnos = Math.round((prazoMeses ?? 0) / 12)
  const candidatos = [prazoAnos, prazoAnos + 1, 10, 15, 20, 30]

  const uniq = Array.from(new Set(candidatos))
  uniq.sort((a, b) => a - b)

  return uniq.filter((ano) => ano >= 1 && ano <= 30)
}
