import { CONSUMO_MINIMO_FICTICIO, type TipoRede } from '../../app/config'

export type TusdConfig = {
  percentualFioB?: number | null
  simultaneidade?: number | null
  tarifaRkwh?: number | null
}

export interface MensalidadeInput {
  tarifaCheia: number
  inflacaoEnergetica: number
  anosDecorridos: number
  tipoLigacao: TipoRede
  cipValor?: number
  tusd?: TusdConfig | null
  energiaGeradaKwh?: number
}

export interface EconomiaMensalInput extends MensalidadeInput {
  consumoMensalKwh: number
}

export function calcularTarifaProjetada(tarifaCheia: number, inflacaoEnergetica: number, anos: number): number {
  if (!Number.isFinite(tarifaCheia)) return 0
  if (!Number.isFinite(anos) || anos <= 0) return Math.max(0, tarifaCheia)
  const inflacao = Number.isFinite(inflacaoEnergetica) ? inflacaoEnergetica : 0
  return Math.max(0, tarifaCheia) * Math.pow(1 + inflacao, Math.max(0, anos))
}

export function calcularTaxaMinima(tipoLigacao: TipoRede, tarifa: number): number {
  const consumoMinimo = CONSUMO_MINIMO_FICTICIO[tipoLigacao]
  if (!Number.isFinite(consumoMinimo) || !Number.isFinite(tarifa)) return 0
  return Math.max(0, tarifa) * consumoMinimo
}

export function calcularTUSDFioB(
  energiaGeradaKwh: number,
  simultaneidade: number | null | undefined,
  percentual: number | null | undefined,
  tarifaTusdRkwh: number | null | undefined,
): number {
  if (!Number.isFinite(energiaGeradaKwh) || energiaGeradaKwh <= 0) return 0
  const percFioB = Number.isFinite(percentual) ? (percentual as number) : 0
  const simult = Number.isFinite(simultaneidade) ? (simultaneidade as number) : 0.6
  const tarifa = Number.isFinite(tarifaTusdRkwh) ? (tarifaTusdRkwh as number) : 0
  const energiaInjetada = energiaGeradaKwh * (1 - simult)
  return tarifa * percFioB * Math.max(0, energiaInjetada)
}

export function calcularMensalidadeSolarInvest({
  tarifaCheia,
  inflacaoEnergetica,
  anosDecorridos,
  tipoLigacao,
  cipValor = 0,
  tusd,
  energiaGeradaKwh = 0,
}: MensalidadeInput): number {
  const tarifaProjetada = calcularTarifaProjetada(tarifaCheia, inflacaoEnergetica, anosDecorridos)
  const taxaMinima = calcularTaxaMinima(tipoLigacao, tarifaProjetada)
  const tusdFioB = calcularTUSDFioB(
    energiaGeradaKwh,
    tusd?.simultaneidade,
    tusd?.percentualFioB,
    tusd?.tarifaRkwh,
  )
  const mensalidade = taxaMinima + Math.max(0, cipValor ?? 0) + tusdFioB
  return Number.isFinite(mensalidade) ? mensalidade : 0
}

export function calcularEconomiaMensal({
  consumoMensalKwh,
  tarifaCheia,
  inflacaoEnergetica,
  anosDecorridos,
  tipoLigacao,
  cipValor = 0,
  tusd,
  energiaGeradaKwh = 0,
}: EconomiaMensalInput): number {
  const tarifaProjetada = calcularTarifaProjetada(tarifaCheia, inflacaoEnergetica, anosDecorridos)
  const contaSemSolar = Math.max(0, consumoMensalKwh) * tarifaProjetada + Math.max(0, cipValor ?? 0)
  const mensalidade = calcularMensalidadeSolarInvest({
    tarifaCheia,
    inflacaoEnergetica,
    anosDecorridos,
    tipoLigacao,
    cipValor,
    tusd,
    energiaGeradaKwh,
  })
  const economia = contaSemSolar - mensalidade
  return Number.isFinite(economia) ? economia : 0
}
