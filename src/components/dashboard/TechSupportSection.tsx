import React from 'react'
import type { DashboardOperationalTask } from '../../types/dashboard'
import { StatusBadge } from './StatusBadge'

interface TechSupportSectionProps {
  tasks: DashboardOperationalTask[]
  loading?: boolean
  onUpdateStatus?: (task: DashboardOperationalTask, newStatus: DashboardOperationalTask['status']) => void
}

export function TechSupportSection({ tasks, loading, onUpdateStatus }: TechSupportSectionProps) {
  const tickets = tasks.filter((t) => t.type === 'TECH_SUPPORT')

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded h-32" />
  }

  if (tickets.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">Nenhum chamado de suporte aberto.</p>
  }

  return (
    <div className="space-y-2">
      {tickets.map((task) => (
        <div key={task.id} className="border rounded-lg px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{task.title}</p>
            <p className="text-xs text-gray-500">{task.clientName}</p>
            {task.notes && <p className="text-xs text-gray-400 mt-0.5">{task.notes}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={task.priority} />
            <StatusBadge variant={task.status} />
            {task.status !== 'DONE' && task.status !== 'CANCELLED' && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus(task, 'DONE')}
                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
              >
                Resolver
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
