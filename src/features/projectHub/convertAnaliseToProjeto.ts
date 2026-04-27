import type { Projeto, ComissaoConsultor } from './useProjectStore'
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

  const hasConsultor = Boolean(consultorNome?.trim())

  const consultor: Projeto['consultor'] = hasConsultor
    ? { nome: consultorNome!.trim(), id: consultorId }
    : undefined

  let comissaoConsultor: ComissaoConsultor | undefined

  if (hasConsultor) {
    if (tipo === 'leasing') {
      const valorBase = mensalidade ?? 0
      comissaoConsultor = {
        regra: 'leasing',
        valorTotalEstimado: valorBase,
        valorPago: 0,
        status: 'adiantamento_disponivel',
        parcelas: [
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
        ],
      }
    } else {
      const valorBase = valorContrato * 0.05
      comissaoConsultor = {
        regra: 'venda',
        valorTotalEstimado: valorBase,
        valorPago: 0,
        status: 'nao_elegivel',
        parcelas: [
          {
            descricao: 'Comissão única',
            percentual: 100,
            valor: valorBase,
            gatilho: 'pagamento do cliente conforme contrato',
            pago: false,
          },
        ],
      }
    }
  }

  return {
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
    ...(consultor ? { consultor } : {}),
    ...(comissaoConsultor ? { comissaoConsultor } : {}),
    createdAt: new Date().toISOString(),
  }
}
