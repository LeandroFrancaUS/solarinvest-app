import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import {
  analyzeImportRows,
  type AnalyzedImportRow,
  type SuggestedAction as ImportSuggestedAction,
} from '../../lib/clients/deduplication'
import {
  bulkImport,
  type BulkImportRowInput,
} from '../../lib/api/clientsApi'
import type { BackupDestino } from '../../components/clients/BackupActionModal'
import type { ClienteRegistro } from '../../types/orcamentoTypes'
import type { ClienteDados } from '../../types/printableProposal'
import {
  CLIENTES_STORAGE_KEY,
  isQuotaExceededError,
  persistClientesToLocalStorage,
  cloneClienteDados,
  normalizeClienteRegistros as normalizeClienteRegistrosHelper,
} from './clienteHelpers'
import { parseClientesCsv, buildClientesCsv } from './clienteCsvHelpers'
import { resolveApiUrl } from '../../utils/apiUrl'

interface UseClientImportExportParams {
  adicionarNotificacao: (mensagem: string, tipo: 'success' | 'error' | 'info' | 'warning') => void
  carregarClientesPrioritarios: (options?: { silent?: boolean }) => Promise<ClienteRegistro[]>
  carregarClientesSalvos: () => ClienteRegistro[]
  setClientesSalvos: (registros: ClienteRegistro[]) => void
  getAccessToken: () => Promise<string | null>
  normalizeClienteRegistros: typeof normalizeClienteRegistrosHelper
}

export function useClientImportExport({
  adicionarNotificacao,
  carregarClientesPrioritarios,
  carregarClientesSalvos,
  setClientesSalvos,
  getAccessToken,
  normalizeClienteRegistros,
}: UseClientImportExportParams) {
  const [isImportandoClientes, setIsImportandoClientes] = useState(false)
  const [isGerandoBackupBanco, setIsGerandoBackupBanco] = useState(false)
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false)
  // Bulk import preview state
  const [bulkImportPreviewRows, setBulkImportPreviewRows] = useState<AnalyzedImportRow[]>([])
  const [isBulkImportPreviewOpen, setIsBulkImportPreviewOpen] = useState(false)
  const [bulkImportAutoMerge, setBulkImportAutoMerge] = useState(false)
  const [isBulkImportConfirming, setIsBulkImportConfirming] = useState(false)
  const pendingImportRawRowsRef = useRef<Array<{ energyProfile?: Record<string, string | number | null> }>>([])
  const clientesImportInputRef = useRef<HTMLInputElement | null>(null)
  const backupImportInputRef = useRef<HTMLInputElement | null>(null)

  const downloadClientesArquivo = useCallback((blob: Blob, fileName: string) => {
    if (typeof window === 'undefined') {
      return
    }

    const link = window.document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = fileName
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const buildClientesFileName = useCallback((extensao: string) => {
    const agora = new Date()
    const pad = (value: number) => value.toString().padStart(2, '0')
    return `solarinvest-clientes-${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(
      agora.getDate(),
    )}-${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}.${extensao}`
  }, [])

  const handleExportarClientesJson = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)

    if (registros.length === 0) {
      window.alert('Nenhum cliente salvo para exportar.')
      return
    }

    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        clientes: registros.map((registro) => ({
          ...registro,
          dados: cloneClienteDados(registro.dados),
        })),
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })

      const fileName = buildClientesFileName('json')
      downloadClientesArquivo(blob, fileName)

      adicionarNotificacao('Arquivo de clientes exportado com sucesso.', 'success')
    } catch (error) {
      console.error('Erro ao exportar clientes salvos.', error)
      window.alert('Não foi possível exportar os clientes. Tente novamente.')
    }
  }, [
    adicionarNotificacao,
    buildClientesFileName,
    carregarClientesSalvos,
    downloadClientesArquivo,
    setClientesSalvos,
  ])

  const handleExportarClientesCsv = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)

    if (registros.length === 0) {
      window.alert('Nenhum cliente salvo para exportar.')
      return
    }

    try {
      const csv = buildClientesCsv(registros)
      const blob = new Blob([`\ufeff${csv}`], {
        type: 'text/csv;charset=utf-8',
      })
      const fileName = buildClientesFileName('csv')
      downloadClientesArquivo(blob, fileName)

      adicionarNotificacao('Arquivo CSV exportado com sucesso.', 'success')
    } catch (error) {
      console.error('Erro ao exportar clientes salvos em CSV.', error)
      window.alert('Não foi possível exportar os clientes em CSV. Tente novamente.')
    }
  }, [
    adicionarNotificacao,
    buildClientesFileName,
    carregarClientesSalvos,
    downloadClientesArquivo,
    setClientesSalvos,
  ])

  const handleClientesImportarClick = useCallback(() => {
    if (isImportandoClientes) {
      return
    }

    const input = clientesImportInputRef.current
    if (input) {
      input.click()
    }
  }, [clientesImportInputRef, isImportandoClientes])

  const handleBackupUploadArquivo = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo || typeof window === 'undefined') return

    console.log('[backup-ui] upload start', { fileName: arquivo.name, size: arquivo.size })
    setIsGerandoBackupBanco(true)
    try {
      const texto = await arquivo.text()
      const json = JSON.parse(texto) as unknown
      const token = await getAccessToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
        headers['x-stack-access-token'] = token
      }
      console.log('[backup-ui] upload request-dispatched')
      const response = await fetch(resolveApiUrl('/api/admin/database-backup'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ action: 'import', payload: json }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; importedClients?: number; failedClients?: number; importedProposals?: number; failedProposals?: number }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Falha ao carregar backup.')
      }
      const failed = (payload.failedClients ?? 0) + (payload.failedProposals ?? 0)
      const successMsg = `Backup carregado com sucesso (${payload.importedClients ?? 0} clientes e ${payload.importedProposals ?? 0} propostas).`
      adicionarNotificacao(successMsg, 'success')
      if (failed > 0) {
        adicionarNotificacao(`${failed} registro(s) não puderam ser importados (verifique os logs).`, 'error')
      }
      console.log('[backup-ui] upload success', { importedClients: payload.importedClients, importedProposals: payload.importedProposals, failedClients: payload.failedClients, failedProposals: payload.failedProposals })
    } catch (error) {
      console.error('[backup-ui] upload failed', error)
      adicionarNotificacao(
        error instanceof Error ? error.message : 'Não foi possível carregar o backup selecionado. Verifique o arquivo e tente novamente.',
        'error',
      )
    } finally {
      setIsGerandoBackupBanco(false)
    }
  }, [adicionarNotificacao, getAccessToken])

  const handleBackupBancoDados = useCallback(() => {
    if (typeof window === 'undefined' || isGerandoBackupBanco) return
    console.log('[backup-ui] click')
    setIsBackupModalOpen(true)
  }, [isGerandoBackupBanco])

  const handleBackupModalUpload = useCallback(() => {
    console.log('[backup-ui] upload selected')
    setIsBackupModalOpen(false)
    backupImportInputRef.current?.click()
  }, [backupImportInputRef])

  const handleBackupModalDownload = useCallback(async (destino: BackupDestino) => {
    setIsBackupModalOpen(false)

    const destinoApi: 'platform' | 'cloud' | 'local' =
      destino === 'plataforma' ? 'platform' : destino === 'nuvem' ? 'cloud' : 'local'

    console.log('[backup-ui] download start', { destino: destinoApi })
    setIsGerandoBackupBanco(true)

    try {
      const token = await getAccessToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
        headers['x-stack-access-token'] = token
      }
      console.log('[backup-ui] download request-dispatched')
      const response = await fetch(resolveApiUrl('/api/admin/database-backup'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ action: 'export', destination: destinoApi }),
      })

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean
            error?: string
            fileName?: string
            payload?: unknown
            platformSaved?: boolean
            checksumSha256?: string
          }
        | null

      if (!response.ok || !payload?.ok || !payload.payload) {
        throw new Error(payload?.error ?? 'Falha ao gerar backup.')
      }

      const json = JSON.stringify(payload.payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const fileName = payload.fileName ?? buildClientesFileName('json')

      if (destinoApi === 'local' || destinoApi === 'cloud') {
        console.log('[backup-ui] download-start', { fileName })
        downloadClientesArquivo(blob, fileName)
      }

      if (destinoApi === 'cloud') {
        const file = new File([blob], fileName, { type: 'application/json' })
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          await navigator.share({
            title: 'Backup SolarInvest',
            text: 'Backup do banco de dados SolarInvest',
            files: [file],
          })
        } else {
          adicionarNotificacao('Web Share indisponível neste dispositivo. O arquivo foi baixado localmente.', 'info')
        }
      }

      const destinoLabel =
        destinoApi === 'platform' ? 'plataforma' : destinoApi === 'cloud' ? 'nuvem' : 'dispositivo local'
      const checksumTexto = payload.checksumSha256 ? ` (checksum: ${payload.checksumSha256.slice(0, 12)}...)` : ''
      adicionarNotificacao(`Backup gerado com sucesso para ${destinoLabel}${checksumTexto}.`, 'success')
      console.log('[backup-ui] download success', { checksum: payload.checksumSha256 })

      if (payload.platformSaved) {
        adicionarNotificacao('Cópia adicional registrada na plataforma (Neon).', 'success')
      }
    } catch (error) {
      console.error('[backup-ui] download failed', error)
      adicionarNotificacao(
        error instanceof Error ? error.message : 'Não foi possível gerar o backup do banco. Tente novamente.',
        'error',
      )
    } finally {
      setIsGerandoBackupBanco(false)
    }
  }, [adicionarNotificacao, buildClientesFileName, downloadClientesArquivo, getAccessToken])

  const handleClientesImportarArquivo = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const arquivo = event.target.files?.[0]
      event.target.value = ''

      if (!arquivo || typeof window === 'undefined') {
        return
      }

      setIsImportandoClientes(true)

      try {
        const conteudo = await arquivo.text()
        let lista: unknown[] | null = null
        const isCsvFile =
          arquivo.name.toLowerCase().endsWith('.csv') ||
          arquivo.type.toLowerCase().includes('csv')

        if (isCsvFile) {
          lista = parseClientesCsv(conteudo)
        } else {
          let parsed: unknown
          try {
            parsed = JSON.parse(conteudo)
          } catch (_error) {
            const fallbackCsv = parseClientesCsv(conteudo)
            if (fallbackCsv.length > 0) {
              lista = fallbackCsv
            } else {
              throw new Error('invalid-json')
            }
            parsed = null
          }

          if (parsed) {
            lista = Array.isArray(parsed)
              ? parsed
              : parsed && typeof parsed === 'object' && Array.isArray((parsed as { clientes?: unknown }).clientes)
              ? ((parsed as { clientes?: unknown }).clientes as unknown[])
              : null
          }
        }

        if (!lista || lista.length === 0) {
          window.alert('Nenhum cliente válido foi encontrado no arquivo selecionado.')
          return
        }

        // Build import rows for the preview (including energy profile data)
        type RawImportRow = Partial<ClienteRegistro> & { dados?: Partial<ClienteDados>; energyProfile?: Record<string, string | number | null> }
        const rawRows = lista as RawImportRow[]

        // Map raw rows to ImportRow format for deduplication engine
        const importRows = rawRows.map((r) => ({
          name: (r.dados?.nome ?? (r as unknown as { nome?: string }).nome ?? '').trim(),
          document: r.dados?.documento ?? (r as unknown as { documento?: string }).documento ?? null,
          uc: r.dados?.uc ?? (r as unknown as { uc?: string }).uc ?? null,
          email: r.dados?.email ?? (r as unknown as { email?: string }).email ?? null,
          phone: r.dados?.telefone ?? (r as unknown as { telefone?: string }).telefone ?? null,
          city: r.dados?.cidade ?? (r as unknown as { cidade?: string }).cidade ?? null,
          state: r.dados?.uf ?? (r as unknown as { uf?: string }).uf ?? null,
          address: r.dados?.endereco ?? (r as unknown as { endereco?: string }).endereco ?? null,
          distribuidora: r.dados?.distribuidora ?? (r as unknown as { distribuidora?: string }).distribuidora ?? null,
          kwh_contratado: typeof r.energyProfile?.kwh_contratado === 'number' ? r.energyProfile.kwh_contratado : null,
          potencia_kwp: typeof r.energyProfile?.potencia_kwp === 'number' ? r.energyProfile.potencia_kwp : null,
          tipo_rede: typeof r.energyProfile?.tipo_rede === 'string' ? r.energyProfile.tipo_rede : null,
          tarifa_atual: typeof r.energyProfile?.tarifa_atual === 'number' ? r.energyProfile.tarifa_atual : null,
          desconto_percentual: typeof r.energyProfile?.desconto_percentual === 'number' ? r.energyProfile.desconto_percentual : null,
          mensalidade: typeof r.energyProfile?.mensalidade === 'number' ? r.energyProfile.mensalidade : null,
          indicacao: typeof r.energyProfile?.indicacao === 'string' ? r.energyProfile.indicacao : null,
          modalidade: typeof r.energyProfile?.modalidade === 'string' ? r.energyProfile.modalidade : null,
          prazo_meses: typeof r.energyProfile?.prazo_meses === 'number' ? r.energyProfile.prazo_meses : null,
        }))

        // Filter out rows without a name
        const validImportRows = importRows.filter((r) => r.name.length > 0)

        if (validImportRows.length === 0) {
          window.alert('Nenhum cliente válido foi encontrado no arquivo selecionado.')
          return
        }

        // Keep the raw rows for later use during confirm
        pendingImportRawRowsRef.current = rawRows

        // Run client-side deduplication against existing (localStorage) clients
        const existentes = carregarClientesSalvos()
        const existingSlim = existentes
          .filter((r) => r.deletedAt == null)
          .map((r) => ({
            id: r.id,
            name: r.dados.nome,
            document: r.dados.documento ?? null,
            uc: r.dados.uc ?? null,
            email: r.dados.email ?? null,
            phone: r.dados.telefone ?? null,
            city: r.dados.cidade ?? null,
          }))

        const analyzed = analyzeImportRows(validImportRows, existingSlim)
        setBulkImportPreviewRows(analyzed)
        setIsBulkImportPreviewOpen(true)
      } catch (error) {
        if ((error as Error).message === 'invalid-json') {
          window.alert('O arquivo selecionado está em um formato inválido (JSON ou CSV).')
        } else {
          console.error('Erro ao importar clientes salvos.', error)
          window.alert('Não foi possível importar os clientes. Verifique o arquivo e tente novamente.')
        }
      } finally {
        setIsImportandoClientes(false)
      }
    }, [
      carregarClientesSalvos,
      setIsImportandoClientes,
    ])

  /**
   * Executed when the user confirms the import from the preview modal.
   * If server API is available, uses bulk-import endpoint; otherwise falls back to localStorage.
   */
  const handleBulkImportConfirm = useCallback(async () => {
    const selectedRows = bulkImportPreviewRows.filter((r) => r.selected)
    if (selectedRows.length === 0) return

    setIsBulkImportConfirming(true)

    try {
      // Try server-side import first
      const token = await getAccessToken().catch(() => null)
      if (token) {
        const apiRows: BulkImportRowInput[] = selectedRows.map((r) => {
          const hasEnergyData =
            r.kwh_contratado != null ||
            r.potencia_kwp != null ||
            r.tipo_rede != null ||
            r.tarifa_atual != null ||
            r.desconto_percentual != null ||
            r.mensalidade != null ||
            r.indicacao != null ||
            r.modalidade != null ||
            r.prazo_meses != null
          const row: BulkImportRowInput = {
            name: r.name,
            document: r.document ?? null,
            uc: r.uc ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
            city: r.city ?? null,
            state: r.state ?? null,
            address: r.address ?? null,
            distribuidora: r.distribuidora ?? null,
          }
          if (hasEnergyData) {
            row.energyProfile = {
              ...(r.kwh_contratado != null ? { kwh_contratado: r.kwh_contratado } : {}),
              ...(r.potencia_kwp != null ? { potencia_kwp: r.potencia_kwp } : {}),
              ...(r.tipo_rede != null ? { tipo_rede: r.tipo_rede } : {}),
              ...(r.tarifa_atual != null ? { tarifa_atual: r.tarifa_atual } : {}),
              ...(r.desconto_percentual != null ? { desconto_percentual: r.desconto_percentual } : {}),
              ...(r.mensalidade != null ? { mensalidade: r.mensalidade } : {}),
              ...(r.indicacao != null ? { indicacao: r.indicacao } : {}),
              ...(r.modalidade != null ? { modalidade: r.modalidade } : {}),
              ...(r.prazo_meses != null ? { prazo_meses: r.prazo_meses } : {}),
            }
          }
          return row
        })

        try {
          const result = await bulkImport(apiRows, { autoMerge: bulkImportAutoMerge })
          const { created, merged, skipped, errors } = result.summary
          adicionarNotificacao(
            `Importação concluída: ${created} criado(s), ${merged} mesclado(s), ${skipped} ignorado(s)${errors > 0 ? `, ${errors} erro(s)` : ''}.`,
            errors > 0 ? 'error' : 'success',
          )
          setIsBulkImportPreviewOpen(false)
          // Reload clients from server
          await carregarClientesPrioritarios()
          return
        } catch (serverErr) {
          console.warn('[bulk-import] Server import failed, falling back to localStorage:', serverErr)
          // Fall through to localStorage import
        }
      }

      // Fallback: localStorage import (original behavior)
      const rawRows = pendingImportRawRowsRef.current
      const selectedIndices = new Set(selectedRows.map((r) => r.rowIndex))
      const selectedRaw = rawRows.filter((_, idx) => selectedIndices.has(idx))

      const existentes = carregarClientesSalvos()
      const existingIds = new Set(existentes.map((r) => r.id))
      const { registros: importados } = normalizeClienteRegistros(selectedRaw, { existingIds })

      if (importados.length === 0) {
        window.alert('Nenhum cliente válido para importar.')
        return
      }

      const combinados = [...importados, ...existentes].sort((a, b) =>
        a.atualizadoEm < b.atualizadoEm ? 1 : -1,
      )

      try {
        persistClientesToLocalStorage(combinados)
      } catch (error) {
        if (isQuotaExceededError(error)) {
          try {
            // snapshots already stripped via spread, so raw stringify is safe here
            const ultraLite = combinados.map((r) => ({ ...r, propostaSnapshot: undefined }))
            window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ultraLite))
          } catch {
            try { window.localStorage.removeItem(CLIENTES_STORAGE_KEY) } catch { /* noop */ }
          }
        }
        console.warn('[bulk-import] local cache update failed (non-blocking)', error)
      }

      setClientesSalvos(combinados)
      adicionarNotificacao(`${importados.length} cliente(s) importado(s) com sucesso.`, 'success')
      setIsBulkImportPreviewOpen(false)
    } catch (error) {
      console.error('Erro durante confirmação da importação.', error)
      window.alert('Não foi possível importar os clientes. Tente novamente.')
    } finally {
      setIsBulkImportConfirming(false)
    }
  }, [
    adicionarNotificacao,
    bulkImportAutoMerge,
    bulkImportPreviewRows,
    carregarClientesSalvos,
    carregarClientesPrioritarios,
    getAccessToken,
    normalizeClienteRegistros,
    setClientesSalvos,
  ])

  const handleBulkImportRowSelection = useCallback((rowIndex: number, selected: boolean) => {
    setBulkImportPreviewRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, selected } : r)),
    )
  }, [])

  const handleBulkImportRowAction = useCallback((rowIndex: number, action: ImportSuggestedAction) => {
    setBulkImportPreviewRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, userAction: action } : r)),
    )
  }, [])

  const handleBulkImportSelectAllValid = useCallback(() => {
    setBulkImportPreviewRows((prev) =>
      prev.map((r) => ({
        ...r,
        selected:
          r.dedupResult.status === 'new' ||
          (r.dedupResult.matchLevel !== 'hard' && r.dedupResult.status !== 'existing'),
      })),
    )
  }, [])

  const handleBulkImportSelectAll = useCallback(() => {
    setBulkImportPreviewRows((prev) => prev.map((r) => ({ ...r, selected: true })))
  }, [])

  const handleBulkImportClearSelection = useCallback(() => {
    setBulkImportPreviewRows((prev) => prev.map((r) => ({ ...r, selected: false })))
  }, [])

  const handleBulkImportClose = useCallback(() => {
    setIsBulkImportPreviewOpen(false)
    pendingImportRawRowsRef.current = []
    setBulkImportPreviewRows([])
  }, [])

  return {
    isImportandoClientes,
    isGerandoBackupBanco,
    isBackupModalOpen,
    setIsBackupModalOpen,
    bulkImportPreviewRows,
    setBulkImportPreviewRows,
    isBulkImportPreviewOpen,
    setIsBulkImportPreviewOpen,
    bulkImportAutoMerge,
    setBulkImportAutoMerge,
    isBulkImportConfirming,
    pendingImportRawRowsRef,
    clientesImportInputRef,
    backupImportInputRef,
    downloadClientesArquivo,
    buildClientesFileName,
    handleExportarClientesJson,
    handleExportarClientesCsv,
    handleClientesImportarClick,
    handleBackupUploadArquivo,
    handleBackupBancoDados,
    handleBackupModalUpload,
    handleBackupModalDownload,
    handleClientesImportarArquivo,
    handleBulkImportConfirm,
    handleBulkImportRowSelection,
    handleBulkImportRowAction,
    handleBulkImportSelectAllValid,
    handleBulkImportSelectAll,
    handleBulkImportClearSelection,
    handleBulkImportClose,
  }
}
