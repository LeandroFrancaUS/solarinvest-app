import React, { useMemo } from 'react'

import './styles/print-common.css'
import './styles/proposal-leasing.css'
import { currency, tarifaCurrency } from '../../utils/formatters'
import { formatMoneyBR, formatNumberBRWithOptions, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import type { BuyoutResumo, BuyoutRow, ClienteDados } from '../../types/printableProposal'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import {
  analisarBuyout,
  MESES_ROI_BUYOUT_PADRAO,
  LIMITE_MELHOR_MES_PADRAO,
  VIDA_UTIL_PADRAO_MESES,
} from '../../lib/finance/leasing-buyout-analysis'

const formatPrazoContratual = (meses: number): string => {
  if (!Number.isFinite(meses) || meses <= 0) {
    return '—'
  }

  const anos = meses / 12
  const fractionDigits = Number.isInteger(anos) ? 0 : 1
  const anosTexto = formatNumberBRWithOptions(anos, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  const mesesTexto = formatNumberBRWithOptions(meses, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return `${anosTexto} anos (${mesesTexto} meses)`
}

const formatCurrencyOrDash = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }
  return currency(Math.max(0, value))
}

const formatDate = (value: Date): string =>
  value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export type PrintableBuyoutTableProps = {
  cliente: ClienteDados
  budgetId: string
  tabelaBuyout: BuyoutRow[]
  buyoutResumo: BuyoutResumo
  prazoContratualMeses: number
  emissaoIso?: string | null
  observacaoImportante?: string | null
}

type BuyoutEligibleRow = BuyoutRow & { valorResidual: number }

type PrintableBuyoutTableInnerProps = PrintableBuyoutTableProps

function PrintableBuyoutTableInner(
  props: PrintableBuyoutTableInnerProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    cliente,
    budgetId,
    tabelaBuyout,
    buyoutResumo,
    prazoContratualMeses,
    emissaoIso,
    observacaoImportante,
  } = props

  const buyoutRowsElegiveis = useMemo<BuyoutEligibleRow[]>(() => {
    if (!Array.isArray(tabelaBuyout)) {
      return []
    }

    return tabelaBuyout
      .filter((row): row is BuyoutEligibleRow =>
        row.valorResidual != null && Number.isFinite(row.valorResidual),
      )
      .filter((row) => row.mes >= 7)
      .map((row) => ({
        ...row,
        valorResidual: Math.max(0, row.valorResidual ?? 0),
        prestacaoEfetiva: Number.isFinite(row.prestacaoEfetiva)
          ? Math.max(0, row.prestacaoEfetiva)
          : 0,
        prestacaoAcum: Number.isFinite(row.prestacaoAcum) ? Math.max(0, row.prestacaoAcum) : 0,
        cashback: Number.isFinite(row.cashback) ? Math.max(0, row.cashback) : 0,
        tarifa: Number.isFinite(row.tarifa) ? Math.max(0, row.tarifa) : 0,
      }))
      .sort((a, b) => a.mes - b.mes)
  }, [tabelaBuyout])

  // Análise de melhor mês e ROI do buyout (meses 7–36 e tabela 7→45 em intervalos de 6 meses)
  const buyoutAnalise = useMemo(() => {
    const geracaoKwhMes = buyoutResumo?.geracaoMensalKwh ?? 0
    const inflacaoAa = buyoutResumo?.infEnergia ?? 0

    if (
      !Array.isArray(tabelaBuyout) ||
      tabelaBuyout.length === 0 ||
      geracaoKwhMes <= 0
    ) {
      return null
    }

    return analisarBuyout({
      tabelaBuyout,
      geracaoKwhMes,
      inflacaoAa,
      limiteMelhorMes: LIMITE_MELHOR_MES_PADRAO,
      mesesRoi: MESES_ROI_BUYOUT_PADRAO,
    })
  }, [tabelaBuyout, buyoutResumo])

  const buyoutTabelaDisponivel = buyoutRowsElegiveis.length > 0
  const buyoutPrimeiroRow = buyoutRowsElegiveis.length > 0 ? buyoutRowsElegiveis[0] : null
  const buyoutUltimoRow = buyoutRowsElegiveis.length > 0 ? buyoutRowsElegiveis[buyoutRowsElegiveis.length - 1] : null
  const buyoutPrimeiroMesTexto = buyoutPrimeiroRow ? `${buyoutPrimeiroRow.mes}º` : '—'
  const buyoutUltimoMesTexto = buyoutUltimoRow ? `${buyoutUltimoRow.mes}º` : '—'
  const buyoutJanelaTexto =
    buyoutPrimeiroRow && buyoutUltimoRow
      ? `${buyoutPrimeiroRow.mes}º ao ${buyoutUltimoRow.mes}º mês`
      : '—'
  const buyoutPrestacaoAcumuladaTexto = formatCurrencyOrDash(buyoutUltimoRow?.prestacaoAcum)
  const buyoutPrimeiroValorTexto = formatCurrencyOrDash(buyoutPrimeiroRow?.valorResidual)
  const buyoutUltimoValorTexto = formatCurrencyOrDash(buyoutUltimoRow?.valorResidual)

  const buyoutHeroSummary: React.ReactNode = buyoutTabelaDisponivel ? (
    <>
      A tabela a seguir apresenta os valores estimados para transferir a posse da usina entre o{' '}
      <strong>{buyoutPrimeiroMesTexto}</strong> e o <strong>{buyoutUltimoMesTexto}</strong> mês do contrato de leasing.
      Os valores consideram as prestações pagas ({buyoutPrestacaoAcumuladaTexto}). No primeiro mês elegível, o valor
      projetado é{' '}
      <strong>{buyoutPrimeiroValorTexto}</strong>; ao final do contrato, a projeção é{' '}
      <strong>{buyoutUltimoValorTexto}</strong>.
    </>
  ) : (
    <>
      Não há valores calculados para a transferência antecipada desta proposta no momento. Solicite ao consultor
      SolarInvest a atualização da simulação para gerar a tabela de valor de transferência.
    </>
  )

  const clienteCampos: ClientInfoField[] = [
    { label: 'Cliente', value: cliente.nome?.trim() || '—' },
    { label: 'CPF/CNPJ', value: cliente.documento?.trim() || '—' },
    { label: 'Unidade consumidora (UC)', value: cliente.uc?.trim() || '—' },
  ]

  const emissaoData = emissaoIso ? new Date(emissaoIso) : new Date()
  const emissaoTexto = Number.isNaN(emissaoData.getTime()) ? formatDate(new Date()) : formatDate(emissaoData)
  const prazoContratualNormalizado = Math.max(0, Math.floor(prazoContratualMeses))
  const prazoContratualTexto = formatPrazoContratual(prazoContratualNormalizado)
  const duracaoMesesExibicao = Math.max(7, prazoContratualNormalizado + 1)

  const investimentoSolarinvestFormatado = Number.isFinite(buyoutResumo?.vm0)
    ? formatMoneyBR(Math.max(0, buyoutResumo.vm0 ?? 0))
    : '—'

  const buyoutResumoIndicadores = [
    { label: 'Janela considerada', value: buyoutJanelaTexto },
    { label: 'Valor de mercado estimado (VM0)', value: investimentoSolarinvestFormatado },
    { label: 'Prestação acumulada até o mês final', value: buyoutPrestacaoAcumuladaTexto },
    { label: 'Compra no primeiro mês elegível', value: buyoutPrimeiroValorTexto },
    { label: 'Compra ao final do contrato', value: buyoutUltimoValorTexto },
    ...(buyoutAnalise?.melhorMes != null
      ? [
          {
            label: `Melhor mês para buyout (até o ${LIMITE_MELHOR_MES_PADRAO}º mês)`,
            value: `${buyoutAnalise.melhorMes}º mês — valor de compra ${formatCurrencyOrDash(buyoutAnalise.melhorMesValorResidual)}`,
          },
        ]
      : []),
  ]

  const observacaoTexto = observacaoImportante?.trim() || null

  return (
    <div ref={ref} className="print-root">
      <div className="print-layout leasing-print-layout buyout-print-layout" data-print-section="buyout-table">
        <div className="print-page">
          <section className="print-section print-section--hero avoid-break">
            <div className="print-hero">
              <div className="print-hero__header">
                <div className="print-hero__identity">
                  <div className="print-logo">
                    <img src="/proposal-header-logo.svg" alt="Marca SolarInvest" />
                  </div>
                  <div className="print-hero__title">
                    <span className="print-hero__eyebrow">SolarInvest</span>
                    <div className="print-hero__headline">
                      <img
                        className="print-hero__title-logo"
                        src="/proposal-header-logo.svg"
                        alt="Marca SolarInvest"
                      />
                      <h1>Tabela de Valor de Transferencia Antecipada</h1>
                    </div>
                    <p className="print-hero__tagline">Valores estimados para aquisição antecipada da usina SolarInvest.</p>
                  </div>
                </div>
              </div>
              <div className="print-hero__meta">
                <div className="print-hero__meta-item">
                  <small>Código do orçamento: </small>
                  <strong>{budgetId || '—'}</strong>
                </div>
                <div className="print-hero__meta-item">
                  <small>Prazo contratual: </small>
                  <strong>{prazoContratualTexto}</strong>
                </div>
              </div>
              <div className="print-hero__summary no-break-inside">
                <p>{buyoutHeroSummary}</p>
              </div>
            </div>
          </section>

          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Identificação do Cliente</h2>
            <ClientInfoGrid
              fields={clienteCampos}
              className="print-client-grid no-break-inside"
              fieldClassName="print-client-field"
              wideFieldClassName="print-client-field--wide"
            />
          </section>

          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Resumo da transferência</h2>
            <p className="section-subtitle keep-with-next">Indicadores utilizados para estimar a compra antecipada</p>
            <div className="print-key-values no-break-inside">
              {buyoutResumoIndicadores.map((item) => (
                <p key={item.label}>
                  <strong>{item.label}</strong>
                  {item.value}
                </p>
              ))}
            </div>
          </section>

          <section className="print-section keep-together avoid-break page-break-before break-after">
            <h2 className="section-title keep-with-next">Tabela de Valor de Transferencia Antecipada</h2>
            <p className="section-subtitle keep-with-next">
              Valores estimados entre o mês 7 e o mês {duracaoMesesExibicao}, considerando prestações pagas acumuladas
            </p>
            {buyoutTabelaDisponivel ? (
              <>
                <table className="no-break-inside buyout-table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Tarifa projetada (R$/kWh)</th>
                      <th>Prestação do mês (R$)</th>
                      <th>Valor de compra estimado (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyoutRowsElegiveis.map((row) => (
                      <tr key={`buyout-${row.mes}`}>
                        <td>{`${row.mes}º mês`}</td>
                        <td className="leasing-table-value">{tarifaCurrency(row.tarifa)}</td>
                        <td className="leasing-table-value">{currency(row.prestacaoEfetiva)}</td>
                        <td className="leasing-table-value">{currency(row.valorResidual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="buyout-footnote no-break-inside">
                  Os valores consideram as prestações pagas deduzidas do preço de compra. Quando o valor indicado for R$ 0,00,
                  a transferência é concluída automaticamente no término do contrato.
                </p>
              </>
            ) : (
              <p className="muted no-break-inside">
                Não há valores calculados para a compra antecipada desta proposta no momento.
              </p>
            )}
          </section>

          {buyoutAnalise && buyoutAnalise.roiPorMes.length > 0 && (
            <section className="print-section keep-together avoid-break">
              <h2 className="section-title keep-with-next">Análise de ROI do Buyout</h2>
              <p className="section-subtitle keep-with-next">
                ROI projetado em intervalos de 6 meses considerando inflação energética de{' '}
                {formatPercentBRWithDigits(buyoutResumo?.infEnergia ?? 0, 1)} a.a. e vida útil de{' '}
                {VIDA_UTIL_PADRAO_MESES / 12} anos.
                Investimento total = prestações pagas acumuladas + valor de compra no mês.
              </p>
              <table className="no-break-inside buyout-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Prestações acumuladas (R$)</th>
                    <th>Valor de compra (R$)</th>
                    <th>Investimento total (R$)</th>
                    <th>ROI projetado</th>
                  </tr>
                </thead>
                <tbody>
                  {buyoutAnalise.roiPorMes.map((ponto) => (
                    <tr
                      key={`roi-${ponto.mes}`}
                      className={ponto.mes === buyoutAnalise.melhorMes ? 'buyout-best-month' : undefined}
                    >
                      <td>
                        {`${ponto.mes}º mês`}
                        {ponto.mes === buyoutAnalise.melhorMes ? ' ★' : ''}
                      </td>
                      <td className="leasing-table-value">{currency(ponto.prestacaoAcum)}</td>
                      <td className="leasing-table-value">{currency(ponto.valorResidual)}</td>
                      <td className="leasing-table-value">{currency(ponto.totalInvestido)}</td>
                      <td className="leasing-table-value">
                        {formatPercentBRWithDigits(ponto.roi, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {buyoutAnalise.melhorMes != null && (
                <p className="buyout-footnote no-break-inside">
                  ★ Melhor mês para buyout até o {LIMITE_MELHOR_MES_PADRAO}º mês:{' '}
                  <strong>{buyoutAnalise.melhorMes}º mês</strong> — valor de compra{' '}
                  {formatCurrencyOrDash(buyoutAnalise.melhorMesValorResidual)}, ROI projetado{' '}
                  {formatPercentBRWithDigits(buyoutAnalise.melhorMesRoi, 1)}.
                </p>
              )}
            </section>
          )}

          <section className="print-section print-important keep-together page-break-before break-after">
            <h2 className="section-title keep-with-next">Informações importantes</h2>
            <p className="section-subtitle keep-with-next">
              <strong>Responsabilidades e condições da transferência antecipada</strong>
            </p>
            <ul className="no-break-inside">
              <li>
                Os valores apresentados são estimativas e poderão variar conforme reajustes tarifários, inflação e
                disponibilidade de equipamentos até a efetivação da compra.
              </li>
              <li>
                Ao exercer a transferência, o contrato de leasing é encerrado sem multas adicionais e a propriedade da usina é
                imediatamente transferida ao cliente.
              </li>
              <li>
                A partir da transferência, manutenção, limpeza, seguros e suporte passam a ser responsabilidade do cliente, que
                pode contratar a SolarInvest para continuidade dos serviços.
              </li>
              <li>
                A formalização dos valores e condições ocorrerá somente na assinatura do termo de compra antecipada.
              </li>
            </ul>
            {observacaoTexto ? (
              <p className="print-important__observation no-break-inside">{observacaoTexto}</p>
            ) : null}
          </section>

          <section className="print-section print-section--footer no-break-inside avoid-break">
            <footer className="print-final-footer no-break-inside buyout-footer">
              <div className="buyout-footer__text no-break-inside">
                <p className="buyout-disclaimer">
                  <strong>Importante:</strong> Os valores podem variar conforme condições de mercado (tarifas de energia,
                  índices de inflação e disponibilidade de equipamentos), mas refletem a melhor estimativa vigente para a
                  compra antecipada.
                </p>
                <ul className="buyout-footer__list">
                  <li>
                    Ao exercer a antecipação de posse, o contrato de leasing é encerrado imediatamente, sem multas ou juros
                    adicionais.
                  </li>
                  <li>
                    Após a compra, todas as rotinas de limpeza, manutenção, suporte, monitoramento e seguros tornam-se
                    responsabilidade do proprietário, que pode contratar a SolarInvest para continuar prestando esses serviços.
                  </li>
                </ul>
              </div>
              <div className="buyout-footer__meta">
                <div className="print-final-footer__dates">
                  <p>
                    <strong>Data de emissão:</strong> {emissaoTexto}
                  </p>
                </div>
                <div className="print-final-footer__signature">
                  <div className="signature-line" />
                  <span>Assinatura do cliente</span>
                  <p className="print-final-footer__signature-note">
                    Ao assinar esta proposta, o cliente apenas manifesta sua intenção de contratar com a SolarInvest. Este
                    documento não constitui contrato nem gera obrigações firmes para nenhuma das partes.
                  </p>
                </div>
              </div>
            </footer>

            <div className="print-brand-footer no-break-inside">
              <strong>SOLARINVEST</strong>
              <span>CNPJ: 60.434.015/0001-90</span>
              <span>Anápolis-GO</span>
              <span>Solarinvest.info</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export const PrintableBuyoutTable = React.forwardRef<HTMLDivElement, PrintableBuyoutTableProps>(
  PrintableBuyoutTableInner,
)

export default PrintableBuyoutTable
