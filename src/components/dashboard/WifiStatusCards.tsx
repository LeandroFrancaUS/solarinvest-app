import React from 'react'
import type { PortfolioClientRow } from '../../types/clientPortfolio'

export function WifiStatusCards({ clients }: { clients: PortfolioClientRow[] }) {
  const online = clients.filter(c => c.wifi_status === 'conectado').length
  const offline = clients.filter(c => c.wifi_status === 'desconectado').length
  const falha = clients.filter(c => c.wifi_status === 'falha').length

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div>🟢 Online: {online}</div>
      <div>🟡 Offline: {offline}</div>
      <div>🔴 Falha: {falha}</div>
    </div>
  )
}
