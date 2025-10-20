import React, { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import './styles/proposal-venda.css'
import './styles/proposal-leasing.css'
import { currency, formatAxis, formatCpfCnpj, tarifaCurrency } from '../../utils/formatters'
import {
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
} from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'

const ECONOMIA_MARCOS = [5, 6, 10, 15, 20, 30]
const LEASING_CHART_COLOR = '#2563EB'

const toDisplayPercent = (value?: number, fractionDigits = 1) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatPercentBRWithDigits((value ?? 0) / 100, fractionDigits)
}

const formatKwhMes = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kWh/mês`
}

const formatKwp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kWp`
}

const formatWp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} Wp`
}

function PrintableProposalLeasingInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    cliente,
    budgetId,
    descontoContratualPct,
    tarifaCheia,
    energiaContratadaKwh,
    geracaoMensalKwh,
    numeroModulos,
    potenciaModulo,
    potenciaInstaladaKwp,
    tipoInstalacao,
    areaInstalacao,
    capex,
    buyoutResumo,
    anos,
    leasingROI,
    parcelasLeasing,
    distribuidoraTarifa,
    leasingDataInicioOperacao,
    leasingValorInstalacaoCliente,
    leasingPrazoContratualMeses,
    leasingValorMercadoProjetado,
    leasingInflacaoEnergiaAa,
  } = props

  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : null
  const telefoneCliente = cliente.telefone?.trim() || null
  const emailCliente = cliente.email?.trim() || null
  const enderecoCliente = cliente.endereco?.trim() || null
  const cidadeCliente = cliente.cidade?.trim() || null
  const ufCliente = cliente.uf?.trim() || null
  const codigoOrcamento = budgetId?.trim() || null
  const ucCliente = cliente.uc?.trim() || null
  const distribuidoraLabel = distribuidoraTarifa?.trim() || cliente.distribuidora?.trim() || null

  const prazoContratual = useMemo(() => {
    if (Number.isFinite(leasingPrazoContratualMeses) && (leasingPrazoContratualMeses ?? 0) > 0) {
      return Math.max(0, Math.floor(leasingPrazoContratualMeses ?? 0))
    }
    if (parcelasLeasing.length > 0) {
      const ultimo = parcelasLeasing[parcelasLeasing.length - 1]
      if (Number.isFinite(ultimo?.mes)) {
        return Math.max(0, Math.floor(ultimo.mes))
      }
    }
    return 0
  }, [leasingPrazoContratualMeses, parcelasLeasing])

  const inflacaoEnergiaFracao = useMemo(() => {
    const base = Number.isFinite(leasingInflacaoEnergiaAa)
      ? leasingInflacaoEnergiaAa ?? 0
      : buyoutResumo?.infEnergia ?? 0
    return (base ?? 0) / 100
  }, [buyoutResumo?.infEnergia, leasingInflacaoEnergiaAa])

  const descontoFracao = Number.isFinite(descontoContratualPct) ? (descontoContratualPct ?? 0) / 100 : 0
  const tarifaCheiaBase = Number.isFinite(tarifaCheia) ? Math.max(0, tarifaCheia ?? 0) : 0
  const energiaContratadaBase = Number.isFinite(energiaContratadaKwh) ? Math.max(0, energiaContratadaKwh ?? 0) : 0
  const valorInstalacaoCliente = Number.isFinite(leasingValorInstalacaoCliente)
    ? Math.max(0, leasingValorInstalacaoCliente ?? 0)
    : 0
  const valorMercadoProjetado = Number.isFinite(leasingValorMercadoProjetado)
    ? Math.max(0, leasingValorMercadoProjetado ?? 0)
    : Math.max(0, buyoutResumo?.vm0 ?? 0)
  const inicioOperacaoTexto = leasingDataInicioOperacao?.trim() || null

  const resumoCampos: ClientInfoField[] = [
    { label: 'Código do orçamento', value: codigoOrcamento || '—' },
    { label: 'Cliente', value: cliente.nome || '—' },
    { label: 'Documento', value: documentoCliente || '—' },
    { label: 'UC', value: ucCliente || '—' },
    { label: 'Distribuidora', value: distribuidoraLabel || '—' },
    { label: 'E-mail', value: emailCliente || '—' },
    { label: 'Telefone', value: telefoneCliente || '—' },
    {
      label: 'Cidade / UF',
      value:
        cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—',
    },
    {
      label: 'Endereço',
      value:
        enderecoCliente
          ? enderecoCliente
          : cidadeCliente || ufCliente
          ? `${cidadeCliente || '—'} / ${ufCliente || '—'}`
          : '—',
      wide: true,
    },
  ]

  const quadroComercial = [
    {
      label: 'Prazo contratual (meses)',
      value: prazoContratual > 0 ? `${prazoContratual} meses` : '—',
    },
    {
      label: 'Energia contratada (kWh/mês)',
      value: formatKwhMes(energiaContratadaKwh),
    },
    {
      label: 'Tarifa cheia da distribuidora (R$/kWh)',
      value: tarifaCheiaBase > 0 ? tarifaCurrency(tarifaCheiaBase) : '—',
    },
    {
      label: 'Desconto aplicado (%)',
      value: toDisplayPercent(descontoContratualPct),
    },
    {
      label: 'Valor da instalação para o cliente (R$)',
      value: currency(valorInstalacaoCliente),
    },
    {
      label: 'Início estimado da operação',
      value: inicioOperacaoTexto || '—',
    },
    {
      label: 'Responsabilidades da SolarInvest',
      value:
        'Operação, manutenção, suporte técnico, limpeza e seguro integral da usina durante o contrato.',
    },
    {
      label: 'Investimento da SolarInvest (R$)',
      value: capex > 0 ? currency(capex) : '—',
    },
    {
      label: 'Geração estimada (kWh/mês)',
      value: formatKwhMes(geracaoMensalKwh),
    },
    {
      label: 'Potência da placa (Wp)',
      value: formatWp(potenciaModulo),
    },
    {
      label: 'Nº de placas',
      value:
        Number.isFinite(numeroModulos) && (numeroModulos ?? 0) > 0
          ? formatNumberBRWithOptions(numeroModulos ?? 0, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })
          : '—',
    },
    {
      label: 'Potência instalada (kWp)',
      value: formatKwp(potenciaInstaladaKwp),
    },
    {
      label: 'Área útil (m²)',
      value:
        Number.isFinite(areaInstalacao) && (areaInstalacao ?? 0) > 0
          ? `${formatNumberBRWithOptions(areaInstalacao ?? 0, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })} m²`
          : '—',
    },
    {
      label: 'Tipo de instalação',
      value: tipoInstalacao === 'SOLO' ? 'Solo' : 'Telhado',
    },
    {
      label: 'Valor de mercado projetado (R$)',
      value: valorMercadoProjetado > 0 ? currency(valorMercadoProjetado) : '—',
    },
  ]

  const resumoTecnico = [
    {
      label: 'Potência instalada',
      value: formatKwp(potenciaInstaladaKwp),
    },
    {
      label: 'Geração estimada',
      value: formatKwhMes(geracaoMensalKwh),
    },
    {
      label: 'Energia contratada',
      value: formatKwhMes(energiaContratadaKwh),
    },
    {
      label: 'Potência da placa',
      value: formatWp(potenciaModulo),
    },
  ]

  const resumoFinanceiro = [
    {
      label: 'Investimento SolarInvest',
      value: capex > 0 ? currency(capex) : '—',
    },
    {
      label: 'Valor de mercado projetado',
      value: valorMercadoProjetado > 0 ? currency(valorMercadoProjetado) : '—',
    },
    {
      label: 'Desconto contratual',
      value: toDisplayPercent(descontoContratualPct),
    },
    {
      label: 'Tarifa inicial projetada',
      value: tarifaCheiaBase > 0 ? tarifaCurrency(tarifaCheiaBase) : '—',
    },
  ]

  const mensalidadesPorAno = useMemo(() => {
    const anosConsiderados = [1, 2, 3, 4, 5]
    return anosConsiderados.map((ano) => {
      const fator = Math.pow(1 + Math.max(-0.99, inflacaoEnergiaFracao), Math.max(0, ano - 1))
      const tarifaAno = tarifaCheiaBase * fator
      const tarifaComDesconto = tarifaAno * (1 - descontoFracao)
      const mensalidade = energiaContratadaBase * tarifaComDesconto
      const contaDistribuidora = energiaContratadaBase * tarifaAno
      return {
        ano,
        tarifaCheiaAno: tarifaAno,
        tarifaComDesconto,
        contaDistribuidora,
        mensalidade,
      }
    })
  }, [descontoFracao, energiaContratadaBase, inflacaoEnergiaFracao, tarifaCheiaBase])

  const economiaProjetada = useMemo(() => {
    return ECONOMIA_MARCOS.map((ano) => {
      if (!anos.includes(ano)) {
        return null
      }
      const acumulado = leasingROI[ano - 1] ?? 0
      const anterior = ano > 1 ? leasingROI[ano - 2] ?? 0 : 0
      return {
        ano,
        acumulado,
        economiaAnual: acumulado - anterior,
      }
    }).filter((row): row is { ano: number; acumulado: number; economiaAnual: number } => row !== null)
  }, [anos, leasingROI])

  const economiaChartData = useMemo(
    () =>
      economiaProjetada.map((item) => ({
        ano: item.ano,
        beneficio: item.acumulado,
      })),
    [economiaProjetada],
  )

  const economiaChartDomain = useMemo(() => {
    if (economiaChartData.length === 0) {
      return { min: -1, max: 1 }
    }

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    economiaChartData.forEach((row) => {
      const valor = row.beneficio
      if (Number.isFinite(valor)) {
        min = Math.min(min, valor)
        max = Math.max(max, valor)
      }
    })

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: -1, max: 1 }
    }

    min = Math.min(min, 0)
    max = Math.max(max, 0)

    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.25, 1)
      return { min: min - padding, max: max + padding }
    }

    const range = max - min
    const padding = range * 0.12

    return {
      min: min - padding,
      max: max + padding,
    }
  }, [economiaChartData])

  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 15)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const descontoInformativo = toDisplayPercent(descontoContratualPct)
  const prazoInformativo = prazoContratual > 0 ? `${prazoContratual} meses` : 'conforme proposta'
  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const heroSummary =
    'Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest. Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para você, tornando-se um patrimônio durável, valorizando seu imóvel.'
  const beneficioAno30 = economiaProjetada.find((item) => item.ano === 30) ?? null
  const economiaExplainer: React.ReactNode = beneficioAno30 ? (
    <>
      <strong>Economia acumulada em 30 anos:</strong> Em {beneficioAno30.ano} anos, a SolarInvest projeta um
      benefício total de <strong>{currency(beneficioAno30.acumulado)}</strong>. Essa trajetória considera os reajustes
      anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.
    </>
  ) : (
    <>Economia que cresce ano após ano. Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.</>
  )
  const informacoesImportantes = [
    `Desconto contratual aplicado: ${descontoInformativo} sobre a tarifa da distribuidora.`,
    `Prazo de vigência: conforme especificado na proposta (ex.: ${prazoInformativo}).`,
    'Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.',
    'Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e seguro.',
    'Transferência da usina ao cliente ao final do contrato sem custo adicional.',
    'Tabela de compra antecipada disponível mediante solicitação.',
    'Equipamentos utilizados possuem certificação INMETRO.',
    'Os valores apresentados são estimativas preliminares e poderão sofrer ajustes no contrato definitivo.',
    'Agende uma visita técnica gratuita para confirmar a viabilidade e formalizar a proposta definitiva.',
  ]

  return (
    <div ref={ref} className="print-layout leasing-print-layout">
      <header className="print-hero">
        <div className="print-hero__header">
          <div className="print-hero__identity">
            <div className="print-logo">
              <img src="/logo.svg" alt="SolarInvest" />
            </div>
            <div className="print-hero__title">
              <span className="print-hero__eyebrow">SolarInvest</span>
              <h1>Proposta de Leasing Solar</h1>
              <p className="print-hero__tagline">Energia inteligente, sem desembolso</p>
            </div>
          </div>
        </div>
        <div className="print-hero__summary">
          <h2>Sumário executivo</h2>
          <p>{heroSummary}</p>
        </div>
      </header>

      <section className="print-section">
        <h2>Identificação do cliente</h2>
        <ClientInfoGrid
          fields={resumoCampos}
          className="print-client-grid"
          fieldClassName="print-client-field"
          wideFieldClassName="print-client-field--wide"
        />
      </section>

      <section className="print-section">
        <h2>Quadro comercial resumido</h2>
        <table>
          <thead>
            <tr>
              <th>Parâmetro</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {quadroComercial.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td className="leasing-table-value">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section">
        <h2>Resumo técnico e financeiro</h2>
        <div className="leasing-summary-grid">
          <div className="leasing-summary-card">
            <h3>Dados técnicos</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {resumoTecnico.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td className="leasing-table-value">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="leasing-summary-card">
            <h3>Dados financeiros</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {resumoFinanceiro.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td className="leasing-table-value">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="print-section">
        <h2>Mensalidades por ano</h2>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Tarifa cheia média</th>
              <th>Tarifa com desconto média</th>
              <th>Conta distribuidora (R$)</th>
              <th>Mensalidade SolarInvest (R$)</th>
            </tr>
          </thead>
          <tbody>
            {mensalidadesPorAno.map((linha) => (
              <tr key={`mensalidade-${linha.ano}`}>
                <td>{`${linha.ano}º ano`}</td>
                <td className="leasing-table-value">{tarifaCurrency(linha.tarifaCheiaAno)}</td>
                <td className="leasing-table-value">{tarifaCurrency(linha.tarifaComDesconto)}</td>
                <td className="leasing-table-value">{currency(linha.contaDistribuidora)}</td>
                <td className="leasing-table-value">{currency(linha.mensalidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section print-chart-section">
        <h2>Economia projetada (30 anos)</h2>
        <div className="print-chart leasing-chart">
          <ResponsiveContainer width="50%" height={240}>
            <BarChart
              layout="vertical"
              data={economiaChartData}
              margin={{ top: 5, right: 6, bottom: 7, left: 6 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke="#0f172a"
                tickFormatter={formatAxis}
                tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: '#0f172a', strokeWidth: 1 }}
                tickLine={false}
                domain={[economiaChartDomain.min, economiaChartDomain.max]}
              >
                <Label
                  value="Benefício acumulado (R$)"
                  position="insideBottom"
                  offset={-32}
                  style={{ fill: '#0f172a', fontSize: 13, fontWeight: 700 }}
                />
              </XAxis>
              <YAxis
                type="category"
                dataKey="ano"
                stroke="#0f172a"
                tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: '#0f172a', strokeWidth: 1 }}
                tickLine={false}
                width={120}
                tickFormatter={(valor) => `${valor}º ano`}
              />
              <Tooltip
                formatter={(value: number) => currency(Number(value))}
                labelFormatter={(value) => `${value}º ano`}
                contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', padding: 12 }}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" strokeWidth={1} />
              <Bar
                dataKey="beneficio"
                fill={LEASING_CHART_COLOR}
                barSize={14}
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
                name="Economia acumulada"
              >
                <LabelList
                  dataKey="beneficio"
                  position="right"
                  formatter={(value: number) => currency(Number(value))}
                  fill={LEASING_CHART_COLOR}
                  style={{ fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="print-chart-highlights">
          {ECONOMIA_MARCOS.map((ano) => {
            const row = economiaProjetada.find((item) => item.ano === ano)
            return (
              <li key={`economia-${ano}`}>
                <span className="print-chart-highlights__year">{`${ano}º ano`}</span>
                <div className="print-chart-highlights__values">
                  <span className="print-chart-highlights__value" style={{ color: LEASING_CHART_COLOR }}>
                    Economia acumulada: {row ? currency(row.acumulado) : '—'}
                  </span>
                  <span className="print-chart-highlights__value" style={{ color: '#0f172a' }}>
                    Economia no ano: {row ? currency(row.economiaAnual) : '—'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="leasing-chart-note">{economiaExplainer}</p>
      </section>

      <section className="print-section print-important">
        <h2>Informações importantes</h2>
        <ul>
          {informacoesImportantes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="print-section print-cta">
        <div className="print-cta__box">
          <h2>Vamos avançar?</h2>
          <p>Agende uma visita técnica gratuita e finalize a contratação da sua usina SolarInvest.</p>
        </div>
      </section>

      <footer className="print-final-footer">
        <div className="print-final-footer__dates">
          <p>
            <strong>Data de emissão da proposta:</strong> {emissaoTexto}
          </p>
          <p>
            <strong>Validade da proposta:</strong> {validadeTexto} (15 dias corridos)
          </p>
        </div>
        <div className="print-final-footer__signature">
          <div className="signature-line" />
          <span>Assinatura do cliente</span>
        </div>
      </footer>

      <div className="print-brand-footer">
        <strong>SolarInvest</strong>
        <span>CNPJ: 60.434.015/0001-90</span>
        <span>Energia inteligente, sem desembolso</span>
      </div>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
