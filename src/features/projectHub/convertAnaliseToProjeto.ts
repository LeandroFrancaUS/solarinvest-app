import type { Projeto, ComissaoParcela } from './useProjectStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

type Params = {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  tipo: 'venda' | 'leasing'
  clienteNome?: string
  consultorNome?: string
  consultorId?: string
}

export function convertAnaliseToProjeto({
  analiseFinanceiraResult,
  tipo,
  clienteNome,
  consultorNome,
  consultorId,
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
      mensalidade,
    },
    createdAt: new Date().toISOString(),
  }

  if (hasConsultor) {
    projeto.consultor = {
      nome: consultorNome!.trim(),
      ...(consultorId ? { id: consultorId } : {}),
    }

    if (tipo === 'leasing') {
      const valorBase = mensalidade ?? 0
      const parcelas: ComissaoParcela[] = [
        {
          descricao: 'Adiantamento',
          percentual: 40,
          valor: valorBase * 0.4,
          gatilho: 'cliente ativado',
          pago: false,
        },
        {
          descricao: 'Saldo',
          percentual: 60,
          valor: valorBase * 0.6,
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
      const valorBase = valorContrato * 0.05
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
