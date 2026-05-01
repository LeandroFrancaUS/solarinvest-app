import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import PrintableProposal from '../PrintableProposal'
import { computeROI, type VendaForm } from '../../../lib/finance/roi'
import type { PrintableProposalProps } from '../../../types/printableProposal'
import type { ParsedVendaPdfData } from '../../../lib/pdf/extractVendas'
import { currency } from '../../../utils/formatters'

const anosBase = Array.from({ length: 30 }, (_, index) => index + 1)
const createParsedVenda = (overrides: Partial<ParsedVendaPdfData> = {}): ParsedVendaPdfData => ({
  capex_total: null,
  potencia_instalada_kwp: null,
  geracao_estimada_kwh_mes: null,
  quantidade_modulos: null,
  potencia_da_placa_wp: null,
  modelo_modulo: null,
  modelo_inversor: null,
  estrutura_fixacao: null,
  estrutura_fixacao_source: null,
  estrutura_utilizada_tipo_warning: null,
  tipo_instalacao: null,
  tarifa_cheia_r_kwh: null,
  consumo_kwh_mes: null,
  geracao_estimada_source: null,
  module_area_m2: undefined,
  ...overrides,
})

const createPrintableProps = (
  overrides: Partial<PrintableProposalProps> = {},
): PrintableProposalProps => ({
  cliente: {
    nome: 'Cliente Teste',
    documento: '000.000.000-00',
    rg: '',
    estadoCivil: '',
    nacionalidade: '',
    profissao: '',
    representanteLegal: '',
    email: 'cliente@teste.com',
    telefone: '(41) 99999-9999',
    cep: '80000-000',
    distribuidora: 'Copel',
    uc: '123456',
    endereco: 'Rua das Flores, 100',
    cidade: 'Curitiba',
    uf: 'PR',
    temIndicacao: false,
    indicacaoNome: '',
    herdeiros: [''],
    nomeSindico: '',
    cpfSindico: '',
    contatoSindico: '',
    diaVencimento: '10',
  },
  budgetId: 'ORC123',
  anos: anosBase,
  leasingROI: Array.from({ length: 30 }, () => 0),
  financiamentoFluxo: Array.from({ length: 30 }, () => 0),
  financiamentoROI: Array.from({ length: 30 }, () => 0),
  mostrarFinanciamento: false,
  tabelaBuyout: [],
  buyoutResumo: {
    vm0: 0,
    cashbackPct: 0,
    depreciacaoPct: 0,
    inadimplenciaPct: 0,
    tributosPct: 0,
    infEnergia: 0,
    ipca: 0,
    custosFixos: 0,
    opex: 0,
    seguro: 0,
    duracao: 0,
  },
  capex: 30000,
  tipoProposta: 'VENDA_DIRETA',
  geracaoMensalKwh: 600,
  potenciaModulo: 550,
  numeroModulos: 12,
  potenciaInstaladaKwp: 6.6,
  tipoInstalacao: 'fibrocimento',
  tipoSistema: 'ON_GRID',
  tipoRede: 'monofasico',
  areaInstalacao: 0,
  descontoContratualPct: 0,
  parcelasLeasing: [],
  leasingValorDeMercadoEstimado: null,
  leasingPrazoContratualMeses: null,
  leasingValorInstalacaoCliente: null,
  leasingDataInicioOperacao: null,
  leasingValorMercadoProjetado: null,
  leasingInflacaoEnergiaAa: null,
  distribuidoraTarifa: 'Copel',
  energiaContratadaKwh: 600,
  tarifaCheia: 0.95,
  vendaResumo: undefined,
  parsedPdfVenda: undefined,
  orcamentoItens: [],
  ...overrides,
})

describe('PrintableProposal (venda direta)', () => {
  it('exibe UC geradora e lista beneficiárias quando presentes', () => {
    const props = createPrintableProps({
      ucGeradora: {
        numero: '998877',
        endereco: 'Rua Solar, 123 • Bairro Centro • Curitiba / PR • CEP 80000-000',
      },
      ucsBeneficiarias: [
        {
          numero: '112233',
          endereco: 'Rua das Palmeiras, 50 — Curitiba / PR',
          rateioPercentual: 50,
        },
        {
          numero: '445566',
          endereco: 'Av. Brasil, 99 — Curitiba / PR',
        },
      ],
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('UC Geradora')
    expect(markup).toContain('UC nº 998877 — Rua Solar, 123 • Bairro Centro • Curitiba / PR • CEP 80000-000')
    expect(markup).toContain('UCs Beneficiárias')
    expect(markup).toContain('UC nº 112233 — Rua das Palmeiras, 50 — Curitiba / PR — Rateio: 50%')
    expect(markup).toContain('UC nº 445566 — Av. Brasil, 99 — Curitiba / PR')
  })

  it('usa o custo final projetado do orçamento automático no valor final da proposta', () => {
    const custoFinal = 12345.67
    const props = createPrintableProps({
      orcamentoModo: 'auto',
      orcamentoAutoCustoFinal: custoFinal,
      capex: 0,
      valorTotalProposta: null,
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain(currency(custoFinal))
  })

  it('não exibe seção de beneficiárias quando nenhuma UC extra for fornecida', () => {
    const props = createPrintableProps({
      ucGeradora: {
        numero: '778899',
        endereco: 'Av. Industrial, 1000 — Londrina / PR',
      },
      ucsBeneficiarias: [],
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('UC Geradora')
    expect(markup).not.toContain('UCs Beneficiárias')
  })

  it('remove tags e URLs de campos textuais antes de exibir', () => {
    const props = createPrintableProps({
      vendasConfigSnapshot: {
        observacao_padrao_proposta:
          '<p>Observação <strong>importante</strong> https://app.solarinvest.info/</p>',
        validade_proposta_dias: 15,
        exibir_precos_unitarios: false,
        exibir_margem: false,
        exibir_comissao: false,
        exibir_impostos: false,
        mostrar_quebra_impostos_no_pdf_cliente: false,
      },
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('Observação importante')
    expect(markup).not.toContain('https://app.solarinvest.info/')
    expect(markup).not.toContain('<p>Observação <strong>importante</strong>')
    expect(markup).not.toContain('<strong>importante</strong>')
  })

  it('remove URLs e tags HTML em propostas de leasing', () => {
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      configuracaoUsinaObservacoes: '<div>Observações com link https://app.solarinvest.info/</div>',
      informacoesImportantesObservacao: '<span>Observação <em>adicional</em></span>',
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('Observações com link')
    expect(markup).toContain('Observação adicional')
    expect(markup).not.toContain('https://app.solarinvest.info/')
    expect(markup).not.toContain('<div>Observações com link https://app.solarinvest.info/</div>')
    expect(markup).not.toContain('<span>Observação <em>adicional</em></span>')
    expect(markup).not.toContain('<em>')
  })

  it('exibe potência dos módulos a partir do catálogo e autonomia formatada', () => {
    const vendaForm: VendaForm = {
      consumo_kwh_mes: 500,
      tarifa_cheia_r_kwh: 1,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 50,
      horizonte_meses: 360,
      capex_total: 28000,
      condicao: 'AVISTA',
      modo_pagamento: 'PIX',
      taxa_mdr_pix_pct: 1.5,
      taxa_mdr_debito_pct: 0,
      taxa_mdr_credito_vista_pct: 0,
      taxa_mdr_credito_parcelado_pct: 0,
      entrada_financiamento: 0,
      geracao_estimada_kwh_mes: 600,
      tarifa_r_kwh: 1,
      taxa_minima_r_mes: 50,
      n_parcelas: undefined,
      juros_cartao_aa_pct: undefined,
      juros_cartao_am_pct: undefined,
      n_parcelas_fin: undefined,
      juros_fin_aa_pct: undefined,
      juros_fin_am_pct: undefined,
      taxa_desconto_aa_pct: 8,
      quantidade_modulos: 12,
      potencia_instalada_kwp: 6.6,
      modelo_modulo: undefined,
      modelo_inversor: undefined,
      estrutura_suporte: undefined,
      numero_orcamento_vendor: undefined,
    }

    const retorno = computeROI(vendaForm)
    const props = createPrintableProps({
      numeroModulos: 12,
      energiaContratadaKwh: 500,
      vendaResumo: { form: vendaForm, retorno },
      parsedPdfVenda: createParsedVenda({ potencia_da_placa_wp: 610 }),
      tarifaCheia: vendaForm.tarifa_cheia_r_kwh,
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toMatch(/Potência dos módulos<\/td>\s*<td>610 Wp<\/td>/)
    expect(markup).toMatch(/Energia solicitada \(kWh\/mês\)<\/td>\s*<td>500 kWh\/mês<\/td>/)
    expect(markup).toMatch(/Tarifa atual \(distribuidora\)<\/td>\s*<td>R\$\s*1,000<\/td>/)
    expect(markup).not.toMatch(/Inversores<\/td>\s*<td>—<\/td>/)
    expect(markup).not.toMatch(/Área mínima necessária/)
    expect(markup).toMatch(/Autonomia \(%\)<\/td>\s*<td>120,0%<\/td>/)
    expect(markup).toContain('Valores da proposta')
    expect(markup).toContain(
      'O valor total da proposta representa o preço final de compra da usina, incluindo equipamentos, instalação, documentação, garantia e suporte técnico.',
    )
    expect(markup).not.toMatch(/Total do contrato/)
    expect(markup).toMatch(/<span>VPL<\/span>\s*<strong>/)
  })

  it('omite detalhes da modalidade e usa validade padrão de 3 dias para pagamento à vista', () => {
    const vendaForm: VendaForm = {
      consumo_kwh_mes: 500,
      tarifa_cheia_r_kwh: 1,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 50,
      horizonte_meses: 360,
      capex_total: 28000,
      condicao: 'AVISTA',
      modo_pagamento: 'PIX',
      taxa_mdr_pix_pct: 1.5,
      taxa_mdr_debito_pct: 0,
      taxa_mdr_credito_vista_pct: 0,
      taxa_mdr_credito_parcelado_pct: 0,
      entrada_financiamento: 0,
      geracao_estimada_kwh_mes: 600,
      tarifa_r_kwh: 1,
      taxa_minima_r_mes: 50,
      n_parcelas: undefined,
      juros_cartao_aa_pct: undefined,
      juros_cartao_am_pct: undefined,
      n_parcelas_fin: undefined,
      juros_fin_aa_pct: undefined,
      juros_fin_am_pct: undefined,
      taxa_desconto_aa_pct: 8,
      quantidade_modulos: 12,
      potencia_instalada_kwp: 6.6,
      modelo_modulo: undefined,
      modelo_inversor: undefined,
      estrutura_suporte: undefined,
      numero_orcamento_vendor: undefined,
    }

    const retorno = computeROI(vendaForm)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    try {
      const props = createPrintableProps({
        numeroModulos: 12,
        energiaContratadaKwh: 500,
        vendaResumo: { form: vendaForm, retorno },
        parsedPdfVenda: createParsedVenda({ potencia_da_placa_wp: 610 }),
        tarifaCheia: vendaForm.tarifa_cheia_r_kwh,
      })

      const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

      expect(markup).not.toContain('Modalidade comercial')
      expect(markup).not.toContain('Resumo da modalidade')
      expect(markup).not.toContain('Destaques da modalidade')
      expect(markup).toContain('3 dias corridos')
    } finally {
      vi.useRealTimers()
    }
  })

  it('mostra potência dos módulos como indisponível quando não há dados e oculta VPL sem desconto', () => {
    const vendaForm: VendaForm = {
      consumo_kwh_mes: 0,
      tarifa_cheia_r_kwh: 0.95,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 60,
      horizonte_meses: 360,
      capex_total: 18000,
      condicao: 'PARCELADO',
      modo_pagamento: 'CREDITO',
      taxa_mdr_pix_pct: 0,
      taxa_mdr_debito_pct: 0,
      taxa_mdr_credito_vista_pct: 0,
      taxa_mdr_credito_parcelado_pct: 2,
      n_parcelas: 12,
      juros_cartao_aa_pct: undefined,
      juros_cartao_am_pct: 1.8,
      n_parcelas_fin: undefined,
      juros_fin_aa_pct: undefined,
      juros_fin_am_pct: undefined,
      entrada_financiamento: 0,
      taxa_desconto_aa_pct: undefined,
      geracao_estimada_kwh_mes: 550,
      tarifa_r_kwh: 0.95,
      taxa_minima_r_mes: 60,
      quantidade_modulos: 10,
      potencia_instalada_kwp: 5.5,
      modelo_modulo: undefined,
      modelo_inversor: undefined,
      estrutura_suporte: undefined,
      numero_orcamento_vendor: undefined,
    }

    const retorno = computeROI(vendaForm)
    const props = createPrintableProps({
      numeroModulos: 10,
      energiaContratadaKwh: 0,
      vendaResumo: { form: vendaForm, retorno },
      parsedPdfVenda: createParsedVenda({ potencia_da_placa_wp: null }),
      potenciaModulo: 0,
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    const parcelaEsperada = retorno.pagamentoMensal[0]
    const parcelasDescricaoEsperada = `12 parcelas de ${currency(parcelaEsperada)}`

    expect(markup).not.toContain('Potência dos módulos')
    expect(markup).not.toContain('Energia solicitada (kWh/mês)')
    expect(markup).not.toContain('Autonomia (%)')
    expect(markup).toContain('Retorno Financeiro')
    expect(markup).not.toMatch(/<span>VPL<\/span>/)
    expect(markup).not.toContain('A geração real pode variar')
    expect(markup).toContain('O desempenho real pode variar')
    expect(markup).toContain(parcelasDescricaoEsperada)
  })

  it('renderiza observações da configuração quando informadas', () => {
    const props = createPrintableProps({
      configuracaoUsinaObservacoes: 'Observação linha 1\n\nObservação linha 2',
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('Observações sobre a configuração')
    expect(markup).toContain('Observação linha 1')
    expect(markup).toContain('Observação linha 2')
  })

  it('não renderiza a tabela de itens do orçamento', () => {
    const props = createPrintableProps({
      orcamentoItens: [
        {
          produto: 'Módulo Solar 550W',
          descricao: 'Módulo monocristalino',
          codigo: 'MOD-550',
          modelo: 'XYZ-550',
          fabricante: 'Fabricante Solar',
          quantidade: 12,
        },
      ],
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).not.toContain('Itens do orçamento')
    expect(markup).not.toContain('<th>Produto</th>')
    expect(markup).not.toContain('Módulo Solar 550W')
  })
})


describe('PrintableProposal (leasing)', () => {
  it('exibe UC geradora e beneficiárias para propostas de leasing', () => {
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      ucGeradora: {
        numero: '554433',
        endereco: 'Rodovia Solar, Km 10 — Maringá / PR',
      },
      ucsBeneficiarias: [
        {
          numero: '667788',
          endereco: 'Rua do Sol, 101 — Maringá / PR',
          rateioPercentual: 33.5,
        },
      ],
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('UC Geradora')
    expect(markup).toContain('UC nº 554433 — Rodovia Solar, Km 10 — Maringá / PR')
    expect(markup).toContain('UCs Beneficiárias')
    expect(markup).toContain('UC nº 667788 — Rua do Sol, 101 — Maringá / PR — Rateio: 33,5%')
  })

  it('renderiza seções exclusivas de leasing com economia projetada', () => {
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      descontoContratualPct: 12,
      tarifaCheia: 0.78,
      energiaContratadaKwh: 520,
      geracaoMensalKwh: 540,
      numeroModulos: 14,
      potenciaModulo: 550,
      potenciaInstaladaKwp: 7.7,
      areaInstalacao: 42,
      capex: 48000,
      leasingValorDeMercadoEstimado: 48000,
      leasingROI: Array.from({ length: 30 }, (_, index) => (index + 1) * 1200),
      parcelasLeasing: [
        {
          mes: 1,
          tarifaCheia: 0.78,
          tarifaDescontada: 0.6864,
          mensalidadeCheia: 450,
          tusd: 0,
          mensalidade: 357.75,
          totalAcumulado: 357.75,
        },
        {
          mes: 12,
          tarifaCheia: 0.78,
          tarifaDescontada: 0.6864,
          mensalidadeCheia: 450,
          tusd: 0,
          mensalidade: 357.75,
          totalAcumulado: 4293,
        },
        {
          mes: 60,
          tarifaCheia: 1.22,
          tarifaDescontada: 1.0736,
          mensalidadeCheia: 702,
          tusd: 0,
          mensalidade: 558.27,
          totalAcumulado: 28000,
        },
      ],
      leasingPrazoContratualMeses: 60,
      leasingValorInstalacaoCliente: 0,
      leasingDataInicioOperacao: '01/09/2024',
      leasingValorMercadoProjetado: 120000,
      leasingInflacaoEnergiaAa: 8,
      buyoutResumo: {
        vm0: 120000,
        cashbackPct: 0,
        depreciacaoPct: 5,
        inadimplenciaPct: 2,
        tributosPct: 4,
        infEnergia: 8,
        ipca: 4,
        custosFixos: 0,
        opex: 0,
        seguro: 0,
        duracao: 60,
      },
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('🌞 SUA PROPOSTA PERSONALIZADA DE ENERGIA SOLAR')
    expect(markup).toContain('Resumo da Proposta')
    expect(markup).toContain('investimento total pela SolarInvest')
    expect(markup).toContain('Investimento no sistema')
    expect(markup).toContain('R$\u00a084.000,00')
    expect(markup).toContain('Informações Importantes')
    expect(markup).toContain('Benefício acumulado (R$)')
  })

  it('exibe mensalidades para todos os anos configurados no prazo do leasing', () => {
    const prazoAnos = 10
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      leasingPrazoContratualMeses: prazoAnos * 12,
      leasingInflacaoEnergiaAa: 6,
      descontoContratualPct: 15,
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    const linhasAno = markup.match(/<td>\d+º ano<\/td>/g) ?? []
    expect(linhasAno.length).toBe(prazoAnos + 1)
    expect(markup).toContain('<td>10º ano</td>')
  })

  it('separa os encargos da distribuidora da mensalidade SolarInvest quando disponível', () => {
    const tusdMensal = 50
    const energiaContratada = 500
    const desconto = 10

    const parcelas = Array.from({ length: 24 }, (_, index) => ({
      mes: index + 1,
      tarifaCheia: 1,
      tarifaDescontada: 0.9,
      mensalidadeCheia: 0,
      tusd: tusdMensal,
      mensalidade: 0,
      totalAcumulado: 0,
    }))

    const custosFixosContaEnergia = 40
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      energiaContratadaKwh: energiaContratada,
      tarifaCheia: 1,
      descontoContratualPct: desconto,
      leasingInflacaoEnergiaAa: 0,
      leasingPrazoContratualMeses: 24,
      parcelasLeasing: parcelas,
      vendaSnapshot: {
        cliente: createPrintableProps().cliente,
        parametros: {
          consumo_kwh_mes: 0,
          tarifa_r_kwh: 0,
          inflacao_energia_aa: 0,
          taxa_minima_rs_mes: custosFixosContaEnergia,
          taxa_desconto_aa: 0,
          horizonte_meses: 0,
          uf: 'PR',
          distribuidora: 'Copel',
          irradiacao_kwhm2_dia: 0,
          aplica_taxa_minima: true,
        },
        configuracao: {
          potencia_modulo_wp: 0,
          n_modulos: 0,
          potencia_sistema_kwp: 0,
          geracao_estimada_kwh_mes: 0,
          area_m2: 0,
          tipo_instalacao: '',
          segmento: '',
          modelo_modulo: '',
          modelo_inversor: '',
          estrutura_suporte: '',
          tipo_sistema: 'ON_GRID',
        },
        orcamento: {
          itens: [],
          valor_total_orcamento: 0,
        },
        composicao: {
          capex_base: 0,
          margem_operacional_valor: 0,
          venda_total: 0,
          venda_liquida: 0,
          comissao_liquida_valor: 0,
          imposto_retido_valor: 0,
          impostos_regime_valor: 0,
          impostos_totais_valor: 0,
          capex_total: 0,
          total_contrato_R$: 0,
          regime_breakdown: [],
          preco_minimo: 0,
          venda_total_sem_guardrails: 0,
          preco_minimo_aplicado: false,
          arredondamento_aplicado: 0,
          desconto_percentual: 0,
          desconto_requer_aprovacao: false,
          descontos: 0,
        },
        pagamento: {
          forma_pagamento: '',
          moeda: '',
          mdr_pix: 0,
          mdr_debito: 0,
          mdr_credito_avista: 0,
          validade_proposta_txt: '',
          prazo_execucao_txt: '',
          condicoes_adicionais_txt: '',
        },
        codigos: {
          codigo_orcamento_interno: '',
          data_emissao: '',
        },
        resultados: {
          payback_meses: null,
          roi_acumulado_30a: null,
          autonomia_frac: null,
          energia_contratada_kwh_mes: null,
        },
        resumoProposta: {
          modo_venda: 'leasing',
          valor_total_proposta: null,
          custo_implantacao_referencia: null,
          economia_estimativa_valor: null,
          economia_estimativa_horizonte_anos: null,
        },
      },
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)
    const linhaPrimeiroAno = markup.match(/<td>1º ano<\/td>(.*?)<\/tr>/s)?.[1] ?? ''

    const mensalidadeSolarInvest = energiaContratada * (1 - desconto / 100)
    const mensalidadeDistribuidora = energiaContratada * 1 + custosFixosContaEnergia
    const despesaTotal = mensalidadeSolarInvest + tusdMensal + custosFixosContaEnergia

    expect(linhaPrimeiroAno).toContain(currency(mensalidadeSolarInvest))
    expect(linhaPrimeiroAno).toContain(currency(mensalidadeDistribuidora))
    expect(linhaPrimeiroAno).not.toContain(currency(tusdMensal))
    expect(markup).toContain('Despesa Mensal Estimada (Energia + Encargos)')
    expect(markup).toContain('Referência: 1º ano')
    expect(markup).toContain(currency(despesaTotal))
    expect(markup).toContain(currency(tusdMensal + custosFixosContaEnergia))
  })

  it('prioriza os modelos informados manualmente na configuração da usina', () => {
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      leasingModeloInversor: 'Inversor Manual X',
      leasingModeloModulo: 'Modulo Manual Y',
      orcamentoItens: [
        {
          produto: 'Inversor Catálogo',
          descricao: 'Linha premium',
          modelo: 'INV-2000',
          fabricante: 'Fabricante A',
          quantidade: 1,
        },
        {
          produto: 'Módulo Catálogo',
          descricao: 'Alta eficiência',
          modelo: 'MOD-450',
          fabricante: 'Fabricante B',
          quantidade: 12,
        },
      ],
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toContain('Inversor Manual X')
    expect(markup).toContain('Modulo Manual Y')
  })

  it('exibe as observações da configuração antes das informações importantes', () => {
    const props = createPrintableProps({
      tipoProposta: 'LEASING',
      configuracaoUsinaObservacoes: 'Detalhes técnicos adicionais',
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    const observacoesIndex = markup.indexOf('Observações')
    const informacoesIndex = markup.indexOf('Informações Importantes')

    expect(observacoesIndex).toBeGreaterThan(-1)
    expect(informacoesIndex).toBeGreaterThan(-1)
    expect(observacoesIndex).toBeLessThan(informacoesIndex)
    expect(markup).toContain('Detalhes técnicos adicionais')
  })
})
