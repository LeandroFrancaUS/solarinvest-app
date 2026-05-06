import { toNumberFlexible } from '../../lib/locale/br-number'
import type { ClienteDados } from '../../types/printableProposal'
import type { ClienteRegistro, OrcamentoSnapshotData } from '../../types/orcamentoTypes'

export const CLIENTES_CSV_DELIMITER = ';'
export const CLIENTES_CSV_HEADERS: { key: string; label: string }[] = [
  { key: 'id', label: 'id' },
  { key: 'criadoEm', label: 'criado_em' },
  { key: 'atualizadoEm', label: 'atualizado_em' },
  { key: 'nome', label: 'nome' },
  { key: 'apelido', label: 'apelido' },
  { key: 'documento', label: 'documento' },
  { key: 'rg', label: 'rg' },
  { key: 'estadoCivil', label: 'estado_civil' },
  { key: 'nacionalidade', label: 'nacionalidade' },
  { key: 'profissao', label: 'profissao' },
  { key: 'representanteLegal', label: 'representante_legal' },
  { key: 'email', label: 'email' },
  { key: 'telefone', label: 'telefone' },
  { key: 'cep', label: 'cep' },
  { key: 'distribuidora', label: 'distribuidora' },
  { key: 'uc', label: 'uc' },
  { key: 'endereco', label: 'endereco' },
  { key: 'cidade', label: 'cidade' },
  { key: 'uf', label: 'uf' },
  { key: 'temIndicacao', label: 'tem_indicacao' },
  { key: 'indicacaoNome', label: 'indicacao_nome' },
  { key: 'consultorId', label: 'consultor_id' },
  { key: 'consultorNome', label: 'consultor_nome' },
  { key: 'nomeSindico', label: 'nome_sindico' },
  { key: 'cpfSindico', label: 'cpf_sindico' },
  { key: 'contatoSindico', label: 'contato_sindico' },
  { key: 'diaVencimento', label: 'dia_vencimento' },
  { key: 'herdeiros', label: 'herdeiros' },
  { key: 'propostaSnapshot', label: 'proposta_snapshot' },
  // Energy profile fields (imported but stored in client_energy_profile, not ClienteDados)
  { key: 'kwh_contratado', label: 'kwh_contratado' },
  { key: 'potencia_kwp', label: 'potencia_kwp' },
  { key: 'tipo_rede', label: 'tipo_rede' },
  { key: 'tarifa_atual', label: 'tarifa_atual' },
  { key: 'desconto_percentual', label: 'desconto_percentual' },
  { key: 'mensalidade', label: 'mensalidade' },
  { key: 'indicacao', label: 'indicacao' },
  { key: 'modalidade', label: 'modalidade' },
  { key: 'prazo_meses', label: 'prazo_meses' },
]

export const CSV_HEADER_KEY_MAP: Record<string, string> = {
  id: 'id',
  clienteid: 'id',
  criadoem: 'criadoEm',
  criadoemiso: 'criadoEm',
  createdat: 'criadoEm',
  atualizadoem: 'atualizadoEm',
  atualizadoemiso: 'atualizadoEm',
  updatedat: 'atualizadoEm',
  nome: 'nome',
  cliente: 'nome',
  razaosocial: 'nome',
  apelido: 'apelido',
  nickname: 'apelido',
  document: 'documento',
  documento: 'documento',
  cpfcnpj: 'documento',
  cpf_cnpj: 'documento',
  rg: 'rg',
  estadocivil: 'estadoCivil',
  nacionalidade: 'nacionalidade',
  profissao: 'profissao',
  representantelegal: 'representanteLegal',
  email: 'email',
  telefone: 'telefone',
  celular: 'telefone',
  cep: 'cep',
  distribuidora: 'distribuidora',
  uc: 'uc',
  unidadeconsumidora: 'uc',
  endereco: 'endereco',
  logradouro: 'endereco',
  cidade: 'cidade',
  uf: 'uf',
  temindicacao: 'temIndicacao',
  indicacaonome: 'indicacaoNome',
  consultorid: 'consultorId',
  consultor_id: 'consultorId',
  consultornome: 'consultorNome',
  consultor_nome: 'consultorNome',
  consultor: 'consultorNome',
  nomesindico: 'nomeSindico',
  cpfsindico: 'cpfSindico',
  contatosindico: 'contatoSindico',
  diavencimento: 'diaVencimento',
  herdeiros: 'herdeiros',
  propostasnapshot: 'propostaSnapshot',
  proposta: 'propostaSnapshot',
  snapshot: 'propostaSnapshot',
  // Energy profile fields
  kwhcontratado: 'kwh_contratado',
  kwh: 'kwh_contratado',
  consumokwh: 'kwh_contratado',
  consumo: 'kwh_contratado',
  potenciakwp: 'potencia_kwp',
  potencia: 'potencia_kwp',
  kwp: 'potencia_kwp',
  tiporede: 'tipo_rede',
  rede: 'tipo_rede',
  tarifaatual: 'tarifa_atual',
  tarifa: 'tarifa_atual',
  descontopercentual: 'desconto_percentual',
  desconto: 'desconto_percentual',
  mensalidade: 'mensalidade',
  indicacao: 'indicacao',
  origemlead: 'indicacao',
  lead: 'indicacao',
  modalidade: 'modalidade',
  tipocontrato: 'modalidade',
  prazomeses: 'prazo_meses',
  prazo: 'prazo_meses',
  termo: 'prazo_meses',
}

const normalizeCsvHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

const countDelimiterOccurrences = (line: string, delimiter: string): number => {
  let count = 0
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && char === delimiter) {
      count += 1
    }
  }

  return count
}

const detectCsvDelimiter = (line: string): string => {
  const candidates = [CLIENTES_CSV_DELIMITER, ',', '\t']
  let best = candidates[0]!
  let bestCount = -1

  for (const candidate of candidates) {
    const count = countDelimiterOccurrences(line, candidate)
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

const parseBooleanCsvValue = (value: string): boolean =>
  ['1', 'true', 'sim', 'yes', 'y'].includes(value.trim().toLowerCase())

const parseHerdeirosCsvValue = (value: string): string[] => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ['']
  }

  const items = trimmed
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : ['']
}

export const parseClientesCsv = (content: string): unknown[] => {
  const lines = content
    .split(/\r\n|\n|\r/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return []
  }

  const delimiter = detectCsvDelimiter(lines[0]!)
  const headerCells = parseCsvLine(lines[0]!, delimiter).map(normalizeCsvHeader)
  const headerKeys = headerCells.map((header) => CSV_HEADER_KEY_MAP[header] ?? null)
  if (headerKeys.every((key) => !key)) {
    return []
  }

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line, delimiter)
      if (values.every((value) => !value.trim())) {
        return null
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registro: any = {
        dados: {} as Partial<ClienteDados>,
      }

      headerKeys.forEach((key, index) => {
        if (!key) {
          return
        }
        const value = values[index]?.trim() ?? ''
        if (!value) {
          return
        }

        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
        switch (key) {
          case 'id':
            registro.id = value
            break
          case 'criadoEm':
            registro.criadoEm = value
            break
          case 'atualizadoEm':
            registro.atualizadoEm = value
            break
          case 'temIndicacao':
            registro.dados!.temIndicacao = parseBooleanCsvValue(value)
            break
          case 'indicacaoNome':
            registro.dados!.indicacaoNome = value
            break
          case 'diaVencimento':
            registro.dados!.diaVencimento = value
            break
        case 'herdeiros':
          registro.dados!.herdeiros = parseHerdeirosCsvValue(value)
          break
        case 'propostaSnapshot': {
          try {
            const parsedSnapshot = JSON.parse(value)
            if (parsedSnapshot && typeof parsedSnapshot === 'object') {
              registro.propostaSnapshot = parsedSnapshot as OrcamentoSnapshotData
            }
          } catch (error) {
            console.warn('Não foi possível interpretar proposta_snapshot do CSV.', error)
          }
          break
        }
        case 'kwh_contratado':
        case 'potencia_kwp':
        case 'tarifa_atual':
        case 'desconto_percentual':
        case 'mensalidade':
        case 'prazo_meses': {
          const num = toNumberFlexible(value)
          if (Number.isFinite(num)) {
            if (!registro.energyProfile) registro.energyProfile = {}
            registro.energyProfile[key] = num
          }
          break
        }
        case 'tipo_rede':
        case 'indicacao':
        case 'modalidade': {
          if (!registro.energyProfile) registro.energyProfile = {}
          registro.energyProfile[key] = value
          break
        }
        default:

          ;(registro.dados as Record<string, unknown>)[key] = value
      }
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
      })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return registro
    })
    .filter((item): item is Partial<ClienteRegistro> & { dados?: Partial<ClienteDados>; energyProfile?: Record<string, string | number | null> } => Boolean(item))
}

const escapeCsvValue = (value: string, delimiter: string): string => {
  const stringValue = value ?? ''
  if (
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.includes(delimiter)
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export const buildClientesCsv = (registros: ClienteRegistro[]): string => {
  const header = CLIENTES_CSV_HEADERS.map((item) => escapeCsvValue(item.label, CLIENTES_CSV_DELIMITER)).join(
    CLIENTES_CSV_DELIMITER,
  )
  const rows = registros.map((registro) => {
    const dados = registro.dados
    const herdeiros = Array.isArray(dados.herdeiros)
      ? dados.herdeiros.map((item) => item.trim()).filter(Boolean).join(' | ')
      : ''
    const values: Record<string, string> = {
      id: registro.id,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm,
      nome: dados.nome ?? '',
      documento: dados.documento ?? '',
      rg: dados.rg ?? '',
      estadoCivil: dados.estadoCivil ?? '',
      nacionalidade: dados.nacionalidade ?? '',
      profissao: dados.profissao ?? '',
      representanteLegal: dados.representanteLegal ?? '',
      email: dados.email ?? '',
      telefone: dados.telefone ?? '',
      cep: dados.cep ?? '',
      distribuidora: dados.distribuidora ?? '',
      uc: dados.uc ?? '',
      endereco: dados.endereco ?? '',
      cidade: dados.cidade ?? '',
      uf: dados.uf ?? '',
      temIndicacao: dados.temIndicacao ? 'true' : 'false',
      indicacaoNome: dados.indicacaoNome ?? '',
      consultorId: dados.consultorId ?? '',
      consultorNome: dados.consultorNome ?? '',
      nomeSindico: dados.nomeSindico ?? '',
      cpfSindico: dados.cpfSindico ?? '',
      contatoSindico: dados.contatoSindico ?? '',
      diaVencimento: dados.diaVencimento ?? '',
      herdeiros,
      propostaSnapshot: registro.propostaSnapshot
        ? JSON.stringify(registro.propostaSnapshot)
        : '',
    }

    return CLIENTES_CSV_HEADERS.map((item) => escapeCsvValue(values[item.key] ?? '', CLIENTES_CSV_DELIMITER)).join(
      CLIENTES_CSV_DELIMITER,
    )
  })

  return [header, ...rows].join('\n')
}
