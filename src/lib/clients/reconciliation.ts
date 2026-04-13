export type ClientLike = {
  id?: string | number | null
  localId?: string | number | null
}

export function getClientStableKey(client: ClientLike): string {
  return String(client.id ?? client.localId ?? '')
}

export function reconcileDeletedClients<T extends ClientLike>(
  clients: T[],
  deletedClientKeys: Set<string>,
): T[] {
  if (!Array.isArray(clients) || clients.length === 0) return []
  if (!deletedClientKeys.size) return clients
  return clients.filter((client) => !deletedClientKeys.has(getClientStableKey(client)))
}

export function shouldIgnoreSnapshot(
  snapshotSavedAt: number | null | undefined,
  lastDeleteReconciledAt: number | null | undefined,
): boolean {
  if (!snapshotSavedAt || !lastDeleteReconciledAt) return false
  return snapshotSavedAt < lastDeleteReconciledAt
}
