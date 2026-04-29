import type { PortfolioClientRow } from '../../types/clientPortfolio'

export interface WifiAlert {
  clientId: number
  name: string | null
  status: 'desconectado' | 'falha'
}

export function computeWifiAlerts(clients: PortfolioClientRow[]): WifiAlert[] {
  return clients
    .filter(c => c.wifi_status === 'desconectado' || c.wifi_status === 'falha')
    .map(c => ({
      clientId: c.id,
      name: c.name,
      status: c.wifi_status as 'desconectado' | 'falha',
    }))
}
