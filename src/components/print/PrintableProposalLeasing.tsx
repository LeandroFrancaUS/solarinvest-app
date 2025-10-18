import React, { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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
      label: 'Desconto aplicado',
      value: toDisplayPercent(descontoContratualPct),
    },
    {
      label: 'Valor da instalação para o cliente',
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
      label: 'Investimento da SolarInvest',
      value: capex > 0 ? currency(capex) : '—',
    },
    {
      label: 'Geração estimada (kWh/mês)',
      value: formatKwhMes(geracaoMensalKwh),
    },
    {
      label: 'Energia contratada (kWh/mês)',
      value: formatKwhMes(energiaContratadaKwh),
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
      label: 'Valor de mercado projetado',
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

  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 15)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const descontoInformativo = toDisplayPercent(descontoContratualPct)
  const prazoInformativo = prazoContratual > 0 ? `${prazoContratual} meses` : 'conforme proposta'

  return (
    <div ref={ref} className="leasing-print-layout">
      <header className="leasing-hero">
        <div className="leasing-hero__head">
          <div className="leasing-hero__brand">
            <div className="leasing-hero__logo">
              <img src="/logo.svg" alt="SolarInvest" />
            </div>
            <div className="leasing-hero__title">
              <span className="leasing-hero__eyebrow">SolarInvest</span>
              <h1>Proposta de Leasing Solar</h1>
              <p>Energia inteligente, sem desembolso</p>
            </div>
          </div>
        </div>
        <div className="leasing-hero__summary">
          <h2>Sumário Executivo</h2>
          <p>
            Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest.
            Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem
            precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para
            você, tornando-se um patrimônio durável, valorizando seu imóvel.
          </p>
        </div>
      </header>

      <section className="leasing-section">
        <h2>Identificação do Cliente</h2>
        <ClientInfoGrid fields={resumoCampos} />
      </section>

      <section className="leasing-section">
        <h2>Quadro Comercial Resumido</h2>
        <div className="leasing-summary-grid">
          {quadroComercial.map((item) => (
            <div key={item.label} className="leasing-summary-item">
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="leasing-section">
        <h2>Resumo Técnico e Financeiro</h2>
        <div className="leasing-grid-two">
          <div className="leasing-card">
            <h3>Dados técnicos</h3>
            <dl>
              {resumoTecnico.map((item) => (
                <React.Fragment key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
          <div className="leasing-card">
            <h3>Dados financeiros</h3>
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
        <h2>Mensalidades por Ano</h2>
        <table className="leasing-table">
          <thead>
            <tr>
              <th>Ano</th>
              <th>Tarifa cheia média</th>
              <th>Tarifa com desconto média</th>
              <th>Conta distribuidora</th>
              <th>Mensalidade SolarInvest</th>
            </tr>
          </thead>
          <tbody>
            {mensalidadesPorAno.map((linha) => (
              <tr key={`mensalidade-${linha.ano}`}>
                <td>{linha.ano}º</td>
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
        <h2>Economia Projetada (30 anos)</h2>
        <div className="leasing-economia-chart">
          <ResponsiveContainer height={240}>
            <LineChart data={economiaChartData} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 64, 175, 0.25)" />
              <XAxis dataKey="ano" stroke="#1e40af" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatAxis} stroke="#1e40af" axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(label) => `Ano ${label}`} />
              <Line
                type="monotone"
                dataKey="beneficio"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, stroke: '#1e3a8a', fill: '#bfdbfe' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#1d4ed8', fill: '#eff6ff' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="leasing-economia-table">
            {economiaProjetada.map((item) => (
              <div key={`economia-${item.ano}`}>
                <span>{item.ano}º ano</span>
                <strong>{currency(item.acumulado)}</strong>
                <small>{`Economia no ano: ${currency(item.economiaAnual)}`}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="leasing-section">
        <h2>Informações Importantes</h2>
        <div className="leasing-info-list">
          <p>Desconto contratual aplicado: {descontoInformativo} sobre a tarifa da distribuidora.</p>
          <p>Prazo de vigência: conforme especificado na proposta ({prazoInformativo}).</p>
          <p>Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.</p>
          <p>
            Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e
            seguro sinistro da usina.
          </p>
          <p>
            Transferência da usina ao cliente ao final do contrato sem custo adicional, desde que
            obrigações contratuais estejam cumpridas.
          </p>
          <p>Tabela de compra antecipada disponível mediante solicitação.</p>
          <p>Equipamentos utilizados possuem certificação INMETRO.</p>
          <p>
            Os valores apresentados nesta proposta são estimativas preliminares e poderão sofrer ajustes
            no contrato definitivo.
          </p>
          <p>
            Agende uma visita técnica gratuita com nossa equipe para confirmar a viabilidade e
            formalizar a proposta definitiva.
          </p>
        </div>
      </section>

      <section className="leasing-section">
        <div className="leasing-footer">
          <div className="leasing-footer__info">
            <span>Data de emissão: {formatDate(emissaoData)}</span>
            <span>Validade da proposta: {formatDate(validadeData)}</span>
          </div>
          <div className="leasing-footer__signature">
            <strong>Vamos avançar?</strong>
            <div className="leasing-signature-line" />
            <span>Assinatura do cliente</span>
          </div>
        </div>
      </section>

      <footer className="leasing-brand-footer">
        <strong>Energia inteligente, sem desembolso</strong>
        <span>CNPJ: 60.434.015/0001-90</span>
      </footer>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
