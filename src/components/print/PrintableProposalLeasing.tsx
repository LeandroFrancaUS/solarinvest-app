import React, { useMemo } from 'react'
import {
  CartesianGrid,
  Defs,
  Line,
  LineChart,
  LinearGradient,
  ResponsiveContainer,
  Stop,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import './styles/proposal-leasing.css'
import { currency, formatAxis, formatCpfCnpj, tarifaCurrency } from '../../utils/formatters'
import {
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
} from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'

const ECONOMIA_MARCOS = [5, 6, 10, 15, 20, 30]

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
        ano: `${item.ano}º`,
        beneficio: item.acumulado,
      })),
    [economiaProjetada],
  )

  const economiaLongoPrazo = useMemo(() => {
    if (economiaProjetada.length === 0) {
      return null
    }
    const economia30Anos = economiaProjetada.find((item) => item.ano === 30)
    if (economia30Anos) {
      return economia30Anos
    }
    return economiaProjetada[economiaProjetada.length - 1]
  }, [economiaProjetada])

  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 15)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const descontoInformativo = toDisplayPercent(descontoContratualPct)
  const prazoInformativo = prazoContratual > 0 ? `${prazoContratual} meses` : 'conforme proposta'

  return (
    <div ref={ref} className="leasing-print-layout">
      <header className="leasing-header">
        <div className="leasing-header__branding">
          <img src="/logo.svg" alt="SolarInvest" className="leasing-header__logo" />
          <div>
            <p className="leasing-header__eyebrow">SOLARINVEST</p>
            <h1>SOLARINVEST — Proposta de Leasing Solar</h1>
            <p className="leasing-header__subtitle">Energia inteligente, sem desembolso</p>
          </div>
        </div>
        <div className="leasing-summary">
          <h2>SUMÁRIO EXECUTIVO</h2>
          <p>
            Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest.
            Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem
            precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para
            você, tornando-se um patrimônio durável, valorizando seu imóvel.
          </p>
        </div>
      </header>

      <section className="leasing-section">
        <h2>IDENTIFICAÇÃO DO CLIENTE</h2>
        <ClientInfoGrid fields={resumoCampos} />
      </section>

      <section className="leasing-section">
        <h2>QUADRO COMERCIAL RESUMIDO</h2>
        <table className="leasing-commercial-table">
          <tbody>
            {quadroComercial.map((item) => (
              <tr key={item.label}>
                <th scope="row">{item.label}</th>
                <td>{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="leasing-section">
        <h2>RESUMO TÉCNICO E FINANCEIRO</h2>
        <div className="leasing-dual-cards">
          <div className="leasing-dual-card">
            <h3>DADOS TÉCNICOS</h3>
            <dl>
              {resumoTecnico.map((item) => (
                <React.Fragment key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
          <div className="leasing-dual-card">
            <h3>DADOS FINANCEIROS</h3>
            <dl>
              {resumoFinanceiro.map((item) => (
                <React.Fragment key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="leasing-section">
        <h2>MENSALIDADES POR ANO</h2>
        <table className="leasing-table">
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
                <td>{tarifaCurrency(linha.tarifaCheiaAno)}</td>
                <td>{tarifaCurrency(linha.tarifaComDesconto)}</td>
                <td>{currency(linha.contaDistribuidora)}</td>
                <td>{currency(linha.mensalidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="leasing-section">
        <h2>ECONOMIA PROJETADA (30 ANOS)</h2>
        <div className="leasing-economia">
          <ResponsiveContainer height={260}>
            <LineChart data={economiaChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <Defs>
                <LinearGradient id="leasing-economia-gradient" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#004F9E" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#33BFFF" stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <CartesianGrid stroke="rgba(0, 79, 158, 0.12)" strokeDasharray="4 4" />
              <XAxis dataKey="ano" stroke="#004F9E" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={formatAxis}
                stroke="#004F9E"
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(label) => `Ano ${label}`} />
              <Line
                type="monotone"
                dataKey="beneficio"
                stroke="url(#leasing-economia-gradient)"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, stroke: '#004F9E', fill: '#ffffff' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#004F9E', fill: '#E0F2FE' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="leasing-economia-table">
            {ECONOMIA_MARCOS.map((ano) => {
              const row = economiaProjetada.find((item) => item.ano === ano)
              return (
                <div key={`economia-${ano}`}>
                  <span>{`${ano}º ano`}</span>
                  <strong>{row ? currency(row.acumulado) : '—'}</strong>
                  {row ? <small>{`Economia no ano: ${currency(row.economiaAnual)}`}</small> : <small>—</small>}
                </div>
              )
            })}
          </div>
          <p className="leasing-economia__note">
            Economia que cresce ano após ano.
            {economiaLongoPrazo ? (
              <>
                {` Em ${economiaLongoPrazo.ano} anos, a SolarInvest projeta um benefício acumulado de ${currency(
                  economiaLongoPrazo.acumulado,
                )} comparado à concessionária.`}
              </>
            ) : (
              ' A SolarInvest projeta benefícios acumulados conforme as simulações financeiras disponíveis.'
            )}
            {' Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.'}
          </p>
        </div>
      </section>

      <section className="leasing-section">
        <h2>INFORMAÇÕES IMPORTANTES</h2>
        <div className="leasing-info-list">
          <p>Desconto contratual aplicado: {descontoInformativo} sobre a tarifa da distribuidora.</p>
          <p>Prazo de vigência: conforme especificado na proposta (ex.: {prazoInformativo}).</p>
          <p>Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.</p>
          <p>
            Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e
            seguro.
          </p>
          <p>Transferência da usina ao cliente ao final do contrato sem custo adicional.</p>
          <p>Tabela de compra antecipada disponível mediante solicitação.</p>
          <p>Equipamentos utilizados possuem certificação INMETRO.</p>
          <p>
            Os valores apresentados são estimativas preliminares e poderão sofrer ajustes no contrato
            definitivo.
          </p>
          <p>
            Agende uma visita técnica gratuita para confirmar a viabilidade e formalizar a proposta
            definitiva.
          </p>
        </div>
      </section>

      <section className="leasing-section leasing-signature">
        <div className="leasing-signature__dates">
          <span>Data de emissão: {formatDate(emissaoData)}</span>
          <span>Validade da proposta: 15 dias corridos</span>
        </div>
        <div className="leasing-signature__line">
          <span>Vamos avançar?</span>
          <div className="leasing-signature__stroke" />
          <small>Assinatura do cliente</small>
        </div>
      </section>

      <footer className="leasing-footer">
        <p>SolarInvest</p>
        <p>CNPJ: 60.434.015/0001-90</p>
        <p>Energia inteligente, sem desembolso</p>
        <p>Vamos avançar?</p>
      </footer>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
