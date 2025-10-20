import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Label, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import './styles/proposal-venda.css'
import { currency, formatCpfCnpj, formatAxis, tarifaCurrency } from '../../utils/formatters'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import { classifyBudgetItem } from '../../utils/moduleDetection'
import { formatMoneyBRWithDigits, formatNumberBRWithOptions, formatPercentBR, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'

const DEFAULT_CHART_COLORS: Record<'Leasing' | 'Financiamento', string> = {
  Leasing: '#2563EB',
  Financiamento: '#10B981',
}

const BENEFICIO_CHART_ANOS = [5, 6, 10, 15, 20, 30]

function PrintableProposalInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
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
    potenciaModulo: potenciaModuloProp,
    numeroModulos,
    potenciaInstaladaKwp,
    descontoContratualPct,
    distribuidoraTarifa,
    energiaContratadaKwh,
    tarifaCheia,
    vendaResumo: vendaResumoProp,
    tipoInstalacao,
    parsedPdfVenda,
    orcamentoItens,
    composicaoUfv,
    vendaSnapshot,
  } = props
  const isVendaDireta = tipoProposta === 'VENDA_DIRETA'
  const vendaResumo = isVendaDireta && vendaResumoProp ? vendaResumoProp : null
  const vendaFormResumo = vendaResumo?.form
  const retornoVenda = vendaResumo?.retorno ?? null
  const snapshotConfig = vendaSnapshot?.configuracao ?? null
  const snapshotResultados = vendaSnapshot?.resultados ?? null
  const snapshotParametros = vendaSnapshot?.parametros ?? null
  const snapshotPagamento = vendaSnapshot?.pagamento ?? null
  const snapshotComposicao = vendaSnapshot?.composicao ?? null
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
  const sanitizeTextField = (value?: string | null) => {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed ? trimmed : null
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
    snapshotConfig?.potencia_sistema_kwp,
    vendaFormResumo?.potencia_instalada_kwp,
    parsedPdfResumo?.potencia_instalada_kwp,
    potenciaInstaladaKwp,
  )
  const kitGeracao = pickPositive(
    snapshotConfig?.geracao_estimada_kwh_mes,
    vendaFormResumo?.geracao_estimada_kwh_mes,
    parsedPdfResumo?.geracao_estimada_kwh_mes,
    geracaoMensalKwh,
  )
  const kitConsumo = pickPositive(
    snapshotResultados?.energia_contratada_kwh_mes,
    snapshotParametros?.consumo_kwh_mes,
    vendaFormResumo?.consumo_kwh_mes,
    parsedPdfResumo?.consumo_kwh_mes,
    energiaContratadaKwh,
  )
  const kitQuantidadeModulos = pickPositive(
    snapshotConfig?.n_modulos,
    vendaFormResumo?.quantidade_modulos,
    parsedPdfResumo?.quantidade_modulos,
    numeroModulos,
  )

  const printableBudgetItems = useMemo(() => orcamentoItens ?? [], [orcamentoItens])
  const inverterItems = useMemo(
    () =>
      printableBudgetItems.filter((item) =>
        classifyBudgetItem({
          product: item.produto,
          description: item.descricao,
          quantity: item.quantidade ?? null,
          extra: `${item.modelo ?? ''} ${item.fabricante ?? ''}`,
        }) === 'inverter',
      ),
    [printableBudgetItems],
  )
  const moduleItems = useMemo(
    () =>
      printableBudgetItems.filter((item) =>
        classifyBudgetItem({
          product: item.produto,
          description: item.descricao,
          quantity: item.quantidade ?? null,
          extra: `${item.modelo ?? ''} ${item.fabricante ?? ''}`,
        }) === 'module',
      ),
    [printableBudgetItems],
  )

  const sumItemQuantity = (items: typeof printableBudgetItems): number | null => {
    let total = 0
    let hasAny = false
    items.forEach((item) => {
      if (Number.isFinite(item.quantidade) && (item.quantidade ?? 0) > 0) {
        total += Number(item.quantidade)
        hasAny = true
      }
    })
    if (!hasAny) {
      return null
    }
    return total
  }

  const pickFirstText = (...values: (string | null | undefined)[]): string | null => {
    for (const value of values) {
      if (typeof value !== 'string') {
        continue
      }
      const trimmed = value.trim()
      if (trimmed) {
        return trimmed
      }
    }
    return null
  }

  const firstItemText = (
    items: typeof printableBudgetItems,
    extractor: (item: (typeof printableBudgetItems)[number]) => string | null | undefined,
  ): string | null => {
    for (const item of items) {
      const value = extractor(item)
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed) {
          return trimmed
        }
      }
    }
    return null
  }

  const moduleQuantidadeCatalogo = sumItemQuantity(moduleItems)
  const inverterQuantidadeCatalogo = sumItemQuantity(inverterItems)

  const inverterNome = firstItemText(inverterItems, (item) => item.produto || item.descricao)
  const moduleNome = firstItemText(moduleItems, (item) => item.produto || item.descricao)

  const inverterModeloCatalogo = firstItemText(inverterItems, (item) => item.modelo || item.fabricante || null)
  const moduleModeloCatalogo = firstItemText(moduleItems, (item) => item.modelo || item.fabricante || null)

  const inverterModelo = pickFirstText(
    snapshotConfig?.modelo_inversor,
    vendaFormResumo?.modelo_inversor,
    parsedPdfResumo?.modelo_inversor,
    inverterModeloCatalogo,
  )
  const moduleModelo = pickFirstText(
    snapshotConfig?.modelo_modulo,
    vendaFormResumo?.modelo_modulo,
    parsedPdfResumo?.modelo_modulo,
    moduleModeloCatalogo,
  )

  const inverterQuantidade = pickPositive(inverterQuantidadeCatalogo)
  const moduleQuantidade = pickPositive(kitQuantidadeModulos, moduleQuantidadeCatalogo)

  const formatEquipmentQuantidade = (valor: number | null, unidade: string) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return null
    }
    return `${formatNumberBRWithOptions(Math.round(valor ?? 0), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} ${unidade}`
  }

  const formatEquipmentDetail = ({
    nome,
    modelo,
    quantidade,
  }: {
    nome: string | null
    modelo: string | null
    quantidade: string | null
  }): string => {
    const partes: string[] = []
    if (nome) {
      partes.push(`Nome: ${nome}`)
    }
    if (modelo) {
      partes.push(`Modelo: ${modelo}`)
    }
    if (quantidade) {
      partes.push(`Quantidade: ${quantidade}`)
    }
    if (partes.length === 0) {
      return '—'
    }
    return partes.join(' • ')
  }

  const formatKwpDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(valor ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`
  }

  const potenciaModuloDetalhe = pickPositive(
    snapshotConfig?.potencia_modulo_wp,
    parsedPdfResumo?.potencia_da_placa_wp,
    potenciaModuloProp,
  )
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
    snapshotParametros?.tarifa_r_kwh,
    vendaFormResumo?.tarifa_cheia_r_kwh,
    parsedPdfResumo?.tarifa_cheia_r_kwh,
    tarifaCheia,
  )

  const autonomiaSnapshotPct =
    typeof snapshotResultados?.autonomia_frac === 'number' && snapshotResultados.autonomia_frac > 0
      ? snapshotResultados.autonomia_frac * 100
      : null
  const autonomiaPct =
    autonomiaSnapshotPct ??
    (kitGeracao && kitConsumo && kitGeracao > 0 && kitConsumo > 0 ? (kitGeracao / kitConsumo) * 100 : null)
  const autonomiaLabel =
    Number.isFinite(autonomiaPct) && (autonomiaPct ?? 0) > 0
      ? formatPercentBRWithDigits((autonomiaPct ?? 0) / 100, 1)
      : '—'

  const detalhamentoCampos = [
    { label: 'Potência do sistema', value: formatKwpDetalhe(kitPotenciaInstalada ?? null) },
    { label: 'Produção média mensal', value: formatKwhMes(kitGeracao ?? undefined) },
    { label: 'Energia contratada (kWh/mês)', value: formatKwhMes(kitConsumo ?? undefined) },
    {
      label: 'Inversores',
      value: formatEquipmentDetail({
        nome: inverterNome,
        modelo: inverterModelo,
        quantidade: formatEquipmentQuantidade(inverterQuantidade, 'inversores'),
      }),
    },
    {
      label: 'Módulos',
      value: formatEquipmentDetail({
        nome: moduleNome,
        modelo: moduleModelo,
        quantidade: formatEquipmentQuantidade(moduleQuantidade, 'módulos'),
      }),
    },
    { label: 'Potência dos módulos', value: formatModuloDetalhe(potenciaModuloDetalhe ?? null) },
    { label: 'Tarifa atual (distribuidora)', value: formatTarifaDetalhe(tarifaProjeto ?? null) },
    { label: 'Autonomia (%)', value: autonomiaLabel },
  ]
  const duracaoContratualValida =
    typeof buyoutResumo.duracao === 'number' && Number.isFinite(buyoutResumo.duracao)
  const mostrarDetalhamento = detalhamentoCampos.length > 0
  const distribuidoraTarifaLabel =
    distribuidoraTarifa?.trim() || snapshotParametros?.distribuidora?.trim() || ''
  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : ''
  const codigoOrcamento = budgetId?.trim() || ''
  const emailCliente = cliente.email?.trim() || ''
  const telefoneCliente = cliente.telefone?.trim() || ''
  const ucCliente = cliente.uc?.trim() || ''
  const cidadeCliente = cliente.cidade?.trim() || ''
  const ufCliente = cliente.uf?.trim() || ''
  const enderecoCliente = cliente.endereco?.trim() || ''
  const cidadeUfLabel = cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—'
  const enderecoLabel = enderecoCliente ? enderecoCliente : cidadeUfLabel
  const clienteCampos: ClientInfoField[] = [
    { label: 'Código do orçamento', value: codigoOrcamento || '—' },
    { label: 'Cliente', value: cliente.nome || '—' },
    { label: 'Documento', value: documentoCliente || '—' },
    { label: 'UC', value: ucCliente || '—' },
    { label: 'Distribuidora', value: distribuidoraTarifaLabel || '—' },
    { label: 'E-mail', value: emailCliente || '—' },
    { label: 'Telefone', value: telefoneCliente || '—' },
    { label: 'Cidade / UF', value: cidadeUfLabel },
    { label: 'Endereço', value: enderecoLabel, wide: true },
  ]
  const tarifaCheiaValor = pickPositive(snapshotParametros?.tarifa_r_kwh, tarifaCheia)
  const tarifaCheiaResumo = tarifaCheiaValor ? tarifaCurrency(tarifaCheiaValor) : '—'
  const descontoResumo =
    !isVendaDireta && Number.isFinite(descontoContratualPct)
      ? formatPercentBR((descontoContratualPct ?? 0) / 100)
      : '—'
  const condicaoFonte =
    (snapshotPagamento?.forma_pagamento as 'AVISTA' | 'PARCELADO' | 'FINANCIAMENTO' | undefined) ??
    vendaFormResumo?.condicao ??
    null
  const condicaoLabel = (() => {
    switch (condicaoFonte) {
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
  const isCondicaoAvista = condicaoFonte === 'AVISTA'
  const isCondicaoParcelado = condicaoFonte === 'PARCELADO'
  const isCondicaoFinanciamento = condicaoFonte === 'FINANCIAMENTO'
  const modoPagamentoTipo = vendaFormResumo?.modo_pagamento ?? 'PIX'
  const modoPagamentoLabel =
    isCondicaoAvista
      ? modoPagamentoTipo === 'PIX'
        ? 'Pix'
        : modoPagamentoTipo === 'DEBITO'
        ? 'Cartão de débito'
        : 'Cartão de crédito'
      : null
  const formaPagamentoLabel = (() => {
    if (isCondicaoAvista && modoPagamentoLabel) {
      return `${condicaoLabel} • ${modoPagamentoLabel}`
    }
    return condicaoLabel
  })()
  const consumoResumo = formatKwhMes(snapshotParametros?.consumo_kwh_mes ?? vendaFormResumo?.consumo_kwh_mes)
  const tarifaInicialResumo = (() => {
    const valor = pickPositive(snapshotParametros?.tarifa_r_kwh, vendaFormResumo?.tarifa_cheia_r_kwh)
    return Number.isFinite(valor) && (valor ?? 0) > 0 ? tarifaCurrency(valor ?? 0) : tarifaCheiaResumo
  })()
  const inflacaoResumo = formatPercentFromPct(
    snapshotParametros?.inflacao_energia_aa ?? vendaFormResumo?.inflacao_energia_aa_pct,
  )
  const taxaMinimaResumo = Number.isFinite(snapshotParametros?.taxa_minima_rs_mes)
    ? currency(snapshotParametros?.taxa_minima_rs_mes ?? 0)
    : Number.isFinite(vendaFormResumo?.taxa_minima_mensal)
    ? currency(vendaFormResumo?.taxa_minima_mensal ?? 0)
    : '—'
  const iluminacaoPublicaResumo = Number.isFinite(vendaFormResumo?.taxa_minima_r_mes)
    ? currency(vendaFormResumo?.taxa_minima_r_mes ?? 0)
    : '—'
  const horizonteAnaliseResumo = formatMeses(snapshotParametros?.horizonte_meses ?? vendaFormResumo?.horizonte_meses)
  const taxaDescontoResumo = Number.isFinite(snapshotParametros?.taxa_desconto_aa)
    ? formatPercentFromPct(snapshotParametros?.taxa_desconto_aa)
    : Number.isFinite(vendaFormResumo?.taxa_desconto_aa_pct)
    ? formatPercentFromPct(vendaFormResumo?.taxa_desconto_aa_pct)
    : null
  const parcelasResumo = formatParcelas(vendaFormResumo?.n_parcelas)
  const jurosCartaoAmResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_am_pct)
  const jurosCartaoAaResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_aa_pct)
  const mdrPixResumo = formatPercentFromPct(
    Number.isFinite(snapshotPagamento?.mdr_pix) ? snapshotPagamento?.mdr_pix : vendaFormResumo?.taxa_mdr_pix_pct,
  )
  const mdrDebitoResumo = formatPercentFromPct(
    Number.isFinite(snapshotPagamento?.mdr_debito) ? snapshotPagamento?.mdr_debito : vendaFormResumo?.taxa_mdr_debito_pct,
  )
  const mdrCreditoVistaResumo = formatPercentFromPct(
    Number.isFinite(snapshotPagamento?.mdr_credito_avista)
      ? snapshotPagamento?.mdr_credito_avista
      : vendaFormResumo?.taxa_mdr_credito_vista_pct,
  )
  const mdrCreditoParceladoResumo = formatPercentFromPct(
    vendaFormResumo?.taxa_mdr_credito_parcelado_pct,
  )
  const encargosFinanceirosLabel = (() => {
    if (isCondicaoAvista) {
      return `Pix: ${mdrPixResumo} | Débito: ${mdrDebitoResumo} | Crédito à vista: ${mdrCreditoVistaResumo}`
    }
    if (isCondicaoParcelado) {
      return `Crédito parcelado: ${mdrCreditoParceladoResumo}`
    }
    return '—'
  })()
  const entradaResumo = Number.isFinite(vendaFormResumo?.entrada_financiamento)
    ? currency(vendaFormResumo?.entrada_financiamento ?? 0)
    : '—'
  const parcelasFinResumo = formatParcelas(vendaFormResumo?.n_parcelas_fin)
  const jurosFinAmResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_am_pct)
  const jurosFinAaResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_aa_pct)
  const paybackValor = snapshotResultados?.payback_meses ?? retornoVenda?.payback ?? null
  const paybackLabelResumo =
    Number.isFinite(paybackValor) && (paybackValor ?? 0) > 0
      ? `${Math.round(paybackValor ?? 0)} meses`
      : 'Não atingido em 30 anos'
  const roiValor = snapshotResultados?.roi_acumulado_30a ?? retornoVenda?.roi ?? null
  const roiLabelResumo = Number.isFinite(roiValor)
    ? new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(roiValor ?? 0)
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
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const validadePropostaLabel =
    sanitizeTextField(snapshotPagamento?.validade_proposta_txt) ??
    sanitizeTextField(vendaFormResumo?.validade_proposta) ??
    `${validadeTexto} (15 dias corridos)`
  const prazoExecucaoLabel =
    sanitizeTextField(snapshotPagamento?.prazo_execucao_txt) ??
    sanitizeTextField(vendaFormResumo?.prazo_execucao) ??
    'Sob consulta'
  const condicoesAdicionaisLabel =
    sanitizeTextField(snapshotPagamento?.condicoes_adicionais_txt) ??
    sanitizeTextField(vendaFormResumo?.condicoes_adicionais) ??
    '—'
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
        <div className="print-hero__summary no-break-inside">
          <h2 className="keep-with-next">Sumário executivo</h2>
          <p>{heroSummaryDescription}</p>
        </div>
      </header>

      <section className="print-section no-break-inside">
        <h2 className="keep-with-next">Identificação do cliente</h2>
        <ClientInfoGrid
          fields={clienteCampos}
          className="print-client-grid no-break-inside"
          fieldClassName="print-client-field"
          wideFieldClassName="print-client-field--wide"
        />
      </section>

      {mostrarDetalhamento ? (
        <section className="print-section no-break-inside">
          <h2 className="keep-with-next">Detalhamento do Projeto</h2>
          {detalhamentoCampos.length > 0 ? (
            <table className="print-table no-break-inside">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor/Descrição</th>
                </tr>
              </thead>
              <tbody>
                {detalhamentoCampos.map((campo) => (
                  <tr key={campo.label}>
                    <td>{campo.label}</td>
                    <td>{campo.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
      <section className="print-section no-break-inside">
        <h2 className="keep-with-next">Resumo de Custos e Investimento</h2>
        <table className="print-table no-break-inside">
          <thead>
            <tr>
              <th>Item</th>
              <th>Valor/Descrição</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const linhas: { label: string; valor: number }[] = []
              if (snapshotComposicao) {
                const pushValor = (label: string, valor: number | null | undefined) => {
                  if (Number.isFinite(valor) && (valor ?? 0) > 0) {
                    linhas.push({ label, valor: Number(valor) })
                  }
                }
                const valorKit = Number.isFinite(vendaSnapshot?.orcamento.valor_total_orcamento)
                  ? Number(vendaSnapshot?.orcamento.valor_total_orcamento)
                  : null
                if (valorKit && valorKit > 0) {
                  linhas.push({ label: 'Kit Fotovoltaico', valor: valorKit })
                }
                pushValor('Projeto', snapshotComposicao.projeto)
                pushValor('Instalação', snapshotComposicao.instalacao)
                pushValor('Material CA', snapshotComposicao.material_ca)
                pushValor('ART', snapshotComposicao.art)
                pushValor('CREA', snapshotComposicao.crea)
                pushValor('Placa', snapshotComposicao.placa)
                pushValor('OPEX', snapshotComposicao.opex)
                pushValor('Comissão líquida', snapshotComposicao.comissao_liquida)
                pushValor('Margem Operacional', snapshotComposicao.margem_operacional)
                pushValor('Imposto retido', snapshotComposicao.imposto_retido)

                const subtotal = linhas.reduce((acc, item) => acc + item.valor, 0)
                const linhasRender = linhas.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{currency(item.valor)}</td>
                  </tr>
                ))

                linhasRender.push(
                  <tr key="total-capex">
                    <td>Investimento Total do Projeto</td>
                    <td>{subtotal > 0 ? currency(subtotal) : '—'}</td>
                  </tr>,
                )

                return linhasRender
              }

              const composicaoAtual = composicaoUfv ?? null
              if (!composicaoAtual) {
                return [
                  <tr key="total-capex">
                    <td>Investimento Total do Projeto</td>
                    <td>—</td>
                  </tr>,
                ]
              }

              const itens: { label: string; valor: number }[] = []
              const pushIfPositivo = (label: string, valor: number | null | undefined) => {
                if (Number.isFinite(valor) && (valor ?? 0) > 0) {
                  itens.push({ label, valor: Number(valor) })
                }
              }
              const tipoResumo = composicaoAtual.tipoAtual ?? tipoInstalacao
              const kitValor = Number.isFinite(composicaoAtual.valorOrcamento)
                ? Number(composicaoAtual.valorOrcamento)
                : null
              if (kitValor && kitValor > 0) {
                itens.push({ label: 'Kit Fotovoltaico', valor: kitValor })
              }
              if (tipoResumo === 'TELHADO') {
                const telhadoValores = composicaoAtual.telhado
                pushIfPositivo('Projeto', telhadoValores?.projeto)
                pushIfPositivo('Instalação', telhadoValores?.instalacao)
                pushIfPositivo('Material CA', telhadoValores?.materialCa)
                pushIfPositivo('ART', (telhadoValores as { art?: number })?.art ?? null)
                pushIfPositivo('CREA', telhadoValores?.crea)
                pushIfPositivo('Placa', telhadoValores?.placa)
                pushIfPositivo('Comissão líquida', telhadoValores?.comissaoLiquida)
                pushIfPositivo('Margem Operacional', telhadoValores?.lucroBruto)
                pushIfPositivo('Imposto retido', telhadoValores?.impostoRetido)
              } else {
                const soloValores = composicaoAtual.solo
                pushIfPositivo('Projeto', soloValores?.projeto)
                pushIfPositivo('Instalação', soloValores?.instalacao)
                pushIfPositivo('Material CA', soloValores?.materialCa)
                pushIfPositivo('ART', (soloValores as { art?: number })?.art ?? null)
                pushIfPositivo('CREA', soloValores?.crea)
                pushIfPositivo('Placa', soloValores?.placa)
                pushIfPositivo('TELA', soloValores?.tela)
                pushIfPositivo('M. OBRA - TELA', soloValores?.maoObraTela)
                pushIfPositivo('PORTÃO - TELA', soloValores?.portaoTela)
                pushIfPositivo('CASA INVERSOR', soloValores?.casaInversor)
                pushIfPositivo('TRAFO', soloValores?.trafo)
                pushIfPositivo('BRITA', soloValores?.brita)
                pushIfPositivo('TERRAPLANAGEM', soloValores?.terraplanagem)
                pushIfPositivo('Comissão líquida', soloValores?.comissaoLiquida)
                pushIfPositivo('Margem Operacional', soloValores?.lucroBruto)
                pushIfPositivo('Imposto retido', soloValores?.impostoRetido)
              }
              const subtotal = itens.reduce((acc, item) => acc + item.valor, 0)
              const linhasRender = itens.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{currency(item.valor)}</td>
                </tr>
              ))
              linhasRender.push(
                <tr key="total-capex">
                  <td>Investimento Total do Projeto</td>
                  <td>{subtotal > 0 ? currency(subtotal) : '—'}</td>
                </tr>,
              )
              return linhasRender
            })()}
          </tbody>
        </table>
      </section>

      {isVendaDireta ? (
        <section className="print-section no-break-inside">
          <h2 className="keep-with-next">Condições Comerciais e de Pagamento</h2>
          {snapshotPagamento || vendaFormResumo ? (
            <>
              <table className="print-table no-break-inside">
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Forma de pagamento</td>
                    <td>{formaPagamentoLabel}</td>
                  </tr>
                  <tr>
                    <td>Investimento total (CAPEX)</td>
                    <td>{currency(capex)}</td>
                  </tr>
                  <tr>
                    <td>Validade da proposta</td>
                    <td>{validadePropostaLabel}</td>
                  </tr>
                  <tr>
                    <td>Prazo de execução</td>
                    <td>{prazoExecucaoLabel}</td>
                  </tr>
                  <tr>
                    <td>Encargos financeiros (MDR)</td>
                    <td>{encargosFinanceirosLabel}</td>
                  </tr>
                  <tr>
                    <td>Condições adicionais</td>
                    <td>{condicoesAdicionaisLabel}</td>
                  </tr>
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
              <h3 className="print-subheading keep-with-next">Parâmetros de economia</h3>
              <table className="print-table no-break-inside">
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
            <p className="muted no-break-inside">
              Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
            </p>
          )}
        </section>
      ) : null}

      {isVendaDireta ? (
        <section className="print-section no-break-inside">
          <h2 className="keep-with-next">{isVendaDireta ? 'Retorno Financeiro (Venda)' : 'Retorno projetado'}</h2>
          {snapshotResultados || retornoVenda ? (
            <div className="print-kpi-grid no-break-inside">
              <div className="print-kpi no-break-inside">
                <span>Payback estimado</span>
                <strong>{paybackLabelResumo}</strong>
              </div>
              <div className="print-kpi no-break-inside">
                <span>ROI acumulado ({roiHorizonteResumo})</span>
                <strong>{roiLabelResumo}</strong>
              </div>
              {typeof retornoVenda?.vpl === 'number' ? (
                <div className="print-kpi no-break-inside">
                  <span>VPL</span>
                  <strong>{vplResumo}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted no-break-inside">
              Informe os parâmetros financeiros na aba Vendas para calcular o retorno projetado.
            </p>
          )}
        </section>
      ) : null}

      <section className="print-section print-chart-section no-break-inside">
        <h2 className="keep-with-next">{isVendaDireta ? 'Retorno projetado (30 anos)' : 'Economia projetada (30 anos)'}</h2>
        <div className="print-chart no-break-inside">
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
          <ul className="print-chart-highlights no-break-inside">
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
          <p className="chart-explainer no-break-inside">
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
        {!isVendaDireta ? <p className="print-chart-footnote no-break-inside">{chartFootnoteText}</p> : null}
      </section>

      <section className="print-section print-important no-break-inside">
        <h2 className="keep-with-next">Informações importantes</h2>
        <ul className="no-break-inside">
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

      <section className="print-section print-cta no-break-inside">
        <div className="print-cta__box no-break-inside">
          <h2 className="keep-with-next">Vamos avançar?</h2>
          <p>
            Agende uma visita técnica gratuita com nossa equipe para confirmar a viabilidade e formalizar a proposta definitiva.
          </p>
        </div>
      </section>

      <footer className="print-final-footer no-break-inside">
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

      <div className="print-brand-footer no-break-inside">
        <strong>SOLARINVEST</strong>
        <span>CNPJ: 60.434.015/0001-90</span>
        <span>Anápolis-GO</span>
        <span>Solarinvest.info</span>
      </div>
    </div>
  )
}

export const PrintableProposalVenda = React.forwardRef<HTMLDivElement, PrintableProposalProps>(PrintableProposalInner)

export default PrintableProposalVenda

