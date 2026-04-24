import React from 'react'
import type { InvoiceStatus, OperationalTaskStatus, TaskPriority } from '../../types/dashboard'

type BadgeVariant = OperationalTaskStatus | TaskPriority | InvoiceStatus

const VARIANT_STYLES: Record<string, string> = {
  NOT_SCHEDULED: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  BLOCKED: 'bg-red-100 text-red-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-200 text-gray-500 line-through',
  RESCHEDULE_REQUIRED: 'bg-orange-100 text-orange-700',
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700 font-bold',
  PENDING: 'bg-gray-100 text-gray-700',
  DUE_SOON: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-teal-100 text-teal-700',
  DISPUTED: 'bg-purple-100 text-purple-700',
}

const VARIANT_LABELS: Record<string, string> = {
  NOT_SCHEDULED: 'Não Agendado',
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'Em Andamento',
  BLOCKED: 'Bloqueado',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
  RESCHEDULE_REQUIRED: 'Reagendamento',
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítico',
  PENDING: 'Pendente',
  DUE_SOON: 'Vence em Breve',
  OVERDUE: 'Vencido',
  PAID: 'Pago',
  PARTIALLY_PAID: 'Pago Parcial',
  DISPUTED: 'Disputado',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label?: string
  className?: string
}

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const style = VARIANT_STYLES[variant] ?? 'bg-gray-100 text-gray-700'
  const text = label ?? VARIANT_LABELS[variant] ?? variant
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style} ${className}`}>
      {text}
    </span>
  )
}
