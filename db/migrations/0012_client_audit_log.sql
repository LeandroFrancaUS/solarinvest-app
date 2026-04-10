-- Migration: Create public.client_audit_log for merge / ownership / CPF attach audit trail
--
-- Purpose:
--   Immutable audit trail for important client lifecycle events:
--   creation, update, delete, merge, CPF attachment, ownership transfer, etc.
--
-- Notes:
--   - Safe to re-run
--   - Assumes public.clients already exists
--   - Append-only design recommended (no updates/deletes in normal flow)

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_audit_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT      NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_user_id       TEXT        NOT NULL,
  actor_email         TEXT,
  action              TEXT        NOT NULL,
  old_value_json      JSONB,
  new_value_json      JSONB,
  changed_by_admin_id TEXT,
  reason              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_audit_log_action_chk CHECK (
    action IN (
      'created',
      'updated',
      'deleted',
      'merged',
      'merge_target',
      'ownership_transferred',
      'cpf_attached',
      'proposal_linked',
      'imported',
      'conflict_resolved'
    )
  )
);

-- Common lookup indexes
CREATE INDEX IF NOT EXISTS idx_client_audit_log_client_id
  ON public.client_audit_log (client_id);

CREATE INDEX IF NOT EXISTS idx_client_audit_log_action
  ON public.client_audit_log (action);

CREATE INDEX IF NOT EXISTS idx_client_audit_log_actor_user_id
  ON public.client_audit_log (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_client_audit_log_created_at
  ON public.client_audit_log (created_at DESC);

-- Optional JSONB indexes for forensic / admin search
CREATE INDEX IF NOT EXISTS idx_client_audit_log_old_value_json
  ON public.client_audit_log
  USING GIN (old_value_json);

CREATE INDEX IF NOT EXISTS idx_client_audit_log_new_value_json
  ON public.client_audit_log
  USING GIN (new_value_json);

COMMENT ON TABLE public.client_audit_log IS
  'Immutable audit trail for client lifecycle events such as merge, CPF attachment, ownership transfer, import and conflict resolution.';

COMMENT ON COLUMN public.client_audit_log.client_id IS
  'Client affected by the audited action.';

COMMENT ON COLUMN public.client_audit_log.actor_user_id IS
  'Authenticated user ID that triggered the action.';

COMMENT ON COLUMN public.client_audit_log.actor_email IS
  'Email snapshot of the actor at the moment of the action.';

COMMENT ON COLUMN public.client_audit_log.action IS
  'Normalized action type for audit filtering and forensic review.';

COMMENT ON COLUMN public.client_audit_log.old_value_json IS
  'Previous value snapshot before the change, when applicable.';

COMMENT ON COLUMN public.client_audit_log.new_value_json IS
  'New value snapshot after the change, when applicable.';

COMMENT ON COLUMN public.client_audit_log.changed_by_admin_id IS
  'Admin user ID when the change was performed or overridden administratively.';

COMMENT ON COLUMN public.client_audit_log.reason IS
  'Human-readable reason or context for the audited action.';

COMMENT ON COLUMN public.client_audit_log.created_at IS
  'Timestamp when the audit event was recorded.';

COMMIT;
