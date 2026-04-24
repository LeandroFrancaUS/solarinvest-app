import React from 'react'
import type { DashboardInvoice } from '../../types/dashboard'
import { StatusBadge } from './StatusBadge'

interface InvoicesSectionProps {
  invoices: DashboardInvoice[]
  loading?: boolean
  onSelect?: (invoice: DashboardInvoice) => void
}

export function InvoicesSection({ invoices, loading, onSelect }: InvoicesSectionProps) {
  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded h-32" />
  }

  if (invoices.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">Nenhuma fatura encontrada.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs border-b">
            <th className="pb-2 pr-4">Cliente</th>
            <th className="pb-2 pr-4">Valor</th>
            <th className="pb-2 pr-4">Vencimento</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect?.(inv)}
            >
              <td className="py-2 pr-4 font-medium">{inv.clientName}</td>
              <td className="py-2 pr-4">
                {inv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="py-2 pr-4">{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
              <td className="py-2">
                <StatusBadge variant={inv.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
