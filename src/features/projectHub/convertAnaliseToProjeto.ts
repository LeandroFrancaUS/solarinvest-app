import type { Projeto, ComissaoParcela, AprovacaoDocumental, AprovacaoViabilidade } from './useProjectStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

type Params = {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  tipo: 'venda' | 'leasing'
  clienteNome?: string
  consultorNome?: string
  consultorId?: string
  pagamentoModalidade?: 'avista' | 'parcelado'
}

const LEASING_ADVANCE_RATE = 0.4
const LEASING_BALANCE_RATE = 0.6
const COMMISSION_RATE_VENDA = 0.05

export function convertAnaliseToProjeto({
  analiseFinanceiraResult,
  tipo,
  clienteNome,
  consultorNome,
  consultorId,
  pagamentoModalidade,
}: Params): Projeto | null {
  if (!analiseFinanceiraResult) return null

  const r = analiseFinanceiraResult

  const valorContrato =
    tipo === 'leasing'
      ? (Number(r.investimento_total_leasing_rs) || 0)
      : (Number(r.custo_variavel_total_rs) || 0)

  const custoTotal =
    tipo === 'leasing'
      ? (Number(r.custo_total_rs) || 0)
      : (Number(r.custo_total_real_rs) || 0)

  const margem =
    tipo === 'leasing'
      ? (Number(r.lucro_rs) || 0)
      : (Number(r.margem_rs) || 0)

  const mensalidade =
    tipo === 'leasing' ? (Number(r.receita_liquida_mensal_rs) || 0) : undefined

  // isParcelado is false when pagamentoModalidade is undefined (unknown modality),
  // which intentionally leaves comprovacaoRenda and analiseCreditoSerasa as optional
  // for venda projects until a payment modality is confirmed.
  const isParcelado = pagamentoModalidade === 'parcelado'

  const aprovacaoDocumental: AprovacaoDocumental =
    tipo === 'leasing'
      ? {
          comprovacaoRenda: { obrigatorio: true, aprovado: false },
          analiseCreditoSerasa: { obrigatorio: true, aprovado: false },
          faturasDistribuidoraSemAtraso: { obrigatorio: true, aprovado: false },
        }
      : {
          comprovacaoRenda: { obrigatorio: isParcelado, aprovado: false },
          analiseCreditoSerasa: { obrigatorio: isParcelado, aprovado: false },
          faturasDistribuidoraSemAtraso: { obrigatorio: true, aprovado: false },
        }

  const aprovacaoViabilidade: AprovacaoViabilidade = {
    areaInstalacaoCompativel: { obrigatorio: true, aprovado: false },
    padraoRelogioAprovadoEngenharia: { obrigatorio: true, aprovado: false },
  }

  const hasConsultor = typeof consultorNome === 'string' && consultorNome.trim().length > 0

  const projeto: Projeto = {
    id: Date.now().toString(),
    tipo,
    status: 'aprovado',
    cliente: {
      nome: clienteNome ?? 'Cliente sem nome',
    },
    financeiro: {
      valorContrato,
      custoTotal,
      margem,
      ...(mensalidade !== undefined ? { mensalidade } : {}),
    },
    createdAt: new Date().toISOString(),
    aprovacaoDocumental,
    aprovacaoViabilidade,
    ...(pagamentoModalidade !== undefined ? { pagamento: { modalidade: pagamentoModalidade } } : {}),
  }

  if (hasConsultor) {
    const nomeTrimmed = consultorNome.trim()
    projeto.consultor = {
      nome: nomeTrimmed,
      ...(consultorId ? { id: consultorId } : {}),
    }

    if (tipo === 'leasing') {
      const valorBase = mensalidade ?? 0
      const parcelas: ComissaoParcela[] = [
        {
          descricao: 'Adiantamento',
          percentual: LEASING_ADVANCE_RATE * 100,
          valor: valorBase * LEASING_ADVANCE_RATE,
          gatilho: 'cliente ativado',
          pago: false,
        },
        {
          descricao: 'Saldo',
          percentual: LEASING_BALANCE_RATE * 100,
          valor: valorBase * LEASING_BALANCE_RATE,
          gatilho: 'primeira mensalidade paga',
          pago: false,
        },
      ]
      projeto.comissaoConsultor = {
        regra: 'leasing',
        valorTotalEstimado: valorBase,
        valorPago: 0,
        status: 'adiantamento_disponivel',
        parcelas,
      }
    } else {
      const valorBase = valorContrato * COMMISSION_RATE_VENDA
      const parcelas: ComissaoParcela[] = [
        {
          descricao: 'Comissão de venda',
          percentual: 100,
          valor: valorBase,
          gatilho: 'pagamento do cliente conforme contrato',
          pago: false,
        },
      ]
      projeto.comissaoConsultor = {
        regra: 'venda',
        valorTotalEstimado: valorBase,
        valorPago: 0,
        status: 'nao_elegivel',
        parcelas,
      }
    }
  }

  return projeto
}
