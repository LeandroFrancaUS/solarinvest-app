import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Label, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { currency, formatCpfCnpj, formatAxis, tarifaCurrency } from '../../utils/formatters'
import { formatMoneyBRWithDigits, formatNumberBRWithOptions, formatPercentBR, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'

const DEFAULT_CHART_COLORS: Record<'Leasing' | 'Financiamento', string> = {
  Leasing: '#2563EB',
  Financiamento: '#10B981',
}

const BENEFICIO_CHART_ANOS = [5, 6, 10, 15, 20, 30]

function PrintableProposalInner(
  {
    cliente,
    budgetId,
    anos,
    leasingROI,
    financiamentoFluxo,
    financiamentoROI,
    mostrarFinanciamento,
  buyoutResumo,
  capex,
  tipoProposta,
  geracaoMensalKwh,
  numeroModulos,
  potenciaInstaladaKwp,
    descontoContratualPct,
    distribuidoraTarifa,
    energiaContratadaKwh,
    tarifaCheia,
    vendaResumo: vendaResumoProp,
    parsedPdfVenda,
  }: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const isVendaDireta = tipoProposta === 'VENDA_DIRETA'
  const vendaResumo = isVendaDireta && vendaResumoProp ? vendaResumoProp : null
  const vendaFormResumo = vendaResumo?.form
  const retornoVenda = vendaResumo?.retorno ?? null
  const formatPercentFromPct = (value?: number, fractionDigits = 2) => {
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
  const formatMeses = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} meses`
  }
  const formatParcelas = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} parcelas`
  }
  const pickPositive = (...values: (number | null | undefined)[]): number | null => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value
      }
    }
    return null
  }
  const parsedPdfResumo = parsedPdfVenda ?? null
  const kitPotenciaInstalada = pickPositive(
    vendaFormResumo?.potencia_instalada_kwp,
    parsedPdfResumo?.potencia_instalada_kwp,
    potenciaInstaladaKwp,
  )
  const kitGeracao = pickPositive(
    vendaFormResumo?.geracao_estimada_kwh_mes,
    parsedPdfResumo?.geracao_estimada_kwh_mes,
    geracaoMensalKwh,
  )
  const kitConsumo = pickPositive(
    vendaFormResumo?.consumo_kwh_mes,
    parsedPdfResumo?.consumo_kwh_mes,
    energiaContratadaKwh,
  )
  const kitQuantidadeModulos = pickPositive(
    vendaFormResumo?.quantidade_modulos,
    parsedPdfResumo?.quantidade_modulos,
    numeroModulos,
  )

  const formatKwpDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(valor ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`
  }

  const formatQuantidadeDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(Math.round(valor ?? 0), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} módulos`
  }

  const potenciaModuloDetalhe = pickPositive(parsedPdfResumo?.potencia_da_placa_wp, potenciaModulo)
  const formatModuloDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(valor ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} Wp`
  }

  const formatTarifaDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return formatMoneyBRWithDigits(valor ?? 0, 3)
  }

  const tarifaProjeto = pickPositive(
    vendaFormResumo?.tarifa_cheia_r_kwh,
    parsedPdfResumo?.tarifa_cheia_r_kwh,
    tarifaCheia,
  )

  const autonomiaPct =
    kitGeracao && kitConsumo && kitGeracao > 0 && kitConsumo > 0 ? (kitGeracao / kitConsumo) * 100 : null
  const autonomiaLabel =
    Number.isFinite(autonomiaPct) && (autonomiaPct ?? 0) > 0
      ? formatPercentBRWithDigits((autonomiaPct ?? 0) / 100, 1)
      : '—'

  const detalhamentoCampos = [
    { label: 'Potência do sistema', value: formatKwpDetalhe(kitPotenciaInstalada ?? null) },
    { label: 'Produção média mensal', value: formatKwhMes(kitGeracao ?? undefined) },
    { label: 'Consumo médio mensal', value: formatKwhMes(kitConsumo ?? undefined) },
    { label: 'Quantidade de módulos', value: formatQuantidadeDetalhe(kitQuantidadeModulos ?? null) },
    { label: 'Potência dos módulos', value: formatModuloDetalhe(potenciaModuloDetalhe ?? null) },
    { label: 'Tarifa', value: formatTarifaDetalhe(tarifaProjeto ?? null) },
    { label: 'Autonomia (%)', value: autonomiaLabel },
  ]
  const duracaoContratualValida =
    typeof buyoutResumo.duracao === 'number' && Number.isFinite(buyoutResumo.duracao)
  const mostrarDetalhamento = detalhamentoCampos.length > 0
  const distribuidoraTarifaLabel = distribuidoraTarifa?.trim() || ''
  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : ''
  const codigoOrcamento = budgetId?.trim() || ''
  const emailCliente = cliente.email?.trim() || ''
  const telefoneCliente = cliente.telefone?.trim() || ''
  const ucCliente = cliente.uc?.trim() || ''
  const cidadeCliente = cliente.cidade?.trim() || ''
  const ufCliente = cliente.uf?.trim() || ''
  const enderecoCliente = cliente.endereco?.trim() || ''
  const prazoContratualResumo = isVendaDireta
    ? 'Venda'
    : duracaoContratualValida
    ? `${buyoutResumo.duracao} meses`
    : '60 meses'
  const formatEnergiaContratada = (valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      return '—'
    }
    const possuiDecimais = Math.abs(valor - Math.round(valor)) > 1e-6
    return `${formatNumberBRWithOptions(valor, {
      minimumFractionDigits: possuiDecimais ? 2 : 0,
      maximumFractionDigits: possuiDecimais ? 2 : 0,
    })} kWh/mês`
  }
  const energiaContratadaResumo = formatEnergiaContratada(energiaContratadaKwh)
  const tarifaCheiaResumo = tarifaCheia > 0 ? tarifaCurrency(tarifaCheia) : '—'
  const descontoResumo =
    !isVendaDireta && Number.isFinite(descontoContratualPct)
      ? formatPercentBR((descontoContratualPct ?? 0) / 100)
      : '—'
  const valorInstalacaoTexto = isVendaDireta ? currency(capex) : currency(0)
  const condicaoLabel = (() => {
    if (!vendaFormResumo) {
      return '—'
    }
    switch (vendaFormResumo.condicao) {
      case 'AVISTA':
        return 'À vista'
      case 'PARCELADO':
        return 'Parcelado'
      case 'FINANCIAMENTO':
        return 'Financiamento'
      default:
        return '—'
    }
  })()
  const isCondicaoAvista = vendaFormResumo?.condicao === 'AVISTA'
  const isCondicaoParcelado = vendaFormResumo?.condicao === 'PARCELADO'
  const isCondicaoFinanciamento = vendaFormResumo?.condicao === 'FINANCIAMENTO'
  const modoPagamentoTipo = vendaFormResumo?.modo_pagamento ?? 'PIX'
  const modoPagamentoLabel =
    isCondicaoAvista
      ? modoPagamentoTipo === 'PIX'
        ? 'Pix'
        : modoPagamentoTipo === 'DEBITO'
        ? 'Cartão de débito'
        : 'Cartão de crédito'
      : null
  const mdrSelecionadoValor =
    isCondicaoAvista
      ? modoPagamentoTipo === 'PIX'
        ? vendaFormResumo.taxa_mdr_pix_pct
        : modoPagamentoTipo === 'DEBITO'
        ? vendaFormResumo.taxa_mdr_debito_pct
        : vendaFormResumo.taxa_mdr_credito_vista_pct
      : undefined
  const consumoResumo = formatKwhMes(vendaFormResumo?.consumo_kwh_mes)
  const tarifaInicialResumo = Number.isFinite(vendaFormResumo?.tarifa_cheia_r_kwh)
    ? tarifaCurrency(vendaFormResumo?.tarifa_cheia_r_kwh ?? 0)
    : tarifaCheiaResumo
  const inflacaoResumo = formatPercentFromPct(vendaFormResumo?.inflacao_energia_aa_pct)
  const taxaMinimaResumo = Number.isFinite(vendaFormResumo?.taxa_minima_mensal)
    ? currency(vendaFormResumo?.taxa_minima_mensal ?? 0)
    : '—'
  const iluminacaoPublicaResumo = Number.isFinite(vendaFormResumo?.taxa_minima_r_mes)
    ? currency(vendaFormResumo?.taxa_minima_r_mes ?? 0)
    : '—'
  const horizonteAnaliseResumo = formatMeses(vendaFormResumo?.horizonte_meses)
  const taxaDescontoResumo = Number.isFinite(vendaFormResumo?.taxa_desconto_aa_pct)
    ? formatPercentFromPct(vendaFormResumo?.taxa_desconto_aa_pct)
    : null
  const parcelasResumo = formatParcelas(vendaFormResumo?.n_parcelas)
  const jurosCartaoAmResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_am_pct)
  const jurosCartaoAaResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_aa_pct)
  const mdrPixResumo = formatPercentFromPct(vendaFormResumo?.taxa_mdr_pix_pct)
  const mdrDebitoResumo = formatPercentFromPct(vendaFormResumo?.taxa_mdr_debito_pct)
  const mdrCreditoVistaResumo = formatPercentFromPct(vendaFormResumo?.taxa_mdr_credito_vista_pct)
  const mdrCreditoParceladoResumo = formatPercentFromPct(
    vendaFormResumo?.taxa_mdr_credito_parcelado_pct,
  )
  const entradaResumo = Number.isFinite(vendaFormResumo?.entrada_financiamento)
    ? currency(vendaFormResumo?.entrada_financiamento ?? 0)
    : '—'
  const parcelasFinResumo = formatParcelas(vendaFormResumo?.n_parcelas_fin)
  const jurosFinAmResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_am_pct)
  const jurosFinAaResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_aa_pct)
  const paybackLabelResumo = retornoVenda?.payback
    ? `${retornoVenda.payback} meses`
    : 'Não atingido em 30 anos'
  const roiLabelResumo = retornoVenda
    ? new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(retornoVenda.roi)
    : '—'
  const vplResumo = typeof retornoVenda?.vpl === 'number' ? currency(retornoVenda.vpl) : '—'
  const roiHorizonteResumo = isVendaDireta
    ? '30 anos'
    : Number.isFinite(vendaFormResumo?.horizonte_meses) && (vendaFormResumo?.horizonte_meses ?? 0) > 0
    ? `${Math.round(vendaFormResumo?.horizonte_meses ?? 0)} meses`
    : 'horizonte analisado'
  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 15)
  const inicioOperacaoData = new Date(emissaoData.getTime())
  inicioOperacaoData.setDate(inicioOperacaoData.getDate() + 60)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const inicioOperacaoTexto = formatDate(inicioOperacaoData)
  const heroTitle = isVendaDireta ? 'Proposta de Venda Solar' : 'Proposta de Leasing Solar'
  const heroTagline = isVendaDireta
    ? 'Energia inteligente, patrimônio garantido'
    : 'Energia inteligente, sem desembolso'
  const heroSummaryDescription = isVendaDireta
    ? 'Apresentamos sua proposta personalizada de aquisição da usina fotovoltaica SolarInvest. Nesta modalidade de venda, você investe no sistema, torna-se proprietário desde o primeiro dia e captura 100% da economia gerada, aumentando a previsibilidade de custos e o valor do seu imóvel.'
    : 'Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest. Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para você, tornando-se um patrimônio durável, valorizando seu imóvel.'
  const chartEconomiaIntro = isVendaDireta
    ? 'Retorno que cresce ano após ano.'
    : 'Economia que cresce ano após ano.'
  const chartExplainerContext = isVendaDireta
    ? 'O investimento considera os reajustes anuais de energia, a vida útil projetada dos equipamentos e a propriedade integral do ativo desde o primeiro dia.'
    : 'Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.'
  const chartFootnoteText = isVendaDireta
    ? 'Como proprietário do sistema, toda a economia permanece com o cliente ao longo da vida útil do projeto.'
    : 'Após o final do contrato a usina passa a render 100% de economia frente à concessionária para o cliente.'
  const chartPrimaryLabel = isVendaDireta ? 'Venda' : 'Leasing SolarInvest'

  const chartDataPrintable = useMemo(() => {
    const anosDisponiveis = new Set(anos)

    return BENEFICIO_CHART_ANOS.filter((ano) => anosDisponiveis.has(ano)).map((ano) => ({
      ano,
      Leasing: leasingROI[ano - 1] ?? 0,
      Financiamento: financiamentoROI[ano - 1] ?? 0,
    }))
  }, [anos, financiamentoROI, leasingROI])
  const beneficioMarcos = useMemo(
    () =>
      BENEFICIO_CHART_ANOS.map((ano) => {
        const dadosAno = chartDataPrintable.find((row) => row.ano === ano)
        if (!dadosAno) {
          return null
        }
        return {
          ano,
          Leasing: dadosAno.Leasing,
          Financiamento: dadosAno.Financiamento,
        }
      }).filter((row): row is { ano: number; Leasing: number; Financiamento: number } => row !== null),
    [chartDataPrintable],
  )
  const chartPrintableDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    chartDataPrintable.forEach((row) => {
      const valores = [row.Leasing]
      if (mostrarFinanciamento) {
        valores.push(row.Financiamento)
      }

      valores.forEach((valor) => {
        if (Number.isFinite(valor)) {
          min = Math.min(min, valor)
          max = Math.max(max, valor)
        }
      })
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
  }, [chartDataPrintable, mostrarFinanciamento])

  const beneficioAno30Printable = useMemo(
    () => chartDataPrintable.find((row) => row.ano === 30) ?? null,
    [chartDataPrintable],
  )
  return (
    <div ref={ref} className="print-layout">
      <header className="print-hero">
        <div className="print-hero__header">
          <div className="print-hero__identity">
            <div className="print-logo">
              <img src="/logo.svg" alt="SolarInvest" />
            </div>
            <div className="print-hero__title">
              <span className="print-hero__eyebrow">SolarInvest</span>
              <h1>{heroTitle}</h1>
              <p className="print-hero__tagline">{heroTagline}</p>
            </div>
          </div>
        </div>
        <div className="print-hero__summary">
          <h2>Sumário executivo</h2>
          <p>{heroSummaryDescription}</p>
        </div>
      </header>

      <section className="print-section">
        <h2>Identificação do cliente</h2>
        <dl className="print-client-grid">
          <div className="print-client-field">
            <dt>Código do orçamento</dt>
            <dd>{codigoOrcamento || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Cliente</dt>
            <dd>{cliente.nome || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Documento</dt>
            <dd>{documentoCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>UC</dt>
            <dd>{ucCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Distribuidora</dt>
            <dd>{distribuidoraTarifaLabel || cliente.distribuidora || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>E-mail</dt>
            <dd>{emailCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Telefone</dt>
            <dd>{telefoneCliente || '—'}</dd>
          </div>
          <div className="print-client-field">
            <dt>Cidade / UF</dt>
            <dd>{cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—'}</dd>
          </div>
          <div className="print-client-field print-client-field--wide">
            <dt>Endereço</dt>
            <dd>
              {enderecoCliente
                ? enderecoCliente
                : cidadeCliente || ufCliente
                ? `${cidadeCliente || '—'} / ${ufCliente || '—'}`
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {mostrarDetalhamento ? (
        <section className="print-section">
          <h2>Detalhamento do Projeto</h2>
          {detalhamentoCampos.length > 0 ? (
            <dl className="print-kit-grid">
              {detalhamentoCampos.map((campo) => (
                <div key={campo.label} className="print-kit-field">
                  <dt>{campo.label}</dt>
                  <dd>{campo.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}
      <section className="print-section">
        <h2>Quadro comercial resumido</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Condição Comercial</th>
              <th>Valor/Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{isVendaDireta ? 'Modelo comercial' : 'Prazo contratual'}</td>
              <td>{prazoContratualResumo}</td>
            </tr>
            <tr>
              <td>Energia contratada (kWh/mês)</td>
              <td>{energiaContratadaResumo}</td>
            </tr>
            <tr>
              <td>Tarifa cheia da distribuidora</td>
              <td>{tarifaCheiaResumo}</td>
            </tr>
            {!isVendaDireta ? (
              <tr>
                <td>Desconto aplicado</td>
                <td>{descontoResumo}</td>
              </tr>
            ) : null}
            <tr>
              <td>{isVendaDireta ? 'Investimento total (CAPEX)' : 'Valor da instalação para o cliente'}</td>
              <td>{valorInstalacaoTexto}</td>
            </tr>
            <tr>
              <td>Início estimado da operação</td>
              <td>{inicioOperacaoTexto}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {isVendaDireta ? (
        <section className="print-section">
          <h2>Condições de pagamento</h2>
          {vendaFormResumo ? (
            <>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Condição</td>
                    <td>{condicaoLabel}</td>
                  </tr>
                  <tr>
                    <td>Investimento (CAPEX)</td>
                    <td>{currency(capex)}</td>
                  </tr>
                  {modoPagamentoLabel ? (
                    <tr>
                      <td>Modo de pagamento</td>
                      <td>{modoPagamentoLabel}</td>
                    </tr>
                  ) : null}
                  {isCondicaoAvista && mdrSelecionadoValor !== undefined ? (
                    <tr>
                      <td>MDR aplicado ({modoPagamentoLabel ?? 'selecionado'})</td>
                      <td>{formatPercentFromPct(mdrSelecionadoValor)}</td>
                    </tr>
                  ) : null}
                  {isCondicaoAvista ? (
                    <>
                      <tr>
                        <td>MDR Pix</td>
                        <td>{mdrPixResumo}</td>
                      </tr>
                      <tr>
                        <td>MDR débito</td>
                        <td>{mdrDebitoResumo}</td>
                      </tr>
                      <tr>
                        <td>MDR crédito à vista</td>
                        <td>{mdrCreditoVistaResumo}</td>
                      </tr>
                    </>
                  ) : null}
                  {isCondicaoParcelado ? (
                    <>
                      <tr>
                        <td>Número de parcelas</td>
                        <td>{parcelasResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do cartão (% a.m.)</td>
                        <td>{jurosCartaoAmResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do cartão (% a.a.)</td>
                        <td>{jurosCartaoAaResumo}</td>
                      </tr>
                      <tr>
                        <td>MDR crédito parcelado</td>
                        <td>{mdrCreditoParceladoResumo}</td>
                      </tr>
                    </>
                  ) : null}
                  {isCondicaoFinanciamento ? (
                    <>
                      <tr>
                        <td>Entrada</td>
                        <td>{entradaResumo}</td>
                      </tr>
                      <tr>
                        <td>Número de parcelas</td>
                        <td>{parcelasFinResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do financiamento (% a.m.)</td>
                        <td>{jurosFinAmResumo}</td>
                      </tr>
                      <tr>
                        <td>Juros do financiamento (% a.a.)</td>
                        <td>{jurosFinAaResumo}</td>
                      </tr>
                    </>
                  ) : null}
                </tbody>
              </table>
              <h3 className="print-subheading">Parâmetros de economia</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Consumo considerado</td>
                    <td>{consumoResumo}</td>
                  </tr>
                  <tr>
                    <td>Tarifa inicial</td>
                    <td>{tarifaInicialResumo}</td>
                  </tr>
                  <tr>
                    <td>Inflação de energia (a.a.)</td>
                    <td>{inflacaoResumo}</td>
                  </tr>
                  <tr>
                    <td>Taxa mínima mensal</td>
                    <td>{taxaMinimaResumo}</td>
                  </tr>
                  <tr>
                    <td>Iluminação pública</td>
                    <td>{iluminacaoPublicaResumo}</td>
                  </tr>
                  {!isVendaDireta ? (
                    <tr>
                      <td>Horizonte de análise</td>
                      <td>{horizonteAnaliseResumo}</td>
                    </tr>
                  ) : null}
                  {taxaDescontoResumo ? (
                    <tr>
                      <td>Taxa de desconto (a.a.)</td>
                      <td>{taxaDescontoResumo}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">
              Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
            </p>
          )}
        </section>
      ) : null}

      {isVendaDireta ? (
        <section className="print-section">
          <h2>{isVendaDireta ? 'Retorno Financeiro (Venda)' : 'Retorno projetado'}</h2>
          {retornoVenda ? (
            <div className="print-kpi-grid">
              <div className="print-kpi">
                <span>Payback estimado</span>
                <strong>{paybackLabelResumo}</strong>
              </div>
              <div className="print-kpi">
                <span>ROI acumulado ({roiHorizonteResumo})</span>
                <strong>{roiLabelResumo}</strong>
              </div>
              {typeof retornoVenda.vpl === 'number' ? (
                <div className="print-kpi">
                  <span>VPL</span>
                  <strong>{vplResumo}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">
              Informe os parâmetros financeiros na aba Vendas para calcular o retorno projetado.
            </p>
          )}
        </section>
      ) : null}

      <section className="print-section print-chart-section">
        <h2>{isVendaDireta ? 'Retorno projetado (30 anos)' : 'Economia projetada (30 anos)'}</h2>
        <div className="print-chart">
          <ResponsiveContainer width="50%" height={240}>
            <BarChart
              layout="vertical"
              data={chartDataPrintable}
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
                domain={[chartPrintableDomain.min, chartPrintableDomain.max]}
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
              {mostrarFinanciamento ? (
                <Legend
                  verticalAlign="top"
                  align="left"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 16 }}
                  payload={[
                    {
                      id: 'Financiamento',
                      value: 'Financiamento SolarInvest',
                      type: 'circle',
                      color: DEFAULT_CHART_COLORS.Financiamento,
                    },
                  ]}
                />
              ) : null}
              <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" strokeWidth={1} />
              <Bar
                dataKey="Leasing"
                fill={DEFAULT_CHART_COLORS.Leasing}
                barSize={14}
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
                name={chartPrimaryLabel}
              >
                <LabelList
                  dataKey="Leasing"
                  position="right"
                  formatter={(value: number) => currency(Number(value))}
                  fill={DEFAULT_CHART_COLORS.Leasing}
                  style={{ fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
              {mostrarFinanciamento ? (
                <Bar
                  dataKey="Financiamento"
                  fill={DEFAULT_CHART_COLORS.Financiamento}
                  barSize={14}
                  radius={[0, 8, 8, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="Financiamento"
                    position="right"
                    formatter={(value: number) => currency(Number(value))}
                    fill={DEFAULT_CHART_COLORS.Financiamento}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!isVendaDireta && beneficioMarcos.length ? (
          <ul className="print-chart-highlights">
            {beneficioMarcos.map((marco) => (
              <li key={`beneficio-marco-resumo-${marco.ano}`}>
                <span className="print-chart-highlights__year">{marco.ano}º ano</span>
                <div className="print-chart-highlights__values">
                  <span className="print-chart-highlights__value" style={{ color: DEFAULT_CHART_COLORS.Leasing }}>
                    {chartPrimaryLabel}: {currency(marco.Leasing)}
                  </span>
                  {mostrarFinanciamento ? (
                    <span
                      className="print-chart-highlights__value"
                      style={{ color: DEFAULT_CHART_COLORS.Financiamento }}
                    >
                      Financiamento: {currency(marco.Financiamento)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {!isVendaDireta && beneficioAno30Printable ? (
          <p className="chart-explainer">
            <strong>{chartEconomiaIntro}</strong>{' '}
            Em <strong>30 anos</strong>, a SolarInvest projeta um benefício acumulado de
            <strong style={{ color: DEFAULT_CHART_COLORS.Leasing }}>
              {' '}
              {currency(beneficioAno30Printable.Leasing)}
            </strong>
            {mostrarFinanciamento ? (
              <>
                {' '}
                {isVendaDireta ? 'na venda direta e de' : 'no leasing e de'}
                <strong style={{ color: DEFAULT_CHART_COLORS.Financiamento }}>
                  {' '}
                  {currency(beneficioAno30Printable.Financiamento)}
                </strong>{' '}
                {isVendaDireta
                  ? 'com financiamento como alternativa de pagamento.'
                  : 'com financiamento.'}
              </>
            ) : (
              <> comparado à concessionária.</>
            )}{' '}
            {chartExplainerContext}
          </p>
        ) : null}
        {!isVendaDireta ? <p className="print-chart-footnote">{chartFootnoteText}</p> : null}
      </section>

      <section className="print-section print-important">
        <h2>Informações importantes</h2>
        <ul>
          {isVendaDireta ? (
            <>
              <li>Esta proposta refere-se à venda do sistema fotovoltaico (não inclui serviços de leasing).</li>
              <li>Todos os equipamentos utilizados possuem certificação INMETRO (ou equivalente) e seguem as normas técnicas aplicáveis.</li>
              <li>Os valores, condições de pagamento e prazos apresentados são estimativas preliminares e podem ser ajustados na contratação definitiva.</li>
              <li>A projeção de economia considera: produção estimada, tarifa de energia inicial e inflação de energia informadas, e a taxa mínima aplicável em sistemas on-grid.</li>
              <li>As parcelas/encargos de cartão e/ou financiamento impactam o fluxo de caixa e o ROI projetado.</li>
              <li>O cronograma de entrega e instalação está sujeito a vistoria técnica e disponibilidade de estoque.</li>
              <li>Garantias dos fabricantes seguem seus termos. Manutenção preventiva/corretiva e seguros podem ser contratados à parte (se aplicável).</li>
              <li>
                Não é de responsabilidade da SolarInvest Solutions cálculo e reforço/modificações de estrutura; reforço/modificações na rede elétrica; mudança/adaptação de transformador; armazenamento/seguro de material; segurança local; autorização ambiental; autorização de autoridades/autarquias municipais/estaduais além da distribuidora de energia; e ajuste de tensão com troca de padrão junto à distribuidora. O prazo de entrega da instalação será de acordo com contrato assinado e condicionado às intempéries climáticas, podendo ser de aproximadamente 30 dias úteis após a entrega integral do material.
              </li>
              <li>
                É de responsabilidade da SolarInvest Solutions: dimensionamento do sistema; elaboração do projeto; relação dos equipamentos e materiais necessários; acompanhamento junto à distribuidora; instalação do sistema; supervisão e gerenciamento da obra. Será realizada visita técnica antes da assinatura do contrato e o dimensionamento poderá ser ajustado conforme a posição da cobertura, pois as estimativas consideram a instalação dos módulos orientados para o norte, inclinados a 17° e livres de sombreamento.
              </li>
            </>
          ) : (
            <>
              <li>Desconto contratual aplicado: {descontoResumo} sobre a tarifa da distribuidora.</li>
              <li>Prazo de vigência: conforme especificado na proposta (ex.: 60 meses).</li>
              <li>Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.</li>
              <li>
                Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e seguro sinistro da usina.
              </li>
              <li>
                Transferência da usina ao cliente ao final do contrato sem custo adicional, desde que obrigações contratuais estejam
                cumpridas.
              </li>
              <li>Tabela de compra antecipada disponível mediante solicitação.</li>
              <li>Equipamentos utilizados possuem certificação INMETRO.</li>
              <li>
                Os valores apresentados nesta proposta são estimativas preliminares e poderão sofrer ajustes no contrato definitivo.
              </li>
            </>
          )}
        </ul>
      </section>

      <section className="print-section print-cta">
        <div className="print-cta__box">
          <h2>Vamos avançar?</h2>
          <p>
            Agende uma visita técnica gratuita com nossa equipe para confirmar a viabilidade e formalizar a proposta definitiva.
          </p>
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
        <span>{isVendaDireta ? 'Energia inteligente para o seu negócio' : 'Energia inteligente, sem desembolso'}</span>
      </div>
    </div>
  )
}

export const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProposalProps>(PrintableProposalInner)

export default PrintableProposal

