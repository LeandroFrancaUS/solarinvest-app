import React from 'react'
import type { DashboardOperationalTask } from '../../types/dashboard'
import { StatusBadge } from './StatusBadge'

interface InstallationSectionProps {
  tasks: DashboardOperationalTask[]
  loading?: boolean
  onUpdateStatus?: (task: DashboardOperationalTask, newStatus: DashboardOperationalTask['status']) => void
}

export function InstallationSection({ tasks, loading, onUpdateStatus }: InstallationSectionProps) {
  const installations = tasks.filter((t) => t.type === 'INSTALLATION')

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded h-32" />
  }

  if (installations.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">Nenhuma instalação pendente.</p>
  }

  return (
    <div className="space-y-2">
      {installations.map((task) => (
        <div key={task.id} className="border rounded-lg px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{task.title}</p>
            <p className="text-xs text-gray-500">{task.clientName}</p>
            {task.scheduledFor && (
              <p className="text-xs text-gray-400 mt-0.5">
                Agendado: {new Date(task.scheduledFor).toLocaleDateString('pt-BR')}
              </p>
            )}
            {task.blockedReason && (
              <p className="text-xs text-red-500 mt-0.5">⚠️ {task.blockedReason}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={task.priority} />
            <StatusBadge variant={task.status} />
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
