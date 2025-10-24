const CONTACT_PATTERNS = [
  /@/i,
  /\bemail\b/i,
  /\btelefone\b/i,
  /\bwhats?app\b/i,
  /\bru[áa]\b/i,
  /\bavenida\b/i,
  /\bcep\b/i,
  /\bcidade\b/i,
  /\buf\b/i,
  /\bcnpj\b/i,
  /\bcpf\b/i,
  /\bdocumento\b/i,
  /\bcontato\b/i,
  /\bdados do cliente\b/i,
  /\bcliente\b/i,
  /\buc\b/i,
]

const COMMERCIAL_PATTERNS = [
  /proposta comercial/i,
  /detalhes do or[cç]amento/i,
  /condi[cç][aã]o de pagamento/i,
  /entrega/i,
  /validade/i,
  /pot[êe]ncia do sistema/i,
  /projeto/i,
  /estrutura/i,
  /resumo/i,
  /observa[cç][aã]o/i,
]

const FOOTER_PATTERNS = [
  /sustent[áa]vel/i,
  /energia inteligente/i,
  /sem investimento inicial/i,
  /sem desembolso/i,
  /direitos reservados/i,
  /todos os direitos/i,
]

const GENERIC_NOISE_PATTERNS = [
  /valor total/i,
  /total geral/i,
  /aceite/i,
  /assinatura/i,
  /quadros? comercial/i,
  /pagamento/i,
  /fornecedor/i,
  /representante/i,
]

const NOISE_PATTERNS = [
  ...CONTACT_PATTERNS,
  ...COMMERCIAL_PATTERNS,
  ...FOOTER_PATTERNS,
  ...GENERIC_NOISE_PATTERNS,
]

export function hasNoise(text: string): boolean {
  const normalized = text.normalize('NFKC')
  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function sanitizeNoiseText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[•·●▪︎◦]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isHeaderLike(text: string): boolean {
  const normalized = text.toLowerCase()
  const hasProduto = /produto|item|descri[cç][aã]o do produto/.test(normalized)
  const hasQuantidade = /quantidade|qtde|qtd/.test(normalized)
  return hasProduto && hasQuantidade
}

export function isFooterTrigger(text: string): boolean {
  return /valor total|total geral|resumo do investimento|soma dos itens/i.test(text)
}

export function containsBudgetNoiseKeyword(text: string): boolean {
  return hasNoise(text)
}
