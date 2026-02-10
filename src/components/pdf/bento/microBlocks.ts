import { formatNumberBRWithOptions } from '../../../lib/locale/br-number'

export enum MicroBlockId {
  MB01 = 'MB01',
  MB02 = 'MB02',
  MB03 = 'MB03',
  MB04 = 'MB04',
  MB05 = 'MB05',
  MB06 = 'MB06',
  MB07 = 'MB07',
  MB08 = 'MB08',
  MB09 = 'MB09',
  MB10 = 'MB10',
  MB11 = 'MB11',
  MB12 = 'MB12',
}

export type MicroBlock = {
  id: MicroBlockId
  title?: string
  body: string
  required: boolean
  showWhen?: (ctx: MicroBlockContext) => boolean
}

export type MicroBlockContext = {
  potenciaKwp?: number | null
  geracaoKwhMes?: number | null
  prazoMeses?: number | null
  showROI: boolean
  showComparativo: boolean
}

const interpolate = (template: string, vars: Record<string, string>) => {
  return template.replace(/{{\s*([\w_]+)\s*}}/g, (_, key) => vars[key] ?? '—')
}

const formatKwpValue = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—'
  return formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatKwhMesValue = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—'
  return formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const formatPrazoMesesValue = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—'
  return formatNumberBRWithOptions(value ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export const buildMicroBlocks = (ctx: MicroBlockContext): MicroBlock[] => {
  const mb10Template =
    '• Potência instalada estimada: {{potencia_kwp}} kWp\n' +
    '• Geração média estimada: {{geracao_kwh_mes}} kWh/mês\n' +
    '• Tipo de sistema: Geração Distribuída – On-grid\n' +
    '• Prazo contratual: {{prazo_meses}} meses\n' +
    '• Investimento inicial do cliente: R$ 0,00'

  const blocks: MicroBlock[] = [
    {
      id: MicroBlockId.MB01,
      title: 'Modelo da Solução',
      body:
        'A SolarInvest oferece uma solução de leasing operacional de sistema fotovoltaico, na qual o investimento, a implantação e a manutenção do sistema são realizados pela própria SolarInvest.\n\n' +
        'O cliente permanece integralmente atendido pela concessionária de energia local e passa a contar com um sistema fotovoltaico instalado em sua unidade consumidora, pagando uma mensalidade pelo uso da infraestrutura, sem qualquer investimento inicial.',
      required: true,
    },
    {
      id: MicroBlockId.MB02,
      title: 'Base da Análise',
      body:
        'As estimativas financeiras desta proposta foram elaboradas com base no histórico de consumo da unidade consumidora, nas tarifas vigentes da concessionária local e em projeções conservadoras de reajuste tarifário.\n\n' +
        'Os cálculos consideram os efeitos econômicos da utilização do sistema fotovoltaico no faturamento da concessionária, conforme as regras aplicáveis à geração distribuída.',
      required: false,
    },
    {
      id: MicroBlockId.MB03,
      body:
        'Estimativa da redução mensal no valor faturado pela concessionária, decorrente da utilização do sistema fotovoltaico instalado, quando comparada ao cenário sem o sistema.',
      required: false,
    },
    {
      id: MicroBlockId.MB04,
      body:
        'Prazo estimado para que a economia acumulada no faturamento de energia elétrica da unidade consumidora supere o valor total investido pela SolarInvest na implantação do sistema fotovoltaico.',
      required: false,
    },
    {
      id: MicroBlockId.MB05,
      body:
        'Indicador financeiro utilizado para mensurar a eficiência econômica do modelo de leasing operacional, calculado com base na economia acumulada estimada ao longo do período contratual.\n\n' +
        'Este indicador não representa rendimento financeiro, retorno de capital ou investimento realizado pelo cliente, sendo utilizado exclusivamente como métrica comparativa de desempenho do modelo.',
      required: true,
      showWhen: (context) => context.showROI,
    },
    {
      id: MicroBlockId.MB06,
      body:
        'Valor estimado da economia acumulada no faturamento de energia elétrica ao longo do período contratual, considerando a utilização do sistema fotovoltaico em comparação ao cenário sem a sua instalação.',
      required: false,
    },
    {
      id: MicroBlockId.MB07,
      body:
        'Comparativo ilustrativo entre o custo estimado de energia elétrica faturado pela concessionária no cenário sem sistema fotovoltaico e o custo combinado da fatura mínima da concessionária com a mensalidade do leasing operacional da SolarInvest.',
      required: true,
      showWhen: (context) => context.showComparativo,
    },
    {
      id: MicroBlockId.MB08,
      body:
        'As modalidades apresentadas diferenciam-se exclusivamente pelo prazo contratual do leasing operacional.\n\n' +
        'Em todas as opções, a SolarInvest permanece responsável pela titularidade do sistema durante a vigência do contrato, não havendo qualquer investimento inicial por parte do cliente.',
      required: false,
    },
    {
      id: MicroBlockId.MB09,
      body:
        'Ao término do prazo contratual, o sistema fotovoltaico poderá ser transferido ao cliente, conforme as condições estabelecidas no contrato definitivo, sem caracterizar comercialização de energia elétrica.',
      required: false,
    },
    {
      id: MicroBlockId.MB10,
      title: 'Resumo Técnico da Solução',
      body: interpolate(mb10Template, {
        potencia_kwp: formatKwpValue(ctx.potenciaKwp),
        geracao_kwh_mes: formatKwhMesValue(ctx.geracaoKwhMes),
        prazo_meses: formatPrazoMesesValue(ctx.prazoMeses),
      }),
      required: true,
    },
    {
      id: MicroBlockId.MB11,
      body:
        'Esta proposta possui caráter estritamente estimativo e não constitui contrato.\n\n' +
        'A SolarInvest não comercializa energia elétrica, permanecendo a concessionária local como única responsável pelo fornecimento, faturamento e relação regulatória com a unidade consumidora.\n\n' +
        'Os valores apresentados estão sujeitos à confirmação por meio de vistoria técnica, viabilidade de instalação e homologação junto à concessionária.',
      required: true,
    },
    {
      id: MicroBlockId.MB12,
      body:
        'A SolarInvest atua na estruturação, implantação e operação de sistemas fotovoltaicos em modelo de leasing operacional, com foco em previsibilidade financeira, conformidade regulatória e redução sustentável de custos para seus clientes.',
      required: false,
    },
  ]

  return blocks.filter((block) => (block.showWhen ? block.showWhen(ctx) : true))
}
