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

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { ...(signal !== undefined ? { signal } : {}) })
  if (!response.ok) {
    throw new Error('Falha ao consultar CEP.')
  }

  const data = (await response.json() as unknown) as ViaCepResponse
  if (data?.erro) {
    return null
  }

  return {
    ...(data?.uf ? { uf: data.uf.trim().toUpperCase() } : {}),
    ...(data?.localidade ? { cidade: data.localidade.trim() } : {}),
    ...(data?.logradouro ? { logradouro: data.logradouro.trim() } : {}),
    ...(data?.bairro ? { bairro: data.bairro.trim() } : {}),
  }
}
