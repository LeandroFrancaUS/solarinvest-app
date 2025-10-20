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

import './styles/proposal-leasing.css'
import { formatCpfCnpj } from '../../utils/formatters'
import {
  formatMoneyBR,
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
  fmt,
} from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import { agrupar, type Linha } from '../../lib/pdf/grouping'

const BUDGET_ITEM_EXCLUSION_PATTERNS: RegExp[] = [
  /@/i,
  /\bemail\b/i,
  /brsolarinvest/i,
  /\btelefone\b/i,
  /\bwhatsapp\b/i,
  /\bcnpj\b/i,
  /\bcpf\b/i,
  /\brg\b/i,
  /\bdados do cliente\b/i,
  /\bcliente\b/i,
  /^or[cç]amento\b/i,
  /\bendere[cç]o\b/i,
  /\bbairro\b/i,
  /\bcidade\b/i,
  /\bestado\b/i,
  /\bcep\b/i,
  /\bc[óo]digo do or[cç]amento\b/i,
  /portf[óo]lio/i,
  /sobre\s+n[óo]s/i,
  /proposta comercial/i,
  /contato/i,
  /\baceite da proposta\b/i,
  /\bassinatura\b/i,
  /\bdocumento\b/i,
  /\bru[áa]/i,
  /\bjardim/i,
  /\betapa/i,
  /an[áa]polis/i,
  /\bdistribuidora\b/i,
  /\buc\b/i,
  /vamos avan[çc]ar/i,
  /valor\s+total/i,
  /cot[aã][cç][aã]o\b/i,
  /entrega\s+escolhida/i,
  /transportadora/i,
  /condi[cç][aã]o\s+de\s+pagamento/i,
  /pot[êe]ncia\s+do\s+sistema/i,
]

const ECONOMIA_MARCOS = [5, 6, 10, 15, 20, 30]
const LEASING_CHART_COLOR = '#2563EB'
const COVER_TAGLINE = 'Solução SolarInvest Leasing — Energia solar sem investimento inicial'

const toDisplayPercent = (value?: number, fractionDigits = 1) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatPercentBRWithDigits((value ?? 0) / 100, fractionDigits)
}

const formatTarifaKwh = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  const exibicao = formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  })
  return `R$ ${exibicao}/kWh`
}

const formatAxisCurrency = (value: number) => formatMoneyBR(Number.isFinite(value) ? value : 0)

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
    buyoutResumo,
    tabelaBuyout,
    capex,
    anos,
    leasingROI,
    parcelasLeasing,
    distribuidoraTarifa,
    leasingDataInicioOperacao,
    leasingValorInstalacaoCliente,
    leasingValorDeMercadoEstimado,
    leasingPrazoContratualMeses,
    leasingValorMercadoProjetado,
    leasingInflacaoEnergiaAa,
    orcamentoItens,
  } = props

  const nomeCliente = cliente.nome?.trim() || '—'
  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : '—'
  const telefoneCliente = cliente.telefone?.trim() || '—'
  const emailCliente = cliente.email?.trim() || '—'
  const enderecoCliente = cliente.endereco?.trim() || null
  const cidadeCliente = cliente.cidade?.trim() || null
  const ufCliente = cliente.uf?.trim() || null
  const codigoOrcamento = budgetId?.trim() || null
  const ucCliente = cliente.uc?.trim() || '—'
  const distribuidoraLabel = distribuidoraTarifa?.trim() || cliente.distribuidora?.trim() || '—'

  const codigoLimpo = codigoOrcamento ? codigoOrcamento.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : ''
  const codigoSufixo = codigoLimpo ? codigoLimpo.slice(-6).padStart(6, '0') : '000000'
  const codigoDocumento = `SLRINVST-${codigoSufixo}`

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
  const inicioOperacaoTexto = leasingDataInicioOperacao?.trim() || 'Conforme agenda técnica'

  const investimentoSolarinvestFormatado =
    Number.isFinite(leasingValorDeMercadoEstimado) && (leasingValorDeMercadoEstimado ?? 0) > 0
      ? formatMoneyBR(leasingValorDeMercadoEstimado ?? 0)
      : '—'

  const clienteCampos: ClientInfoField[] = [
    { label: 'Cliente', value: nomeCliente },
    { label: 'Documento', value: documentoCliente },
    { label: 'UC', value: ucCliente },
    { label: 'Distribuidora', value: distribuidoraLabel },
    { label: 'Telefone', value: telefoneCliente },
    { label: 'E-mail', value: emailCliente },
    {
      label: 'Cidade / UF',
      value: cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—',
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
    { label: 'Código original', value: codigoOrcamento || '—' },
  ]

  const numeroModulosFormatado =
    Number.isFinite(numeroModulos) && (numeroModulos ?? 0) > 0
      ? formatNumberBRWithOptions(numeroModulos ?? 0, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : '—'

  const areaInstalacaoFormatada = fmt.m2(areaInstalacao)
  const tipoInstalacaoTexto = tipoInstalacao === 'SOLO' ? 'Solo' : 'Telhado'

  const detalhamentoProjeto = [
    { label: 'Potência instalada', value: fmt.kwp(potenciaInstaladaKwp) },
    { label: 'Geração média mensal', value: fmt.kwhMes(geracaoMensalKwh) },
    { label: 'Energia contratada', value: fmt.kwhMes(energiaContratadaKwh) },
    { label: 'Número de módulos', value: numeroModulosFormatado },
    { label: 'Potência unitária dos módulos', value: fmt.wp(potenciaModulo) },
    { label: 'Área estimada de instalação', value: areaInstalacaoFormatada },
    { label: 'Tipo de instalação', value: tipoInstalacaoTexto },
  ]

  const mensalidadeEstimativaValor = useMemo(() => {
    const primeiraParcela = parcelasLeasing.find((row) =>
      Number.isFinite(row?.mensalidade) && (row?.mensalidade ?? 0) > 0,
    )
    return primeiraParcela?.mensalidade ?? null
  }, [parcelasLeasing])

  const compraAntecipadaValor = useMemo(() => {
    const candidatos = tabelaBuyout
      .filter((row) => Number.isFinite(row?.valorResidual) && (row?.valorResidual ?? 0) > 0)
      .sort((a, b) => a.mes - b.mes)
    return candidatos.length > 0 ? candidatos[0].valorResidual ?? null : null
  }, [tabelaBuyout])

  const vigenciaTexto = prazoContratual > 0 ? `${prazoContratual} meses` : 'Conforme proposta'
  const mensalidadeEstimativa =
    mensalidadeEstimativaValor != null ? formatMoneyBR(mensalidadeEstimativaValor) : '—'
  const descontoInformativo = toDisplayPercent(descontoContratualPct)
  const compraAntecipadaTexto = compraAntecipadaValor != null ? formatMoneyBR(compraAntecipadaValor) : 'Sob consulta'
  const capexFormatado = Number.isFinite(capex) ? formatMoneyBR(Math.max(0, capex ?? 0)) : '—'
  const observacaoContrato =
    'Valores sujeitos à vistoria técnica, atualização tributária e aprovação documental da distribuidora.'

  const condicoesContrato = [
    { label: 'Vigência do contrato', value: vigenciaTexto },
    { label: 'Mensalidade estimada inicial', value: mensalidadeEstimativa },
    { label: 'Desconto aplicado sobre a tarifa', value: descontoInformativo },
    { label: 'Compra antecipada (a partir de)', value: compraAntecipadaTexto },
    { label: 'CAPEX assumido pela SolarInvest', value: capexFormatado },
    { label: 'Observação', value: observacaoContrato },
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

  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)

  const beneficioAno30 = economiaProjetada.find((item) => item.ano === 30) ?? null
  const economiaExplainer: React.ReactNode = beneficioAno30 ? (
    <>
      <strong>Economia acumulada em 30 anos:</strong> {formatMoneyBR(beneficioAno30.acumulado)} considerando reajustes
      anuais de energia, desconto contratual e transferência definitiva da usina ao final da vigência.
    </>
  ) : (
    <>Economia crescente ao longo do contrato, com reajustes anuais de energia e desconto SolarInvest aplicados.</>
  )

  const informacoesImportantes = [
    `Tarifa cheia considerada: ${formatTarifaKwh(tarifaCheiaBase)} com desconto de ${descontoInformativo}.`,
    `Geração projetada de ${fmt.kwhMes(geracaoMensalKwh)} com potência instalada de ${fmt.kwp(potenciaInstaladaKwp)}.`,
    `Mensalidade estimada inicial de ${mensalidadeEstimativa}, sujeita a variações anuais de energia.`,
    `Compra antecipada disponível a partir de ${compraAntecipadaTexto}, mediante saldo contratual e aprovação.`,
    `Início estimado da operação: ${inicioOperacaoTexto}.`,
    `Durante toda a vigência, a SolarInvest cuida de operação, manutenção, limpeza e seguro da usina.`,
    `Instalação sem investimento inicial: valor para o cliente de ${formatMoneyBR(valorInstalacaoCliente)}.`,
    `Investimento SolarInvest estimado em ${investimentoSolarinvestFormatado}.`,
    'Projeções sujeitas a atualização por normas ANEEL e validação documental da concessionária.',
  ]

  const itensSistema = (orcamentoItens ?? []).filter((item) => item != null)

  return (
    <div ref={ref} className="print-layout leasing-print-layout">
      <section className="print-cover">
        <div className="print-cover__logo">
          <img src="/logo.svg" alt="SolarInvest" />
        </div>
        <div className="print-cover__identity">
          <span className="print-cover__code">{codigoDocumento}</span>
          <h1>Solução SolarInvest Leasing</h1>
          <p className="print-cover__tagline">{COVER_TAGLINE}</p>
          <div className="print-cover__meta">
            <span>
              <strong>Cliente:</strong> {nomeCliente}
            </span>
            <span>
              <strong>Data:</strong> {emissaoTexto}
            </span>
          </div>
        </div>
      </section>

      <section className="print-section">
        <h2>Detalhamento do Projeto</h2>
        <div className="leasing-summary-grid">
          <div className="leasing-summary-card">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {detalhamentoProjeto.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td className="leasing-table-value">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="leasing-summary-card">
            <h3>Informações do cliente</h3>
            <ClientInfoGrid
              fields={clienteCampos}
              className="print-client-grid"
              fieldClassName="print-client-field"
              wideFieldClassName="print-client-field--wide"
            />
          </div>
        </div>
      </section>

      {composicaoSistema ? (
        <section className="print-section">
          <h2>Composição do sistema</h2>
          <div className="print-composition-groups">
            {composicaoSistema.map((grupo) => (
              <div key={grupo.titulo} className="print-composition-group">
                <h3>{grupo.titulo}</h3>
                {grupo.subgrupos.map((subgrupo) => (
                  <div
                    key={`${grupo.titulo}-${subgrupo.titulo}`}
                    className="print-composition-subgroup"
                  >
                    <h4>{subgrupo.titulo}</h4>
                    <div className="print-composition-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th>Descrição</th>
                            <th>Quantidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subgrupo.itens.map((item) => (
                            <tr key={`${subgrupo.titulo}-${item.key}`}>
                              <td>{item.produto}</td>
                              <td>{item.descricao}</td>
                              <td className="leasing-table-value">{formatQuantidade(item.quantidade)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="print-section">
        <h2>Composição do Sistema</h2>
        {itensSistema.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Valor unitário</th>
                <th>Valor total</th>
              </tr>
            </thead>
            <tbody>
              {itensSistema.map((item, index) => (
                <tr key={`${item.produto}-${index}`}>
                  <td>{item.produto}</td>
                  <td>{item.descricao}</td>
                  <td className="leasing-table-value">
                    {Number.isFinite(item.quantidade)
                      ? formatNumberBRWithOptions(item.quantidade ?? 0, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })
                      : '—'}
                  </td>
                  <td className="leasing-table-value">{formatMoneyBR(item.valorUnitario)}</td>
                  <td className="leasing-table-value">{formatMoneyBR(item.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Composição detalhada disponível na proposta comercial completa.</p>
        )}
      </section>

      <section className="print-section">
        <h2>Condições do contrato</h2>
        <table>
          <thead>
            <tr>
              <th>Condição</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {condicoesContrato.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td className="leasing-table-value">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section print-chart-section">
        <h2>Benefícios e Retorno</h2>
        <p>
          Investimento assumido pela SolarInvest: {investimentoSolarinvestFormatado}. Tarifa cheia da distribuidora:{' '}
          {formatTarifaKwh(tarifaCheiaBase)}. Energia contratada de {fmt.kwhMes(energiaContratadaKwh)} com desconto de
          {` ${descontoInformativo}`}.
        </p>
        <div className="print-chart leasing-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={economiaChartData}
              margin={{ top: 5, right: 12, bottom: 7, left: 6 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                stroke="#0f172a"
                tickFormatter={formatAxisCurrency}
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
                formatter={(value: number) => formatMoneyBR(value)}
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
                  formatter={(value: number) => formatMoneyBR(value)}
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
                    Economia acumulada: {row ? formatMoneyBR(row.acumulado) : '—'}
                  </span>
                  <span className="print-chart-highlights__value" style={{ color: '#0f172a' }}>
                    Economia no ano: {row ? formatMoneyBR(row.economiaAnual) : '—'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="leasing-chart-note">{economiaExplainer}</p>
        <div className="leasing-summary-card">
          <h3>Evolução das mensalidades estimadas</h3>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Tarifa cheia média</th>
                <th>Tarifa com desconto média</th>
                <th>Conta distribuidora</th>
                <th>Mensalidade SolarInvest</th>
              </tr>
            </thead>
            <tbody>
              {mensalidadesPorAno.map((linha) => (
                <tr key={`mensalidade-${linha.ano}`}>
                  <td>{`${linha.ano}º ano`}</td>
                  <td className="leasing-table-value">{formatTarifaKwh(linha.tarifaCheiaAno)}</td>
                  <td className="leasing-table-value">{formatTarifaKwh(linha.tarifaComDesconto)}</td>
                  <td className="leasing-table-value">{formatMoneyBR(linha.contaDistribuidora)}</td>
                  <td className="leasing-table-value">{formatMoneyBR(linha.mensalidade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="print-section print-important">
        <h2>Informações importantes</h2>
        <ul>
          {informacoesImportantes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="print-section print-footer-institutional">
        <h2>Rodapé institucional</h2>
        <div className="print-final-footer__dates">
          <p>
            <strong>Código SolarInvest:</strong> {codigoDocumento}
          </p>
          <p>
            <strong>Data de emissão:</strong> {emissaoTexto}
          </p>
          <p>
            <strong>Validade da proposta:</strong> {validadeTexto} (15 dias corridos)
          </p>
        </div>
        <div className="print-final-footer__signature">
          <div className="signature-line" />
          <span>Assinatura do cliente</span>
        </div>
      </section>

      <div className="print-brand-footer">
        <strong>SolarInvest</strong>
        <span>CNPJ: 60.434.015/0001-90</span>
        <span>{COVER_TAGLINE}</span>
      </div>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
