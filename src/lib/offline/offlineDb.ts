/**
 * IndexedDB instances for the offline-first store.
 * All stores use localforage for cross-browser IndexedDB access.
 *
 * Store layout:
 *   offline_clients   — client entities created/edited while offline
 *   offline_proposals — proposal entities created/edited while offline
 *   sync_queue        — ordered queue of pending operations
 *   sync_metadata     — last sync timestamps, entity ID mappings
 *   sync_conflicts    — conflict records awaiting resolution
 */

import localforage from 'localforage'

const DB_NAME = 'solarinvest-offline'

export const offlineClientsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'offline_clients',
  description: 'Client entities for offline creation/editing',
})

export const offlineProposalsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'offline_proposals',
  description: 'Proposal entities for offline creation/editing',
})

export const syncQueueStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'sync_queue',
  description: 'Ordered queue of pending sync operations',
})

export const syncMetadataStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'sync_metadata',
  description: 'Last sync timestamps and local→server ID mappings',
})

export const syncConflictsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'sync_conflicts',
  description: 'Conflicts awaiting manual resolution',
})
