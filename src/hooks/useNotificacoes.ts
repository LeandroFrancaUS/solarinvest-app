// src/hooks/useNotificacoes.ts
//
// Extracted from App.tsx. Encapsulates the notification queue with
// auto-dismiss timeout management.
//
//   • notificacoes — current list of active notifications
//   • adicionarNotificacao — adds a notification and schedules auto-dismiss
//   • removerNotificacao — removes a notification and clears its timeout
//
// Zero behavioural change — exact same logic as the original App.tsx block.

import { useCallback, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificacaoTipo = 'success' | 'info' | 'error'

export type Notificacao = {
  id: number
  mensagem: string
  tipo: NotificacaoTipo
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseNotificacoesResult {
  notificacoes: Notificacao[]
  adicionarNotificacao: (mensagem: string, tipo?: NotificacaoTipo) => void
  removerNotificacao: (id: number) => void
  clearNotificacoes: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificacoes(): UseNotificacoesResult {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const notificacaoSequencialRef = useRef(0)
  const notificacaoTimeoutsRef = useRef<Record<number, number>>({})

  const removerNotificacao = useCallback((id: number) => {
    setNotificacoes((prev) => prev.filter((item) => item.id !== id))

    const timeoutId = notificacaoTimeoutsRef.current[id]
    if (timeoutId && typeof window !== 'undefined') {
      window.clearTimeout(timeoutId)
    }
    delete notificacaoTimeoutsRef.current[id]
  }, [])

  const adicionarNotificacao = useCallback(
    (mensagem: string, tipo: NotificacaoTipo = 'info') => {
      notificacaoSequencialRef.current += 1
      const id = notificacaoSequencialRef.current

      setNotificacoes((prev) => [...prev, { id, mensagem, tipo }])

      if (typeof window !== 'undefined') {
        const timeoutId = window.setTimeout(() => removerNotificacao(id), 5000)
        notificacaoTimeoutsRef.current[id] = timeoutId
      }
    },
    [removerNotificacao],
  )

  const clearNotificacoes = useCallback(() => {
    setNotificacoes([])
  }, [])

  return { notificacoes, adicionarNotificacao, removerNotificacao, clearNotificacoes }
}
