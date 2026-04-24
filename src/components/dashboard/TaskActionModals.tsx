import React, { useState } from 'react'
import type { DashboardOperationalTask } from '../../types/dashboard'

interface BlockTaskModalProps {
  task: DashboardOperationalTask | null
  onConfirm: (task: DashboardOperationalTask, reason: string) => void
  onClose: () => void
}

export function BlockTaskModal({ task, onConfirm, onClose }: BlockTaskModalProps) {
  const [reason, setReason] = useState('')

  if (!task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-2">Registrar Bloqueio</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tarefa: <strong>{task.title}</strong>
        </p>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-400"
          placeholder="Descreva o motivo do bloqueio..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            disabled={!reason.trim()}
            onClick={() => { onConfirm(task, reason); onClose() }}
            className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

interface RescheduleTaskModalProps {
  task: DashboardOperationalTask | null
  onConfirm: (task: DashboardOperationalTask, newDate: string) => void
  onClose: () => void
}

export function RescheduleTaskModal({ task, onConfirm, onClose }: RescheduleTaskModalProps) {
  const [date, setDate] = useState('')

  if (!task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-2">Reagendar Tarefa</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tarefa: <strong>{task.title}</strong>
        </p>
        <label className="block text-sm text-gray-700 mb-1">Nova data:</label>
        <input
          type="datetime-local"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            disabled={!date}
            onClick={() => { onConfirm(task, date); onClose() }}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Reagendar
          </button>
        </div>
      </div>
    </div>
  )
}
