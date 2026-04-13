// src/lib/clients/clientFilter.ts
// Pure utility for filtering the client list by consultant (created_by_user_id)
// and logical deletion status (deleted_at).
//
// This is the single source of truth for the filter applied on the Gestão de
// Clientes page. All derived values (pagination, counters, search, sorting)
// must operate on the output of getFilteredClients() — never on the raw list.

/**
 * Minimal client shape required by the filter logic.
 * Any superset of this interface (e.g. ClienteRegistro) is accepted.
 */
export interface ClientForFilter {
  /** Stack Auth user ID of the user who created the record. Primary filter key. */
  createdByUserId?: string | null
  /**
   * Logical deletion timestamp from the database.
   * Null/undefined means the record is active and should be shown.
   */
  deletedAt?: string | null
}

/**
 * Returns the subset of `clients` that should be displayed in the table for
 * the given `selectedConsultorId` filter value.
 *
 * Rules (applied in order):
 *  1. Exclude logically deleted records (`deletedAt != null`).
 *  2. If `selectedConsultorId` is `'all'`, return all active records.
 *  3. Otherwise, return only active records whose `createdByUserId` matches
 *     `selectedConsultorId` exactly.
 *
 * The function is pure: it never mutates the input array and always returns a
 * new array. It is safe to call with `null`/`undefined` field values.
 * An unknown filter value falls back to returning all active records.
 *
 * @param clients        - Full list of client records (may contain deleted ones).
 * @param selectedConsultorId - Stack user ID of the selected consultant, or `'all'`.
 * @returns Filtered array of active clients visible for the given selection.
 */
export function getFilteredClients<T extends ClientForFilter>(
  clients: T[],
  selectedConsultorId: string,
): T[] {
  // Step 1: exclude logically deleted records
  const activeClients = clients.filter((c) => c.deletedAt == null)

  if (import.meta.env.DEV) {
    console.debug('[clients-filter] selectedFilter=', selectedConsultorId)
    console.debug('[clients-filter] totalRaw=', clients.length)
    console.debug('[clients-filter] totalActive=', activeClients.length)
  }

  // Step 2: apply consultant filter
  if (!selectedConsultorId || selectedConsultorId === 'all') {
    if (import.meta.env.DEV) {
      console.debug('[clients-filter] totalVisible=', activeClients.length)
    }
    return activeClients
  }

  const filtered = activeClients.filter(
    (c) => c.createdByUserId === selectedConsultorId,
  )

  if (import.meta.env.DEV) {
    console.debug('[clients-filter] totalVisible=', filtered.length)
  }

  return filtered
}
