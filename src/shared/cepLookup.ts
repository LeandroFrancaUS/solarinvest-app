export type CepLookupResult = {
  uf?: string
  cidade?: string
  logradouro?: string
  bairro?: string
}

type ViaCepResponse = {
  logradouro?: string
  localidade?: string
  bairro?: string
  uf?: string
  erro?: boolean | string
}

export const lookupCep = async (
  cep: string,
  signal?: AbortSignal,
): Promise<CepLookupResult | null> => {
  const digits = (cep ?? '').replace(/\D/g, '')
  if (digits.length !== 8) {
    return null
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal })
  if (!response.ok) {
    throw new Error('Falha ao consultar CEP.')
  }

  const data: ViaCepResponse = await response.json()
  if (data?.erro) {
    return null
  }

  return {
    uf: data?.uf?.trim().toUpperCase(),
    cidade: data?.localidade?.trim(),
    logradouro: data?.logradouro?.trim(),
    bairro: data?.bairro?.trim(),
  }
}
