import React, { useId, useState, useMemo, useCallback } from 'react'
import type { ClienteDados } from '../types/printableProposal'
import type { ConsultantEntry } from '../lib/api/clientsApi'
import type { ConsultantPickerEntry } from '../services/personnelApi'
import { consultorDisplayName } from '../services/personnelApi'
import { formatWhatsappPhoneNumber } from '../utils/phoneUtils'
import { formatCep } from '../utils/formatters'
import { formatNumberBR, formatMoneyBR, formatNumberBRWithOptions } from '../lib/locale/br-number'
import { Field } from '../components/ui/Field'
import { labelWithTooltip } from '../components/InfoTooltip'
import type { TipoRede } from '../shared/rede'

// ---------------------------------------------------------------------------
// Local types — structural equivalents of App.tsx types, no import from App.tsx
// ---------------------------------------------------------------------------

type ClienteSnapshotData = {
  tarifaCheia?: number
  desconto?: number
  tipoRede?: string
  ucBeneficiarias?: ReadonlyArray<{ numero?: string | null }>
}

type ClienteRegistro = {
  id: string
  criadoEm: string
  atualizadoEm: string
  dados: ClienteDados
  propostaSnapshot?: ClienteSnapshotData
  consumption_kwh_month?: number | null
  system_kwp?: number | null
  term_months?: number | null
  /** Display name of the user who owns this client record (server-loaded, privileged views only) */
  ownerName?: string
  /** Email of the user who owns this client record (server-loaded, privileged views only) */
  ownerEmail?: string
  /** Stack user id of the owner (server-loaded, privileged views only) */
  ownerUserId?: string
  /**
   * Stack user ID of the user who created the record (created_by_user_id from DB).
   * Used as the primary key for the consultant filter on the Gestão de Clientes page.
   */
  createdByUserId?: string | null
  /**
   * Soft-delete timestamp from the database (deleted_at).
   * Null/undefined means the record is active. Deleted records must not appear in the table.
   */
  deletedAt?: string | null
  /**
   * Whether this client has been activated in the portfolio (clients.in_portfolio).
   * When true, the "Ativar Cliente" button must be disabled and show a "negócio fechado" icon.
   */
  inPortfolio?: boolean
  /**
   * Timestamp when the client was first activated in the portfolio (clients.portfolio_exported_at).
   */
  clientActivatedAt?: string | null
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const TIPOS_REDE: { value: TipoRede; label: string }[] = [
  { value: 'nenhum', label: 'Não informado' },
  { value: 'monofasico', label: 'Monofásico' },
  { value: 'bifasico', label: 'Bifásico' },
  { value: 'trifasico', label: 'Trifásico' },
]

const formatBudgetDate = (isoString: string) => {
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const sanitizeClientShowcaseValue = (value: unknown): string => {
  if (value == null) return '-'
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const normalized = String(value).trim()
  if (!normalized) return '-'

  const lowered = normalized.toLowerCase()
  const jsonLike =
    (normalized.startsWith('{') && normalized.endsWith('}')) ||
    (normalized.startsWith('[') && normalized.endsWith(']'))
  const htmlLike = normalized.includes('<') || normalized.includes('>')
  const objectLike = lowered.includes('[object')
  const codeLike = lowered.includes('function(') || lowered.includes('=>')

  if (jsonLike || htmlLike || objectLike || codeLike) {
    return '-'
  }

  return normalized
}

const CLIENT_ROW_SUMMARY_FIELDS = new Set([
  'client_name',
  'client_document',
  'client_city_state',
  'consumption_kwh_month',
  'client_phone',
  'consultor',
  'client_address',
])

type ClientesPanelProps = {
  registros: ClienteRegistro[]
  onClose: () => void
  onEditar: (registro: ClienteRegistro) => void
  onExcluir: (registro: ClienteRegistro) => void
  onExportarCarteira?: (registro: ClienteRegistro) => void
  onExportarCsv: () => void
  onExportarJson: () => void
  onImportar: () => void
  onBackupCliente: () => void
  isImportando: boolean
  isGerandoBackupBanco?: boolean
  canBackupBanco?: boolean
  /** When true, shows the "Consultor" column and cross-user description */
  isPrivilegedUser?: boolean
  /** When true, shows the "Negócio fechado" portfolio export button */
  canExportarCarteira?: boolean
  /**
   * All registered consultants from the API (privileged users only).
   * Each entry has `id` (stack_user_id) for filtering and `name` for display.
   */
  allConsultores?: ConsultantEntry[]
  /**
   * Active consultants from the picker API (available to all authenticated users).
   * Used as a fallback lookup source when allConsultores is not yet loaded or
   * does not contain the consultant referenced in a client's metadata.
   */
  formConsultores?: ConsultantPickerEntry[]
}

function ClientesPanel({
  registros,
  onClose,
  onEditar,
  onExcluir,
  onExportarCarteira,
  onExportarCsv,
  onExportarJson,
  onImportar,
  onBackupCliente,
  isImportando,
  isGerandoBackupBanco = false,
  canBackupBanco = false,
  isPrivilegedUser = false,
  canExportarCarteira = false,
  allConsultores = [],
  formConsultores = [],
}: ClientesPanelProps) {
  const panelTitleId = useId()
  const [clienteSearchTerm, setClienteSearchTerm] = useState('')
  // selectedOwner stores the registered consultant id (consultants.id) or 'all'.
  // Using the ID (not the display name) ensures filter correctness even when
  // two consultants share a name or when the name changes.
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [infoClienteId, setInfoClienteId] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<'nome' | 'documento' | 'cidade' | 'consumo' | 'telefone' | 'consultor' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const normalizedSearchTerm = clienteSearchTerm.trim().toLowerCase()
  const consultorById = useMemo(() => {
    const map = new Map<string, ConsultantEntry>()
    // Seed with formConsultores first (lower priority — active consultants only,
    // available to all authenticated users including those without privileged role).
    // This ensures consultant names appear even before allConsultores loads from
    // the API and when client metadata has a stale consultor_nome value.
    formConsultores.forEach((entry) => {
      if (!entry?.id) return
      map.set(String(entry.id), {
        id: String(entry.id),
        name: consultorDisplayName(entry),
        email: entry.email ?? null,
        apelido: entry.apelido?.trim() ?? null,
      })
    })
    // allConsultores (all consultants, privileged users only) overwrites — higher priority.
    allConsultores.forEach((entry) => {
      if (!entry?.id) return
      map.set(String(entry.id), entry)
    })
    return map
  }, [allConsultores, formConsultores])

  // Build the dropdown options list using only registered consultants
  // from Gestão de Usuários/Consultores.
  const ownerOptions = useMemo(() => {
    if (!isPrivilegedUser) return []
    return [...allConsultores].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'),
    )
  }, [isPrivilegedUser, allConsultores])

  // Single source of truth for the visible client list:
  //   1. Removes deleted records and applies the consultant filter.
  //   2. Text search is applied on top of the already-filtered result.
  const registrosFiltrados = useMemo(() => {
    const activeClients = registros.filter((registro) => registro.deletedAt == null)
    const byConsultor =
      selectedOwner === 'all'
        ? activeClients
        : activeClients.filter((registro) => (registro.dados.consultorId ?? '') === selectedOwner)

    if (!normalizedSearchTerm) return byConsultor

    const digitsOnly = normalizedSearchTerm.replace(/\D/g, '')
    return byConsultor.filter((registro) => {
      const { dados } = registro
      const matchNome = dados.nome?.trim().toLowerCase().includes(normalizedSearchTerm) ?? false
      const matchDocumento =
        digitsOnly.length > 0
          ? (dados.documento?.replace(/\D/g, '').includes(digitsOnly) ?? false)
          : false
      const matchEmail = dados.email?.toLowerCase().includes(normalizedSearchTerm) ?? false
      const matchTelefone =
        digitsOnly.length > 0
          ? (dados.telefone?.replace(/\D/g, '').includes(digitsOnly) ?? false)
          : (dados.telefone?.toLowerCase().includes(normalizedSearchTerm) ?? false)
      const matchUc = dados.uc?.toLowerCase().includes(normalizedSearchTerm) ?? false
      const matchCidade = dados.cidade?.trim().toLowerCase().includes(normalizedSearchTerm) ?? false
      const matchUf = dados.uf?.trim().toLowerCase().includes(normalizedSearchTerm) ?? false
      const matchCep =
        digitsOnly.length > 0
          ? (dados.cep?.replace(/\D/g, '').includes(digitsOnly) ?? false)
          : false
      const matchEndereco = dados.endereco?.toLowerCase().includes(normalizedSearchTerm) ?? false
      const matchDistribuidora = dados.distribuidora?.toLowerCase().includes(normalizedSearchTerm) ?? false
      // Allow searching by consultant display name for privileged views
      const consultorId = registro.dados.consultorId ?? ''
      // Fall back to the consultant name stored on the client record itself (consultor_nome in metadata)
      // so the correct name shows immediately while allConsultores is still loading from the API.
      const consultorLabel = (consultorById.get(consultorId)?.name ?? registro.dados.consultorNome?.trim()) || 'Sem consultor'
      const matchOwner = isPrivilegedUser
        ? consultorLabel.toLowerCase().includes(normalizedSearchTerm)
        : false
      return (
        matchNome ||
        matchDocumento ||
        matchEmail ||
        matchTelefone ||
        matchUc ||
        matchCidade ||
        matchUf ||
        matchCep ||
        matchEndereco ||
        matchDistribuidora ||
        matchOwner
      )
    })
  }, [consultorById, isPrivilegedUser, normalizedSearchTerm, registros, selectedOwner])

  // Sort registros filtrados based on selected column and direction
  const registrosOrdenados = useMemo(() => {
    if (!sortColumn) return registrosFiltrados

    return [...registrosFiltrados].sort((a, b) => {
      let compareResult = 0

      if (sortColumn === 'nome') {
        const nomeA = (a.dados.nome ?? '').toLowerCase()
        const nomeB = (b.dados.nome ?? '').toLowerCase()
        compareResult = nomeA.localeCompare(nomeB, 'pt-BR')
      } else if (sortColumn === 'documento') {
        const docA = (a.dados.documento ?? '').replace(/\D/g, '')
        const docB = (b.dados.documento ?? '').replace(/\D/g, '')
        compareResult = docA.localeCompare(docB, 'pt-BR')
      } else if (sortColumn === 'cidade') {
        const cidadeA = (a.dados.cidade ?? '').toLowerCase()
        const cidadeB = (b.dados.cidade ?? '').toLowerCase()
        compareResult = cidadeA.localeCompare(cidadeB, 'pt-BR')
      } else if (sortColumn === 'consumo') {
        const consumoA = a.consumption_kwh_month ?? 0
        const consumoB = b.consumption_kwh_month ?? 0
        compareResult = consumoA - consumoB
      } else if (sortColumn === 'telefone') {
        const telA = (a.dados.telefone ?? '').replace(/\D/g, '')
        const telB = (b.dados.telefone ?? '').replace(/\D/g, '')
        compareResult = telA.localeCompare(telB, 'pt-BR')
      } else if (sortColumn === 'consultor') {
        const consultorIdA = a.dados.consultorId ?? ''
        const consultorIdB = b.dados.consultorId ?? ''
        const nomeA = (consultorById.get(consultorIdA)?.name ?? a.dados.consultorNome ?? 'Sem consultor').toLowerCase()
        const nomeB = (consultorById.get(consultorIdB)?.name ?? b.dados.consultorNome ?? 'Sem consultor').toLowerCase()
        compareResult = nomeA.localeCompare(nomeB, 'pt-BR')
      }

      return sortDirection === 'asc' ? compareResult : -compareResult
    })
  }, [registrosFiltrados, sortColumn, sortDirection, consultorById])

  const toggleSort = useCallback((column: 'nome' | 'documento' | 'cidade' | 'consumo' | 'telefone' | 'consultor') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn, sortDirection])

  // Active records (non-deleted) — used for total count, independent of search/owner filter
  const totalAtivos = useMemo(
    () => registros.filter((r) => r.deletedAt == null).length,
    [registros],
  )
  const totalResultados = registrosOrdenados.length
  // Display name for the currently selected consultant filter (for empty-state messages)
  const selectedOwnerName = useMemo(() => {
    if (selectedOwner === 'all') return null
    return ownerOptions.find((e) => e.id === selectedOwner)?.name ?? null
  }, [selectedOwner, ownerOptions])
  // For privileged views, how many distinct consultants are represented among active records
  const totalConsultores = useMemo(() => {
    if (!isPrivilegedUser) return 0
    return new Set(
      registros
        .filter((r) => r.deletedAt == null)
        // Count a client as having a consultant when either the ID is in the loaded map
        // OR the stored consultorNome is non-empty (covers the "map loading" window).
        .filter((r) =>
          consultorById.has(r.dados.consultorId ?? '') ||
          Boolean(r.dados.consultorNome?.trim()),
        )
        // Use ID when available for accurate deduplication; fall back to name for clients
        // whose consultant hasn't loaded into the map yet.
        .map((r) => r.dados.consultorId || r.dados.consultorNome || ''),
    ).size
  }, [consultorById, isPrivilegedUser, registros])

  return (
    <div className="budget-search-page clients-page" aria-labelledby={panelTitleId}>
      <div className="budget-search-page-header">
        <div>
          <h2 id={panelTitleId}>Gestão de clientes</h2>
          <p>
            {isPrivilegedUser
              ? `Todos os clientes cadastrados no sistema${totalConsultores > 0 ? ` — ${totalConsultores} consultor(es) representados` : ''}.`
              : 'Clientes armazenados localmente neste dispositivo.'}
          </p>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Voltar
        </button>
      </div>
      <div className="budget-search-panels budget-search-panels--single">
        <section className="budget-search-panel clients-panel" aria-label="Registros de clientes salvos">
          <div className="budget-search-header">
            <h4>Registros salvos</h4>
            <div className="clients-panel-actions">
              <button
                type="button"
                className="ghost with-icon"
                onClick={onExportarJson}
                disabled={registros.length === 0}
                title="Exportar clientes salvos para um arquivo JSON"
              >
                <span aria-hidden="true">⬆️</span>
                <span>Exportar JSON</span>
              </button>
              <button
                type="button"
                className="ghost with-icon"
                onClick={onExportarCsv}
                disabled={registros.length === 0}
                title="Exportar clientes salvos para um arquivo CSV"
              >
                <span aria-hidden="true">📄</span>
                <span>Exportar CSV</span>
              </button>
              {canBackupBanco ? (
                <button
                  type="button"
                  className="ghost with-icon"
                  onClick={onBackupCliente}
                  disabled={isGerandoBackupBanco}
                  aria-busy={isGerandoBackupBanco}
                  title="Backup completo de clientes e propostas (baixar ou carregar)"
                >
                  <span aria-hidden="true">🗄️</span>
                  <span>{isGerandoBackupBanco ? 'Processando backup…' : 'Backup de cliente'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ghost with-icon"
                  onClick={onImportar}
                  disabled={isImportando}
                  aria-busy={isImportando}
                  title="Importar clientes a partir de um arquivo JSON ou CSV"
                >
                  <span aria-hidden="true">⬇️</span>
                  <span>{isImportando ? 'Importando…' : 'Importar'}</span>
                </button>
              )}
            </div>
          </div>
          <Field
            label={labelWithTooltip(
              'Pesquisar cliente',
              isPrivilegedUser
                ? 'Filtra os clientes pelo nome, CPF/CNPJ, e-mail, telefone, UC, cidade, UF, CEP, endereço, distribuidora ou nome do consultor responsável.'
                : 'Filtra os clientes pelo nome, CPF/CNPJ, e-mail, telefone, UC, cidade, UF, CEP, endereço ou distribuidora.',
            )}
          >
            <input
              type="search"
              value={clienteSearchTerm}
              onChange={(event) => setClienteSearchTerm(event.target.value)}
              placeholder={isPrivilegedUser ? 'Ex.: Maria Silva, 123.456.789-00, UC-0001 ou João Consultor' : 'Ex.: Maria Silva, 123.456.789-00 ou UC-0001'}
            />
          </Field>
          {isPrivilegedUser ? (
            <div className="owner-filter-row">
              <label htmlFor="clientes-owner-filter">Criador/consultor</label>
              <select
                id="clientes-owner-filter"
                value={selectedOwner}
                onChange={(event) => setSelectedOwner(event.target.value)}
              >
                <option value="all">Todos os consultores</option>
                {ownerOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="budget-search-summary">
            <span>
              {totalAtivos === 0
                ? 'Nenhum cliente salvo até o momento.'
                : `${totalResultados} de ${totalAtivos} cliente(s) exibidos.`}
            </span>
            {(clienteSearchTerm || selectedOwner !== 'all') ? (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setClienteSearchTerm('')
                  setSelectedOwner('all')
                }}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
          {totalAtivos === 0 ? (
            <p className="budget-search-empty">Nenhum cliente foi salvo até o momento.</p>
          ) : registrosOrdenados.length === 0 ? (
            <p className="budget-search-empty">
              {clienteSearchTerm && selectedOwner !== 'all'
                ? `Nenhum cliente encontrado para "${clienteSearchTerm}" no filtro de ${selectedOwnerName ?? 'consultor selecionado'}.`
                : clienteSearchTerm
                  ? `Nenhum cliente encontrado para "${clienteSearchTerm}".`
                  : selectedOwnerName
                    ? `Nenhum cliente encontrado para o consultor "${selectedOwnerName}".`
                    : 'Nenhum cliente encontrado com o filtro selecionado.'}
            </p>
          ) : (
            <div className="budget-search-table clients-table">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          onClick={() => toggleSort('nome')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, textAlign: 'left' }}
                          title="Clique para ordenar por nome"
                        >
                          Cliente {sortColumn === 'nome' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="col-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('documento')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          title="Clique para ordenar por CPF/CNPJ"
                        >
                          CPF/CNPJ {sortColumn === 'documento' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="col-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('cidade')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          title="Clique para ordenar por cidade"
                        >
                          Cidade/UF {sortColumn === 'cidade' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="col-nowrap clients-table-consumo-col">
                        <button
                          type="button"
                          onClick={() => toggleSort('consumo')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          title="Clique para ordenar por consumo"
                        >
                          Consumo (kWh/mês) {sortColumn === 'consumo' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="col-md col-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('telefone')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          title="Clique para ordenar por telefone"
                        >
                          Telefone {sortColumn === 'telefone' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="col-xl col-nowrap">Endereço</th>
                      {isPrivilegedUser ? (
                        <th className="col-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('consultor')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                            title="Clique para ordenar por consultor"
                          >
                            Consultor {sortColumn === 'consultor' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                      ) : null}
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosOrdenados.map((registro) => {
                      const { dados } = registro
                      const nomeCliente = sanitizeClientShowcaseValue(dados.nome)
                      const documentoCliente = sanitizeClientShowcaseValue(dados.documento)
                      const cidade = sanitizeClientShowcaseValue(dados.cidade)
                      const uf = sanitizeClientShowcaseValue(dados.uf)
                      const cidadeUfRaw = [cidade, uf].filter((item) => item && item !== '-').join(' / ')
                      const cidadeUf = sanitizeClientShowcaseValue(cidadeUfRaw)
                      const primaryLine = sanitizeClientShowcaseValue(nomeCliente !== '-' ? nomeCliente : registro.id)
                      const consumoRaw = registro.consumption_kwh_month ?? null
                      const consumoKwh = typeof consumoRaw === 'number' ? consumoRaw : null
                      const consumoLabel =
                        typeof consumoKwh === 'number' && Number.isFinite(consumoKwh)
                          ? formatNumberBR(consumoKwh)
                          : '-'
                      const renderSummaryValue = (value: string) =>
                        value === '-' ? (
                          <span className="clients-empty-value">-</span>
                        ) : (
                          <span>{value}</span>
                        )
                      const tarifaAtual = registro.propostaSnapshot?.tarifaCheia
                      const tarifaLabel =
                        typeof tarifaAtual === 'number' && Number.isFinite(tarifaAtual) && tarifaAtual > 0
                          ? `${formatMoneyBR(tarifaAtual)}/kWh`
                          : null
                      const descontoAtual = registro.propostaSnapshot?.desconto
                      const descontoLabel =
                        typeof descontoAtual === 'number' && Number.isFinite(descontoAtual) && descontoAtual > 0
                          ? `${formatNumberBRWithOptions(descontoAtual, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
                          : null
                      const tipoRede = registro.propostaSnapshot?.tipoRede
                      const tipoRedeLabel =
                        tipoRede && tipoRede !== 'nenhum'
                          ? (TIPOS_REDE.find((item) => item.value === tipoRede)?.label ?? tipoRede)
                          : null
                      const indicacaoLabel = registro.dados.temIndicacao
                        ? (registro.dados.indicacaoNome?.trim() || 'Sim')
                        : null
                      const ucsBeneficiarias = (registro.propostaSnapshot?.ucBeneficiarias ?? [])
                        .map((item) => item.numero?.trim())
                        .filter((item): item is string => Boolean(item))
                      const ucsBeneficiariasLabelRaw = ucsBeneficiarias.length > 0 ? ucsBeneficiarias.join(', ') : null
                      const ucsBeneficiariasLabel =
                        ucsBeneficiariasLabelRaw != null ? sanitizeClientShowcaseValue(ucsBeneficiariasLabelRaw) : null
                      const safePhone = sanitizeClientShowcaseValue(dados.telefone)
                      const safeAddress = sanitizeClientShowcaseValue(dados.endereco)
                      const safeEmail = sanitizeClientShowcaseValue(dados.email)
                      const safeUc = sanitizeClientShowcaseValue(dados.uc)
                      const consultorCadastrado = consultorById.get(registro.dados.consultorId ?? '')
                      // Fall back to the name stored in client metadata while the consultants list loads
                      const storedNome = registro.dados.consultorNome?.trim() || ''
                      const consultorResponsavel = (consultorCadastrado?.name ?? storedNome) || 'Sem consultor'
                      // Short display: apelido when available, otherwise first word of full name (Issue 4).
                      // For the fallback path (no registered consultant found), storedNome is already
                      // the display name produced by consultorDisplayName() — do NOT split it, as splitting
                      // "Sem consultor" would yield the misleading "Sem" label.
                      const consultorApelido = consultorCadastrado
                        ? (consultorCadastrado.apelido?.trim() || consultorCadastrado.name.split(' ')[0] || consultorCadastrado.name)
                        : (storedNome || 'Sem consultor')
                      const whatsappPhone = safePhone !== '-' ? formatWhatsappPhoneNumber(safePhone) : null
                      const whatsappHref = whatsappPhone ? `https://api.whatsapp.com/send?phone=${whatsappPhone}` : null
                      const isInfoOpen = infoClienteId === registro.id
                      const cepFormatado = sanitizeClientShowcaseValue(formatCep(dados.cep))
                      const enderecoCompleto = [safeAddress, cidade, uf, cepFormatado]
                        .filter((item) => item && item !== '-')
                        .join(', ')
                      const detailFields = [
                        tarifaLabel ? { key: 'tarifa', label: 'Tarifa', value: tarifaLabel } : null,
                        tipoRedeLabel ? { key: 'tipo_rede', label: 'Tipo de rede', value: tipoRedeLabel } : null,
                        descontoLabel ? { key: 'desconto', label: 'Desconto', value: descontoLabel } : null,
                        ucsBeneficiariasLabel && ucsBeneficiariasLabel !== '-'
                          ? { key: 'ucs_beneficiarias', label: 'UCs beneficiárias', value: ucsBeneficiariasLabel }
                          : null,
                        indicacaoLabel ? { key: 'indicacao', label: 'Indicação', value: indicacaoLabel } : null,
                        safeUc !== '-' ? { key: 'uc_geradora', label: 'UC', value: safeUc } : null,
                        safeEmail !== '-' ? { key: 'client_email', label: 'E-mail', value: safeEmail } : null,
                        registro.criadoEm ? { key: 'created_at', label: 'Criado em', value: formatBudgetDate(registro.criadoEm) } : null,
                        registro.atualizadoEm
                          ? { key: 'updated_at', label: 'Atualizado em', value: formatBudgetDate(registro.atualizadoEm) }
                          : null,
                        // These are intentionally listed here so future additions
                        // can be centrally excluded when duplicated in summary row.
                        cidadeUf ? { key: 'client_city_state', label: 'Cidade/UF', value: cidadeUf } : null,
                        consumoLabel ? { key: 'consumption_kwh_month', label: 'Consumo', value: consumoLabel } : null,
                        dados.telefone
                          ? { key: 'client_phone', label: 'Telefone', value: dados.telefone, href: whatsappHref }
                          : null,
                        enderecoCompleto ? { key: 'client_address', label: 'Endereço', value: enderecoCompleto } : null,
                        isPrivilegedUser
                          ? { key: 'consultor', label: 'Consultor', value: consultorResponsavel }
                          : null,
                      ].filter(
                        (
                          item,
                        ): item is { key: string; label: string; value: string; href?: string | null; title?: string } =>
                          Boolean(item) && !CLIENT_ROW_SUMMARY_FIELDS.has(item.key),
                      )
                      // Total columns: 6 fixed + 1 if privileged (Consultor) + 1 Ações = 7 or 8
                      const colSpanTotal = isPrivilegedUser ? 8 : 7
                      return (
                        <React.Fragment key={registro.id}>
                          <tr className="clients-data-row">
                            <td data-label="Cliente">
                              <button type="button" className="clients-table-client clients-table-load" onClick={() => onEditar(registro)}>
                                <strong>{primaryLine}</strong>
                              </button>
                            </td>
                            <td data-label="CPF/CNPJ">{renderSummaryValue(documentoCliente)}</td>
                            <td data-label="Cidade/UF">{renderSummaryValue(cidadeUf)}</td>
                            <td className="clients-table-consumo-col" data-label="Consumo">{renderSummaryValue(consumoLabel)}</td>
                            <td className="col-md" data-label="Telefone">
                              {safePhone !== '-' ? (
                                whatsappHref ? (
                                  <a
                                    className="clients-phone-link"
                                    href={whatsappHref}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    title="Abrir conversa no WhatsApp"
                                  >
                                    {safePhone}
                                  </a>
                                ) : (
                                  <span>{safePhone}</span>
                                )
                              ) : (
                                <span className="clients-empty-value">-</span>
                              )}
                            </td>
                            <td className="col-xl" data-label="Endereço">{renderSummaryValue(safeAddress)}</td>
                            {isPrivilegedUser ? (
                              <td data-label="Consultor">
                                <span className="clients-table-owner" title={consultorResponsavel} aria-label={consultorResponsavel}>
                                  {consultorApelido}
                                </span>
                              </td>
                            ) : null}
                            <td data-label="Ações">
                              <div className="clients-table-actions">
                                <button
                                  type="button"
                                  className={`clients-table-action${isInfoOpen ? ' active' : ''}`}
                                  onClick={() => setInfoClienteId(isInfoOpen ? null : registro.id)}
                                  aria-label="Ver informações do cliente"
                                  title="Ver informações do cliente"
                                  aria-expanded={isInfoOpen}
                                  aria-controls={`cliente-info-${registro.id}`}
                                >
                                  <span aria-hidden="true">ℹ️</span>
                                </button>
                                <button
                                  type="button"
                                  className="clients-table-action"
                                  onClick={() => onEditar(registro)}
                                  aria-label="Carregar dados do cliente"
                                  title="Carregar dados do cliente"
                                >
                                  <span aria-hidden="true">📁</span>
                                </button>
                                {canExportarCarteira && onExportarCarteira && (
                                  <button
                                    type="button"
                                    className={`clients-table-action${registro.inPortfolio ? ' activated' : ''}`}
                                    onClick={() => onExportarCarteira(registro)}
                                    disabled={registro.inPortfolio}
                                    aria-label={registro.inPortfolio ? 'Cliente já ativado na carteira' : 'Ativar cliente na carteira'}
                                    title={registro.inPortfolio ? 'Cliente já ativado na carteira' : 'Ativar Cliente'}
                                    style={registro.inPortfolio ? { cursor: 'not-allowed', opacity: 0.45 } : undefined}
                                  >
                                    <span aria-hidden="true">{registro.inPortfolio ? '✅' : '🤝'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="clients-table-action danger"
                                  onClick={() => onExcluir(registro)}
                                  aria-label="Excluir cliente salvo"
                                  title="Excluir cliente salvo"
                                >
                                  <span aria-hidden="true">🗑</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isInfoOpen && (
                            <tr className="clients-info-row">
                              <td
                                className="clients-info-cell"
                                colSpan={colSpanTotal}
                                data-label=""
                                id={`cliente-info-${registro.id}`}
                              >
                                <div className="clients-info-content">
                                  <dl className="clients-info-grid">
                                    {detailFields.map((field) => (
                                      <div key={field.key} className="clients-info-field">
                                        <dt>{field.label}</dt>
                                        <dd title={field.title}>
                                          {field.href ? (
                                            <a className="clients-phone-link" href={field.href} target="_blank" rel="noreferrer noopener">
                                              {field.value}
                                            </a>
                                          ) : (
                                            field.value
                                          )}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export function ClientesPage(props: ClientesPanelProps) {
  return <ClientesPanel {...props} />
}
