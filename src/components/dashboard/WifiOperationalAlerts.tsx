import React from 'react'
import type { PortfolioClientRow } from '../../types/clientPortfolio'
import { computeWifiAlerts } from '../../domain/wifi/wifiOperationalAlerts'

export function WifiOperationalAlerts({ clients }: { clients: PortfolioClientRow[] }) {
  const alerts = computeWifiAlerts(clients)

  if (alerts.length === 0) return null

  return (
    <div>
      <h3>Alertas Operacionais WiFi</h3>
      <ul>
        {alerts.map(a => (
          <li key={a.clientId}>
            {a.name} - {a.status === 'falha' ? 'Falha crítica' : 'Desconectado'}
          </li>
        ))}
      </ul>
    </div>
  )
}
