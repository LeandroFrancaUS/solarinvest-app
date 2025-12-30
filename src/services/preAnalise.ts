export type PreAnalisePayload = {
  nomeRazao: string
  email: string
  whatsapp: string
  municipio?: string
  tipoImovel?: string
  consumoMedioMensal?: number
  tipoSistema?: string
  utm?: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
  }
}

export type PreAnaliseResponse = {
  ok: boolean
  message?: string
  errorCode?: string
}

const sanitizeString = (value?: string) => value?.trim() ?? ''

export const submitPreAnalise = async (payload: PreAnalisePayload): Promise<PreAnaliseResponse> => {
  const body = {
    ...payload,
    nomeRazao: sanitizeString(payload.nomeRazao),
    email: sanitizeString(payload.email).toLowerCase(),
    whatsapp: sanitizeString(payload.whatsapp),
  }

  const response = await fetch('/api/kommo/pre-analise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }))
  if (!response.ok) {
    return {
      ok: false,
      message: data?.message || 'Não conseguimos enviar sua pré-análise agora. Tente novamente em alguns minutos.',
      errorCode: data?.errorCode,
    }
  }

  return data as PreAnaliseResponse
}
