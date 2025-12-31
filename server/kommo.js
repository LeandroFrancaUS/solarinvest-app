import { randomUUID } from 'node:crypto'

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 10
const KOMMO_LANGUAGE = 'pt'
const LEAD_NAME = 'Pré-análise — Site'
const TAGS_TO_ADD = ['origem:site', 'pre-analise']
const rateLimitStore = new Map()

const parseEnvId = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '')

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().slice(0, 200)
}

const normalizeWhatsapp = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  const cleaned = value.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1)}`
  }
  return cleaned
}

const parsePositiveNumber = (value) => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined
  }
  return parsed
}

const maskEmail = (email) => {
  if (!email) return ''
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const visible = user?.slice(0, 2) ?? ''
  return `${visible}***@${domain}`
}

const maskPhone = (phone) => {
  if (!phone) return ''
  const visible = phone.slice(-4)
  return `***${visible}`
}

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

const isRateLimited = (ip) => {
  const now = Date.now()
  const entries = rateLimitStore.get(ip) ?? []
  const recent = entries.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  rateLimitStore.set(ip, recent)
  return recent.length > RATE_LIMIT_MAX_REQUESTS
}

const buildCustomFieldValue = (fieldId, rawValue) => {
  if (!fieldId || rawValue === undefined || rawValue === null || rawValue === '') {
    return null
  }
  return {
    field_id: fieldId,
    values: [
      {
        value: rawValue,
      },
    ],
  }
}

const contactHasEmail = (contact, email) => {
  if (!email || !contact?.custom_fields_values) return false
  return contact.custom_fields_values.some((field) =>
    Array.isArray(field.values) && field.values.some((item) => normalizeEmail(item.value) === email),
  )
}

const contactHasPhone = (contact, phone) => {
  if (!phone || !contact?.custom_fields_values) return false
  const normalized = phone.replace(/\D+/g, '')
  return contact.custom_fields_values.some((field) =>
    Array.isArray(field.values) &&
    field.values.some((item) => String(item.value ?? '').replace(/\D+/g, '') === normalized),
  )
}

const findExistingContact = async ({ baseUrl, token, email, whatsapp }) => {
  const queryValue = email || whatsapp
  if (!queryValue) {
    return null
  }

  const searchUrl = `${baseUrl}/contacts?query=${encodeURIComponent(queryValue)}`
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Language': KOMMO_LANGUAGE,
    },
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json()
  const contacts = Array.isArray(payload?.data) ? payload.data : []
  if (contacts.length === 0) {
    return null
  }

  const matched = contacts.find((contact) => contactHasEmail(contact, email) || contactHasPhone(contact, whatsapp))
  return matched ?? contacts[0]
}

const sanitizePayload = (raw) => {
  const nomeRazao = normalizeString(raw?.nomeRazao)
  const email = normalizeEmail(raw?.email)
  const whatsapp = normalizeWhatsapp(raw?.whatsapp)
  const municipio = normalizeString(raw?.municipio)
  const tipoImovel = normalizeString(raw?.tipoImovel)
  const tipoSistema = normalizeString(raw?.tipoSistema)
  const consumoMedioMensal = parsePositiveNumber(raw?.consumoMedioMensal)

  const utm = raw?.utm && typeof raw.utm === 'object'
    ? {
        utm_source: normalizeString(raw.utm.utm_source),
        utm_medium: normalizeString(raw.utm.utm_medium),
        utm_campaign: normalizeString(raw.utm.utm_campaign),
        utm_content: normalizeString(raw.utm.utm_content),
      }
    : undefined

  return {
    nomeRazao,
    email,
    whatsapp,
    municipio,
    tipoImovel,
    consumoMedioMensal,
    tipoSistema,
    utm,
  }
}

const validatePayload = (payload) => {
  if (!payload.nomeRazao) return 'Nome ou razão social é obrigatório.'
  if (!payload.email) return 'E-mail é obrigatório.'
  if (!payload.whatsapp) return 'WhatsApp é obrigatório.'
  return null
}

export const handleKommoPreAnaliseRequest = async (req, res, { readJsonBody }) => {
  const method = req.method?.toUpperCase() ?? 'GET'
  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS')
    res.statusCode = 204
    res.end()
    return
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS')
    res.statusCode = 405
    res.end(JSON.stringify({ ok: false, message: 'Método não suportado.' }))
    return
  }

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    res.statusCode = 429
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        ok: false,
        message: 'Muitas solicitações. Tente novamente em alguns minutos.',
      }),
    )
    return
  }

  const requestId = randomUUID()
  const subdomain = normalizeString(process.env.KOMMO_SUBDOMAIN)
  const token = process.env.KOMMO_LONG_LIVED_TOKEN
  const pipelineId = parseEnvId(process.env.KOMMO_PIPELINE_ID)
  const statusId = parseEnvId(process.env.KOMMO_STATUS_ID)

  if (!subdomain || !token || !pipelineId || !statusId) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, message: 'Integração indisponível no momento.' }))
    return
  }

  let rawBody
  try {
    rawBody = await readJsonBody(req)
  } catch (error) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, message: 'JSON inválido na requisição.' }))
    return
  }

  const payload = sanitizePayload(rawBody)
  const validationError = validatePayload(payload)
  if (validationError) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, message: validationError }))
    return
  }

  const baseUrl = `https://${subdomain}.kommo.com/api/v4`
  const contactEmailFieldId = parseEnvId(process.env.KOMMO_CONTACT_EMAIL_FIELD_ID)
  const contactPhoneFieldId = parseEnvId(process.env.KOMMO_CONTACT_PHONE_FIELD_ID)
  const leadMunicipioFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_MUNICIPIO)
  const leadTipoImovelFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_TIPO_IMOVEL)
  const leadConsumoFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_CONSUMO_MEDIO)
  const leadTipoSistemaFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_TIPO_SISTEMA)
  const utmSourceFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_UTM_SOURCE)
  const utmMediumFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_UTM_MEDIUM)
  const utmCampaignFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_UTM_CAMPAIGN)
  const utmContentFieldId = parseEnvId(process.env.KOMMO_LEAD_FIELD_ID_UTM_CONTENT)

  if (!contactEmailFieldId || !contactPhoneFieldId) {
    console.error('[kommo] Campos de contato ausentes ou inválidos', {
      requestId,
      emailFieldConfigured: Boolean(contactEmailFieldId),
      phoneFieldConfigured: Boolean(contactPhoneFieldId),
    })
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, message: 'Integração indisponível no momento.' }))
    return
  }

  let existingContactId = null
  try {
    const existingContact = await findExistingContact({
      baseUrl,
      token,
      email: payload.email,
      whatsapp: payload.whatsapp,
    })
    existingContactId = existingContact?.id ?? null
  } catch (error) {
    console.error('[kommo] Falha ao verificar contatos existentes', {
      requestId,
      error: error?.message,
    })
  }

  const contactCustomFields = [
    buildCustomFieldValue(contactEmailFieldId, payload.email),
    buildCustomFieldValue(contactPhoneFieldId, payload.whatsapp),
  ].filter(Boolean)

  const leadCustomFields = [
    buildCustomFieldValue(leadMunicipioFieldId, payload.municipio),
    buildCustomFieldValue(leadTipoImovelFieldId, payload.tipoImovel),
    buildCustomFieldValue(leadConsumoFieldId, payload.consumoMedioMensal),
    buildCustomFieldValue(leadTipoSistemaFieldId, payload.tipoSistema),
    buildCustomFieldValue(utmSourceFieldId, payload.utm?.utm_source),
    buildCustomFieldValue(utmMediumFieldId, payload.utm?.utm_medium),
    buildCustomFieldValue(utmCampaignFieldId, payload.utm?.utm_campaign),
    buildCustomFieldValue(utmContentFieldId, payload.utm?.utm_content),
  ].filter(Boolean)

  const embeddedContacts = existingContactId
    ? [
        {
          id: existingContactId,
        },
      ]
    : [
        {
          first_name: payload.nomeRazao,
          custom_fields_values: contactCustomFields,
        },
      ]

  const body = [
    {
      name: LEAD_NAME,
      pipeline_id: pipelineId,
      status_id: statusId,
      tags_to_add: TAGS_TO_ADD,
      custom_fields_values: leadCustomFields,
      _embedded: {
        contacts: embeddedContacts,
      },
    },
  ]

  try {
    const response = await fetch(`${baseUrl}/leads/complex`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Language': KOMMO_LANGUAGE,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorDetail = null
      try {
        const responseBody = await response.json()
        errorDetail = responseBody?.title || responseBody?.message || response.statusText
      } catch (error) {
        errorDetail = response.statusText
      }

      console.error('[kommo] Erro ao criar lead de pré-análise', {
        requestId,
        status: response.status,
        email: maskEmail(payload.email),
        whatsapp: maskPhone(payload.whatsapp),
        detail: errorDetail,
      })

      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          ok: false,
          message: 'Não conseguimos enviar sua pré-análise agora. Tente novamente em alguns minutos.',
        }),
      )
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: true }))
  } catch (error) {
    console.error('[kommo] Falha inesperada ao contatar Kommo', {
      requestId,
      email: maskEmail(payload.email),
      whatsapp: maskPhone(payload.whatsapp),
      error: error?.message,
    })

    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        ok: false,
        message: 'Não conseguimos enviar sua pré-análise agora. Tente novamente em alguns minutos.',
      }),
    )
  }
}
