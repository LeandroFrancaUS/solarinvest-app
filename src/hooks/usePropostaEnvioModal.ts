// src/hooks/usePropostaEnvioModal.ts
//
// Extracted from App.tsx. Encapsulates the "enviar proposta" modal state:
// - modal open/close state
// - selected contact ID state
// - deduplicated contact list (memo)
// - selected contact (memo)
// - auto-select effect (picks first contact when list changes)
// - selecionarContatoEnvio / fecharEnvioPropostaModal callbacks
//
// Zero behavioural change — exact same logic as the original App.tsx block.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropostaEnvioContato } from '../components/modals/EnviarPropostaModal'
import { normalizeNumbers } from '../utils/formatters'

// ─── Params ───────────────────────────────────────────────────────────────────

export interface UsePropostaEnvioModalParams {
  cliente: { nome?: string | undefined; telefone?: string | undefined; email?: string | undefined }
  clientesSalvos: Array<{
    id: string
    dados: { nome?: string | undefined; telefone?: string | undefined; email?: string | undefined }
  }>
  crmLeads: Array<{
    id: string
    nome?: string | undefined
    telefone?: string | undefined
    email?: string | undefined
  }>
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UsePropostaEnvioModalResult {
  isEnviarPropostaModalOpen: boolean
  setIsEnviarPropostaModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  contatoEnvioSelecionadoId: string | null
  setContatoEnvioSelecionadoId: React.Dispatch<React.SetStateAction<string | null>>
  contatosEnvio: PropostaEnvioContato[]
  contatoEnvioSelecionado: PropostaEnvioContato | null
  selecionarContatoEnvio: (id: string) => void
  fecharEnvioPropostaModal: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePropostaEnvioModal(
  params: UsePropostaEnvioModalParams,
): UsePropostaEnvioModalResult {
  const { cliente, clientesSalvos, crmLeads } = params

  const [isEnviarPropostaModalOpen, setIsEnviarPropostaModalOpen] = useState(false)
  const [contatoEnvioSelecionadoId, setContatoEnvioSelecionadoId] = useState<string | null>(null)

  const contatosEnvio = useMemo<PropostaEnvioContato[]>(() => {
    const mapa = new Map<string, PropostaEnvioContato>()

    const adicionarContato = (
      contato: Omit<PropostaEnvioContato, 'id'> & { id?: string },
    ) => {
      const telefone = contato.telefone?.trim() ?? ''
      const telefoneDigits = telefone ? normalizeNumbers(telefone) : ''
      const chave = telefoneDigits ? `fone-${telefoneDigits}` : contato.id ?? ''
      if (!chave) {
        return
      }

      const existente = mapa.get(chave)
      if (existente) {
        const nome = contato.nome?.trim()
        if (nome && !existente.nome) {
          existente.nome = nome
        }
        if (telefone && !existente.telefone) {
          existente.telefone = telefone
        }
        if (contato.email && !existente.email) {
          existente.email = contato.email
        }
        return
      }

      mapa.set(chave, {
        id: chave,
        nome: contato.nome?.trim() || '',
        telefone,
        email: contato.email?.trim() || undefined,
        origem: contato.origem,
      })
    }

    const nomeAtual = cliente.nome?.trim()
    const telefoneAtual = cliente.telefone?.trim()
    const emailAtual = cliente.email?.trim()
    if (nomeAtual || telefoneAtual || emailAtual) {
      adicionarContato({
        id: 'cliente-atual',
        nome: nomeAtual || 'Cliente atual',
        telefone: telefoneAtual || '',
        email: emailAtual || undefined,
        origem: 'cliente-atual',
      })
    }

    clientesSalvos.forEach((registro) => {
      const dados = registro.dados
      const telefone = dados.telefone?.trim() ?? ''
      const email = dados.email?.trim()
      const nome = dados.nome?.trim()
      if (nome || telefone || email) {
        adicionarContato({
          id: registro.id,
          nome: nome || 'Cliente salvo',
          telefone,
          email: email || undefined,
          origem: 'cliente-salvo',
        })
      }
    })

    crmLeads.forEach((lead) => {
      const nome = lead.nome?.trim()
      const telefone = lead.telefone?.trim()
      const email = lead.email?.trim()
      if (nome || telefone || email) {
        adicionarContato({
          id: lead.id,
          nome: nome || 'Lead sem nome',
          telefone: telefone || '',
          email: email || undefined,
          origem: 'crm',
        })
      }
    })

    return Array.from(mapa.values())
  }, [cliente, clientesSalvos, crmLeads])

  const contatoEnvioSelecionado = useMemo(() => {
    if (!contatoEnvioSelecionadoId) {
      return null
    }
    return contatosEnvio.find((contato) => contato.id === contatoEnvioSelecionadoId) ?? null
  }, [contatoEnvioSelecionadoId, contatosEnvio])

  useEffect(() => {
    if (contatosEnvio.length === 0) {
      setContatoEnvioSelecionadoId(null)
      return
    }

    setContatoEnvioSelecionadoId((prev) => {
      if (prev && contatosEnvio.some((contato) => contato.id === prev)) {
        return prev
      }
      return contatosEnvio[0]?.id ?? null
    })
  }, [contatosEnvio])

  const selecionarContatoEnvio = useCallback((id: string) => {
    setContatoEnvioSelecionadoId(id)
  }, [])

  const fecharEnvioPropostaModal = useCallback(() => {
    setIsEnviarPropostaModalOpen(false)
  }, [])

  return {
    isEnviarPropostaModalOpen,
    setIsEnviarPropostaModalOpen,
    contatoEnvioSelecionadoId,
    setContatoEnvioSelecionadoId,
    contatosEnvio,
    contatoEnvioSelecionado,
    selecionarContatoEnvio,
    fecharEnvioPropostaModal,
  }
}
