export type TipoRede = 'monofasico' | 'bifasico' | 'trifasico'

export const CONSUMO_MINIMO_FICTICIO: Record<TipoRede, number> = {
  monofasico: 30,
  bifasico: 50,
  trifasico: 100,
}
