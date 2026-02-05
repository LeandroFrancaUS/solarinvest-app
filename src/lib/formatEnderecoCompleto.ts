export type EnderecoCompletoInput =
  | {
      cep?: string | null
      logradouro?: string | null
      numero?: string | null
      complemento?: string | null
      bairro?: string | null
      cidade?: string | null
      uf?: string | null
    }
  | string
  | null
  | undefined

const normalizeCep = (value?: string | null): string => {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }
  return value?.trim() ?? ''
}

export const formatEnderecoCompleto = (endereco?: EnderecoCompletoInput): string => {
  if (!endereco) {
    return ''
  }
  if (typeof endereco === 'string') {
    return endereco.trim()
  }

  const logradouro = endereco.logradouro?.trim() ?? ''
  const numero = endereco.numero?.trim() ?? ''
  const complemento = endereco.complemento?.trim() ?? ''
  const bairro = endereco.bairro?.trim() ?? ''
  const cidade = endereco.cidade?.trim() ?? ''
  const uf = endereco.uf?.trim() ?? ''
  const cep = normalizeCep(endereco.cep)

  const numeroTexto = numero ? `nº ${numero}` : ''
  const primeiraLinhaBase = [logradouro, numeroTexto].filter(Boolean).join(', ')
  const primeiraLinha = complemento
    ? [primeiraLinhaBase, complemento].filter(Boolean).join(', ')
    : primeiraLinhaBase
  const cidadeUf = [cidade, uf].filter(Boolean).join(' – ')
  const cepTexto = cep ? `CEP ${cep}` : ''

  return [primeiraLinha, bairro, cidadeUf, cepTexto].filter(Boolean).join(', ')
}
