// src/hooks/useLinkedConsultant.ts
// Hook to auto-detect and manage the consultant linked to the current user.
// When a user logs in as a consultant, their consultant profile is automatically
// detected and made available for auto-filling forms.

import { useState, useEffect } from 'react'
import { autoDetectLinkedConsultant } from '../services/personnelApi'
import type { Consultant } from '../types/personnel'

interface UseLinkedConsultantResult {
  linkedConsultant: Consultant | null
  matchType: string | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Hook to automatically detect the consultant linked to the current logged-in user.
 * The detection is performed on mount and returns the consultant if found.
 *
 * Priority matching:
 *   1) linked_user_id (explicit link)
 *   2) email match (case-insensitive)
 *   3) first + last name match (case-insensitive)
 *
 * Usage:
 *   const { linkedConsultant, loading } = useLinkedConsultant()
 *   if (linkedConsultant) {
 *     // Auto-fill consultant fields with linkedConsultant.id
 *   }
 */
export function useLinkedConsultant(): UseLinkedConsultantResult {
  const [linkedConsultant, setLinkedConsultant] = useState<Consultant | null>(null)
  const [matchType, setMatchType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function detectConsultant() {
      setLoading(true)
      setError(null)
      try {
        const result = await autoDetectLinkedConsultant()
        if (!cancelled) {
          setLinkedConsultant(result.consultant)
          setMatchType(result.matchType ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useLinkedConsultant] Failed to auto-detect consultant:', err)
          setError(err instanceof Error ? err.message : 'Erro ao detectar consultor vinculado')
          setLinkedConsultant(null)
          setMatchType(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void detectConsultant()

    return () => {
      cancelled = true
    }
  }, [refreshTrigger])

  const refresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return { linkedConsultant, matchType, loading, error, refresh }
}
