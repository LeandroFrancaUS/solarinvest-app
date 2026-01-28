export type TipoRede = 'nenhum' | 'monofasico' | 'bifasico' | 'trifasico'

export const CONSUMO_MINIMO_FICTICIO: Record<TipoRede, number> = {
  nenhum: 0,
  monofasico: 30,
  bifasico: 50,
  trifasico: 100,
}
