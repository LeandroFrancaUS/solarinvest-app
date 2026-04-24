-- Migration: 0057_operational_dashboard.sql
-- Creates tables for operational dashboard: tasks, notification prefs, and activity log.
-- Focus: monitoring billing, payments, deliveries, installations, and technical support.
-- NO financial analytics, ROI, or investment indicators.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) dashboard_operational_tasks
-- Tracks operational tasks: kit delivery, installation, tech support, etc.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_operational_tasks (
  id SERIAL PRIMARY KEY,

  -- Task classification
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',

  -- Related entities
  client_id INTEGER REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name VARCHAR(255),
  proposal_id UUID,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- Task status and scheduling
  status VARCHAR(50) NOT NULL DEFAULT 'NOT_SCHEDULED',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,

  -- Assignment
  responsible_user_id VARCHAR(255),

  -- Additional context
  notes TEXT,
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR(255),
  updated_by_user_id VARCHAR(255),

  -- Constraints
  CONSTRAINT task_type_check CHECK (type IN (
    'KIT_DELIVERY',
    'INSTALLATION',
    'TECH_SUPPORT',
    'DOCUMENTATION',
    'BILLING',
    'COLLECTION',
    'GRID_APPROVAL',
    'OTHER'
  )),
  CONSTRAINT task_status_check CHECK (status IN (
    'NOT_SCHEDULED',
    'SCHEDULED',
    'IN_PROGRESS',
    'BLOCKED',
    'DONE',
    'CANCELLED',
    'RESCHEDULE_REQUIRED'
  )),
  CONSTRAINT task_priority_check CHECK (priority IN (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  ))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_client_id
  ON public.dashboard_operational_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_type
  ON public.dashboard_operational_tasks(type);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status
  ON public.dashboard_operational_tasks(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_priority
  ON public.dashboard_operational_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_scheduled_for
  ON public.dashboard_operational_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_responsible
  ON public.dashboard_operational_tasks(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_updated_at
  ON public.dashboard_operational_tasks(updated_at DESC);

-- Composite indexes for filtering
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status_priority
  ON public.dashboard_operational_tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_client_status
  ON public.dashboard_operational_tasks(client_id, status);

COMMENT ON TABLE public.dashboard_operational_tasks IS
  'Operational tasks for monitoring deliveries, installations, support, and billing operations';
COMMENT ON COLUMN public.dashboard_operational_tasks.type IS
  'Task type: KIT_DELIVERY, INSTALLATION, TECH_SUPPORT, DOCUMENTATION, etc';
COMMENT ON COLUMN public.dashboard_operational_tasks.status IS
  'Current status: NOT_SCHEDULED, SCHEDULED, IN_PROGRESS, BLOCKED, DONE, CANCELLED, RESCHEDULE_REQUIRED';
COMMENT ON COLUMN public.dashboard_operational_tasks.priority IS
  'Task priority: LOW, MEDIUM, HIGH, CRITICAL';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) dashboard_notification_preferences
-- User preferences for visual, audio, and push notifications
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Global notification toggles
  visual_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Per-event-type toggles
  overdue_invoices BOOLEAN NOT NULL DEFAULT TRUE,
  due_soon_invoices BOOLEAN NOT NULL DEFAULT TRUE,
  kit_delivery_updates BOOLEAN NOT NULL DEFAULT TRUE,
  installation_updates BOOLEAN NOT NULL DEFAULT TRUE,
  support_updates BOOLEAN NOT NULL DEFAULT TRUE,

  -- Filter options
  critical_only BOOLEAN NOT NULL DEFAULT FALSE,

  -- Quiet hours (HH:MM format)
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notif_prefs_user_id
  ON public.dashboard_notification_preferences(user_id);

COMMENT ON TABLE public.dashboard_notification_preferences IS
  'User-specific notification preferences for operational dashboard alerts';
COMMENT ON COLUMN public.dashboard_notification_preferences.visual_enabled IS
  'Enable visual notifications (toasts, badges)';
COMMENT ON COLUMN public.dashboard_notification_preferences.sound_enabled IS
  'Enable audio alerts for notifications';
COMMENT ON COLUMN public.dashboard_notification_preferences.push_enabled IS
  'Enable web push notifications';

-- ────────────────────────────────────────────────────────────────────────────
-- 3) dashboard_activity_log
-- Audit trail for all mutations on invoices and tasks
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_activity_log (
  id SERIAL PRIMARY KEY,

  -- Entity reference
  entity_type VARCHAR(20) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,

  -- Action performed
  action VARCHAR(50) NOT NULL,

  -- Actor
  performed_by VARCHAR(255),
  performed_by_name VARCHAR(255),

  -- Additional context
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT activity_entity_type_check CHECK (entity_type IN ('invoice', 'task', 'client', 'proposal')),
  CONSTRAINT activity_action_check CHECK (action IN (
    'created',
    'updated',
    'status_changed',
    'payment_registered',
    'scheduled',
    'rescheduled',
    'completed',
    'blocked',
    'unblocked',
    'cancelled',
    'deleted'
  ))
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_dashboard_activity_entity
  ON public.dashboard_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_activity_created_at
  ON public.dashboard_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_activity_performed_by
  ON public.dashboard_activity_log(performed_by);

COMMENT ON TABLE public.dashboard_activity_log IS
  'Audit trail for all operational dashboard mutations (invoices, tasks, payments)';
COMMENT ON COLUMN public.dashboard_activity_log.entity_type IS
  'Type of entity: invoice, task, client, proposal';
COMMENT ON COLUMN public.dashboard_activity_log.action IS
  'Action performed: created, updated, status_changed, payment_registered, etc';

COMMIT;
