import type { ModoPagamento, PagamentoCondicao } from '../lib/finance/roi'

export type PagamentoResumoInfo = {
  label: string
  summary: string
  highlights: string[]
}

const sanitizeHighlights = (items: string[]): string[] =>
  items.map((item) => item.trim()).filter((item) => item.length > 0)

export const PAGAMENTO_CONDICAO_INFO: Record<PagamentoCondicao, PagamentoResumoInfo> = {
  AVISTA: {
    label: 'Pagamento à vista',
    summary: 'Liquidação integral do investimento na assinatura do contrato.',
    highlights: sanitizeHighlights([
      'Integração imediata da receita no fluxo de caixa da SolarInvest.',
      'Pode receber descontos comerciais de acordo com a política vigente.',
    ]),
  },
  PARCELADO: {
    label: 'Cartão de crédito (parcelado)',
    summary: 'Parcelamento via adquirente com controle de juros e MDR.',
    highlights: sanitizeHighlights([
      'Permite distribuir o investimento em parcelas definidas na proposta.',
      'Incidência de juros e MDR configuráveis conforme a operadora do cartão.',
    ]),
  },
  BOLETO: {
    label: 'Boleto bancário',
    summary: 'Cobrança recorrente por boletos com valores iguais.',
    highlights: sanitizeHighlights([
      'Divisão do investimento em boletos programados.',
      'Integração simples com rotinas financeiras tradicionais.',
    ]),
  },
  DEBITO_AUTOMATICO: {
    label: 'Débito automático',
    summary: 'Cobrança mensal debitada automaticamente na conta do cliente.',
    highlights: sanitizeHighlights([
      'Reduz risco de inadimplência com débito recorrente.',
      'Simplifica a conciliação bancária do recebimento.',
    ]),
  },
  FINANCIAMENTO: {
    label: 'Financiamento via bancos parceiros',
    summary: 'Operação estruturada com instituições financeiras parceiras.',
    highlights: sanitizeHighlights([
      'Parcerias com Caixa, Santander, Sicredi, Sicoob, BV Solar e outros bancos.',
      'Sujeito à análise de crédito e condições específicas de cada instituição.',
    ]),
  },
}

export const PAGAMENTO_MODO_INFO: Record<ModoPagamento, PagamentoResumoInfo> = {
  PIX: {
    label: 'Pix e transferência bancária (à vista)',
    summary: 'Liquidação imediata sem incidência de taxas de cartão.',
    highlights: sanitizeHighlights([
      'Sem taxas de cartão.',
      'Liquidez imediata para a SolarInvest.',
      'Ideal para pagamentos à vista ou aportes iniciais em co-investimentos.',
    ]),
  },
  DEBITO: {
    label: 'Cartão de débito (à vista)',
    summary: 'Pagamento em parcela única via cartão de débito.',
    highlights: sanitizeHighlights([
      'Liquidação imediata conforme a operadora do cartão.',
      'Permite configurar a taxa de MDR específica para débito.',
    ]),
  },
  CREDITO: {
    label: 'Cartão de crédito (à vista)',
    summary: 'Pagamento em parcela única no cartão de crédito.',
    highlights: sanitizeHighlights([
      'Liquidação conforme prazo de repasse da adquirente.',
      'Aplicar a taxa de MDR de crédito à vista para compor os encargos.',
    ]),
  },
}

export function getPagamentoCondicaoInfo(
  condicao?: PagamentoCondicao | null,
): PagamentoResumoInfo | null {
  if (!condicao) {
    return null
  }
  return PAGAMENTO_CONDICAO_INFO[condicao] ?? null
}

export function getPagamentoModoInfo(modo?: ModoPagamento | null): PagamentoResumoInfo | null {
  if (!modo) {
    return null
  }
  return PAGAMENTO_MODO_INFO[modo] ?? null
}

export function formatPagamentoLabel(
  condicao?: PagamentoCondicao | null,
  modo?: ModoPagamento | null,
): string {
  if (condicao === 'AVISTA') {
    return getPagamentoModoInfo(modo)?.label ?? PAGAMENTO_CONDICAO_INFO.AVISTA.label
  }
  return getPagamentoCondicaoInfo(condicao)?.label ?? '—'
}

export function formatPagamentoResumo(
  condicao?: PagamentoCondicao | null,
  modo?: ModoPagamento | null,
): { summary: string | null; highlights: string[] } {
  if (condicao === 'AVISTA') {
    const info = getPagamentoModoInfo(modo) ?? PAGAMENTO_CONDICAO_INFO.AVISTA
    return { summary: info.summary, highlights: info.highlights }
  }
  const info = getPagamentoCondicaoInfo(condicao)
  return { summary: info?.summary ?? null, highlights: info?.highlights ?? [] }
}

export function formatCondicaoLabel(condicao?: PagamentoCondicao | null): string {
  return getPagamentoCondicaoInfo(condicao)?.label ?? '—'
}
