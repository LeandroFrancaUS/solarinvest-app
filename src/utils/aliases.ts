export const aliasDictionary: Record<string, string> = {
  T0: 'tarifaCheia',
  tarifaCheia: 'tarifaCheia',
  tarifa_base: 'tarifaCheia',
  tarifaAtual: 'tarifaCheia',
  desconto: 'desconto',
  descontoContratual: 'desconto',
  disc: 'desconto',
  inflacao_aa: 'inflacaoAa',
  ipca_aa: 'inflacaoAa',
  g_m: 'inflacaoMensal',
  inflacao_mensal: 'inflacaoMensal',
  taxaMensal: 'inflacaoMensal',
  Kc: 'kcKwhMes',
  pisoContratado: 'kcKwhMes',
  energiaContratada: 'kcKwhMes',
  taxa_minima: 'taxaMinima',
  pisoMensal: 'taxaMinima',
  encargos: 'encargosFixos',
  encargos_fixos: 'encargosFixos',
  cip_bandeira: 'encargosFixos',
  entrada: 'entradaRs',
  entrada_valor: 'entradaRs',
  prazo: 'prazoMeses',
  prazo_meses: 'prazoMeses',
  VM0: 'vm0',
  valorMercado: 'vm0',
  dep_aa: 'depreciacaoAa',
  depreciacao_aa: 'depreciacaoAa',
  opex: 'opexM',
  opex_m: 'opexM',
  custo_om: 'opexM',
  seguro: 'seguroM',
  seguro_m: 'seguroM',
  custos_fixos: 'custosFixosM',
  custos_fixos_m: 'custosFixosM',
  pagos_acum: 'pagosAcumAteM',
  pagos_acumulados_ate_m: 'pagosAcumAteM',
}

export type CanonicalKey =
  | 'tarifaCheia'
  | 'desconto'
  | 'inflacaoAa'
  | 'inflacaoMensal'
  | 'kcKwhMes'
  | 'taxaMinima'
  | 'encargosFixos'
  | 'entradaRs'
  | 'prazoMeses'
  | 'vm0'
  | 'depreciacaoAa'
  | 'opexM'
  | 'seguroM'
  | 'custosFixosM'
  | 'pagosAcumAteM'

export const canonicalKeys = new Set<CanonicalKey>([
  'tarifaCheia',
  'desconto',
  'inflacaoAa',
  'inflacaoMensal',
  'kcKwhMes',
  'taxaMinima',
  'encargosFixos',
  'entradaRs',
  'prazoMeses',
  'vm0',
  'depreciacaoAa',
  'opexM',
  'seguroM',
  'custosFixosM',
  'pagosAcumAteM',
])
