import React from 'react'
import type { DashboardOperationalTask } from '../../types/dashboard'
import { StatusBadge } from './StatusBadge'

interface KitDeliverySectionProps {
  tasks: DashboardOperationalTask[]
  loading?: boolean
  onUpdateStatus?: (task: DashboardOperationalTask, newStatus: DashboardOperationalTask['status']) => void
}

export function KitDeliverySection({ tasks, loading, onUpdateStatus }: KitDeliverySectionProps) {
  const deliveries = tasks.filter((t) => t.type === 'KIT_DELIVERY')

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded h-32" />
  }

  if (deliveries.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">Nenhuma entrega de kit pendente.</p>
  }

  return (
    <div className="space-y-2">
      {deliveries.map((task) => (
        <div key={task.id} className="border rounded-lg px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{task.title}</p>
            <p className="text-xs text-gray-500">{task.clientName}</p>
            {task.scheduledFor && (
              <p className="text-xs text-gray-400 mt-0.5">
                Agendado: {new Date(task.scheduledFor).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={task.priority} />
            <StatusBadge variant={task.status} />
            {task.status === 'SCHEDULED' && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus(task, 'IN_PROGRESS')}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              >
                Iniciar
              </button>
            )}
            {task.status === 'IN_PROGRESS' && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus(task, 'DONE')}
                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
