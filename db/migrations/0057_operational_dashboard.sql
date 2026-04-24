BEGIN;

CREATE TABLE IF NOT EXISTS public.dashboard_operational_tasks (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('KIT_DELIVERY','INSTALLATION','TECH_SUPPORT','DOCUMENTATION','BILLING','COLLECTION','GRID_APPROVAL','OTHER')),
  title VARCHAR(255) NOT NULL,
  client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL DEFAULT '',
  proposal_id INTEGER REFERENCES public.proposals(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NOT_SCHEDULED' CHECK (status IN ('NOT_SCHEDULED','SCHEDULED','IN_PROGRESS','BLOCKED','DONE','CANCELLED','RESCHEDULE_REQUIRED')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,
  responsible_user_id VARCHAR(255),
  priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_tasks_client ON public.dashboard_operational_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_op_tasks_status ON public.dashboard_operational_tasks(status);
CREATE INDEX IF NOT EXISTS idx_op_tasks_type ON public.dashboard_operational_tasks(type);
CREATE INDEX IF NOT EXISTS idx_op_tasks_priority ON public.dashboard_operational_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_op_tasks_scheduled ON public.dashboard_operational_tasks(scheduled_for);

CREATE TABLE IF NOT EXISTS public.dashboard_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  visual_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  overdue_invoices BOOLEAN NOT NULL DEFAULT TRUE,
  due_soon_invoices BOOLEAN NOT NULL DEFAULT TRUE,
  kit_delivery_updates BOOLEAN NOT NULL DEFAULT TRUE,
  installation_updates BOOLEAN NOT NULL DEFAULT TRUE,
  support_updates BOOLEAN NOT NULL DEFAULT TRUE,
  critical_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dashboard_events (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  actor_user_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dash_events_entity ON public.dashboard_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dash_events_created ON public.dashboard_events(created_at DESC);

COMMIT;
