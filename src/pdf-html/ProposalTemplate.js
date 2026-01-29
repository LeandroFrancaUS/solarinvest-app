import React from 'react'

import Cover from './blocks/Cover.js'
import Footer from './blocks/Footer.js'
import Header from './blocks/Header.js'
import KeyValue from './blocks/KeyValue.js'
import Notice from './blocks/Notice.js'
import Section from './blocks/Section.js'
import Table from './blocks/Table.js'
import { formatCurrency, formatNumber, formatPercent } from './formatters.js'
import { hasMeaningfulValue } from './utils.js'

const h = React.createElement

const getValue = (value, fallback = null) => (hasMeaningfulValue(value) ? value : fallback)

export const ProposalTemplate = ({ data }) => {
  const logoUrl = data?.logoUrl ?? '/proposal-header-logo.svg'
  const cliente = data?.cliente ?? {}
  const ucGeradora = data?.ucGeradora ?? {}
  const beneficiarias = Array.isArray(data?.ucsBeneficiarias) ? data.ucsBeneficiarias : []
  const tipoProposta = data?.tipoProposta === 'LEASING' ? 'Leasing' : 'Venda Direta'
  const valorTotal = formatCurrency(Number(data?.valorTotalProposta ?? data?.capex ?? 0))
  const potencia = getValue(formatNumber(Number(data?.potenciaInstaladaKwp ?? 0)))
  const geracaoMensal = getValue(formatNumber(Number(data?.geracaoMensalKwh ?? 0)))
  const tarifaCheia = getValue(formatCurrency(Number(data?.tarifaCheia ?? 0)))
  const descontoContratual = getValue(formatPercent(Number(data?.descontoContratualPct ?? 0) / 100))
  const propostaResumo = [
    { label: 'Modalidade', value: tipoProposta },
    { label: 'Potência instalada', value: potencia ? `${potencia} kWp` : null },
    { label: 'Geração média mensal', value: geracaoMensal ? `${geracaoMensal} kWh/mês` : null },
    { label: 'Tarifa vigente', value: tarifaCheia },
    { label: 'Desconto contratual', value: descontoContratual },
  ]
  const dadosCliente = [
    { label: 'Cliente', value: cliente?.nome },
    { label: 'Documento', value: cliente?.documento },
    { label: 'E-mail', value: cliente?.email },
    { label: 'Telefone', value: cliente?.telefone },
    { label: 'Endereço', value: cliente?.endereco },
    {
      label: 'Cidade/UF',
      value: [cliente?.cidade, cliente?.uf].filter(Boolean).join(' / ') || null,
    },
  ]
  const dadosInstalacao = [
    {
      label: 'UC Geradora',
      value: ucGeradora?.numero
        ? `UC nº ${ucGeradora.numero}${ucGeradora.endereco ? ` — ${ucGeradora.endereco}` : ''}`
        : null,
    },
    { label: 'Distribuidora', value: data?.distribuidoraTarifa ?? cliente?.distribuidora },
    { label: 'Endereço da instalação', value: ucGeradora?.endereco },
  ]
  const beneficiariasRows = beneficiarias.map((uc, index) => ({
    label: `UC ${index + 1}`,
    value: `${uc?.numero ?? ''}${uc?.endereco ? ` — ${uc.endereco}` : ''}${
      uc?.rateioPercentual ? ` — Rateio: ${uc.rateioPercentual}%` : ''
    }`,
  }))
  const resumoFinanceiroRows = [
    { label: 'Valor final da proposta', value: valorTotal },
    { label: 'Investimento base', value: formatCurrency(Number(data?.capex ?? 0)) },
    { label: 'Energia contratada', value: getValue(formatNumber(Number(data?.energiaContratadaKwh ?? 0))) },
  ]
  const observacoes = typeof data?.configuracaoUsinaObservacoes === 'string'
    ? data.configuracaoUsinaObservacoes
        .split(/\r?\n\r?\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : []

  return h(
    'div',
    { className: 'proposal-document' },
    h(Cover, {
      clientName: cliente?.nome,
      location: [cliente?.cidade, cliente?.uf].filter(Boolean).join(' / '),
      proposalCode: data?.budgetId,
      subtitle: 'Energia solar sob medida, com apresentação premium.',
      logoUrl,
    }),
    h(
      'div',
      { className: 'proposal-body' },
      h(Header, {
        title: 'Proposta personalizada',
        subtitle: tipoProposta,
        logoUrl,
        meta: [
          { label: 'Código', value: data?.budgetId ?? '—' },
          { label: 'Emissão', value: data?.emissaoTexto ?? data?.emissaoProposta ?? '' },
        ],
      }),
      h(
        'div',
        { className: 'proposal-flow' },
        h(Section, {
          title: 'Resumo executivo',
          subtitle: 'Visão rápida dos principais destaques da sua proposta.',
          rows: propostaResumo,
          children: h(KeyValue, { rows: propostaResumo, columns: 2 }),
        }),
        h(Section, {
          title: 'Identificação do cliente',
          rows: dadosCliente,
          children: h(KeyValue, { rows: dadosCliente, columns: 2 }),
        }),
        h(Section, {
          title: 'Dados da instalação',
          rows: [...dadosInstalacao, ...beneficiariasRows],
          children: h(
            React.Fragment,
            null,
            h(KeyValue, { rows: dadosInstalacao, columns: 2 }),
            beneficiariasRows.length
              ? h(
                  'div',
                  { className: 'beneficiarias' },
                  h('h3', { className: 'section-subtitle no-break-after-title' }, 'UCs Beneficiárias'),
                  h(KeyValue, { rows: beneficiariasRows, columns: 1 }),
                )
              : null,
          ),
        }),
        h(Section, {
          title: 'Resumo financeiro',
          subtitle: 'Valores finais e parâmetros essenciais.',
          rows: resumoFinanceiroRows,
          children: h(KeyValue, { rows: resumoFinanceiroRows, columns: 2 }),
        }),
        h(Section, {
          title: 'Condições gerais',
          rows: ['condicoes'],
          className: 'keep-together',
          children: h(
            'ol',
            { className: 'conditions-list' },
            h('li', null, 'Valores e projeções são estimativas preliminares e podem ser ajustadas na contratação.'),
            h('li', null, 'Cronogramas dependem de vistoria técnica, disponibilidade de materiais e aprovação da distribuidora.'),
            h('li', null, 'Equipamentos possuem certificação INMETRO ou equivalente e seguem normas técnicas vigentes.'),
            h('li', null, 'A geração real pode variar conforme clima, sombreamento e degradação natural dos módulos.'),
          ),
        }),
        observacoes.length
          ? h(Section, {
              title: 'Observações sobre a configuração',
              rows: observacoes,
              children: h(
                'div',
                { className: 'observacoes' },
                observacoes.map((paragraph, index) =>
                  h('p', { key: `obs-${index}` }, paragraph),
                ),
              ),
            })
          : null,
        data?.observacaoPadrao
          ? h(
              Notice,
              { title: 'Observação importante', className: 'keep-together' },
              h('p', null, data.observacaoPadrao),
            )
          : null,
        h(Footer, {
          issuedAt: data?.emissaoTexto ?? data?.emissaoProposta,
          validityText: data?.validadePropostaLabel,
        }),
      ),
    ),
  )
}

export default ProposalTemplate
