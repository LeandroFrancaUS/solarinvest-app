import './clientPortfolio'

declare module './clientPortfolio' {
  interface PortfolioClientRow {
    wifi_status?: 'conectado' | 'desconectado' | 'falha' | null
  }
}
