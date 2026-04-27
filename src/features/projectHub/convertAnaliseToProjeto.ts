import type { Projeto } from './useProjectStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

type Params = {
  analiseFinanceiraResult: AnaliseFinanceiraOutput | null
  tipo: 'venda' | 'leasing'
  clienteNome?: string
}

export function convertAnaliseToProjeto({
  analiseFinanceiraResult,
  tipo,
  clienteNome,
}: Params): Projeto | null {
  if (!analiseFinanceiraResult) return null

  const r = analiseFinanceiraResult

  const valorContrato =
    tipo === 'leasing'
      ? (r.investimento_total_leasing_rs ?? 0)
      : (r.custo_variavel_total_rs ?? 0)

  const custoTotal =
    tipo === 'leasing'
      ? (r.custo_total_rs ?? 0)
      : (r.custo_total_real_rs ?? 0)

  const margem =
    tipo === 'leasing'
      ? (r.lucro_rs ?? 0)
      : (r.margem_rs ?? 0)

  const mensalidade =
    tipo === 'leasing' ? (r.receita_liquida_mensal_rs ?? 0) : undefined

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
    createdAt: new Date().toISOString(),
  }
}
