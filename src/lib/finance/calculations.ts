import { CONSUMO_MINIMO_FICTICIO, type TipoRede } from '../../shared/rede'

export type TusdConfig = {
  percentualFioB?: number | null
  simultaneidade?: number | null
  tarifaRkwh?: number | null
  tarifaFioBOficial?: number | null
  fatorIncidenciaLei14300?: number | null
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
  tarifaFioBOficial: number | null | undefined,
  fatorIncidenciaLei14300: number | null | undefined,
): number {
  if (!Number.isFinite(energiaGeradaKwh) || energiaGeradaKwh <= 0) return 0

  const simultaneidadeEfetiva = Number.isFinite(simultaneidade)
    ? Math.min(1, Math.max(0, simultaneidade as number))
    : 0.6
  const energiaCompensadaKwh = Math.max(0, energiaGeradaKwh * (1 - simultaneidadeEfetiva))

  const tarifaFioBAplicada = Number.isFinite(tarifaFioBOficial) && (tarifaFioBOficial as number) > 0
    ? (tarifaFioBOficial as number)
    : Number.isFinite(tarifaTusdRkwh) && Number.isFinite(percentual)
      ? // Fallback legado: aproximar Fio B a partir da TUSD total informada e percentual legado
        (tarifaTusdRkwh as number) * (percentual as number)
      : 0

  const fatorIncidencia = Number.isFinite(fatorIncidenciaLei14300)
    ? Math.min(1, Math.max(0, fatorIncidenciaLei14300 as number))
    : 1

  const tusdFioB = tarifaFioBAplicada * energiaCompensadaKwh * fatorIncidencia
  return Number.isFinite(tusdFioB) && tusdFioB >= 0 ? tusdFioB : 0
}

export function calcularValorContaRede({
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
    tusd?.tarifaFioBOficial,
    tusd?.fatorIncidenciaLei14300,
  )
  const valorCIP = Number.isFinite(cipValor) && (cipValor as number) >= 0 ? (cipValor as number) : 0
  const valorContaRede = taxaMinima + valorCIP + tusdFioB

  // valorContaRede representa o valor estimado pago à distribuidora (taxa mínima + CIP + Fio B).
  // Trata-se de uma aproximação sujeita a variações reais de tarifa, bandeiras, tributos e consumo.
  return Number.isFinite(valorContaRede) ? valorContaRede : 0
}

// Compatibilidade legada: manter o nome anterior para fluxos que ainda referenciam a "mensalidade".
// O valor retornado segue representando apenas o gasto estimado com a distribuidora.
export const calcularMensalidadeSolarInvest = calcularValorContaRede

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
  const valorContaRede = calcularMensalidadeSolarInvest({
    tarifaCheia,
    inflacaoEnergetica,
    anosDecorridos,
    tipoLigacao,
    cipValor,
    tusd,
    energiaGeradaKwh,
  })
  const economia = contaSemSolar - valorContaRede
  return Number.isFinite(economia) ? economia : 0
}
