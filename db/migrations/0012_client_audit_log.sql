-- Migration: Create client_audit_log for merge/ownership/CPF attach audit trail

CREATE TABLE IF NOT EXISTS client_audit_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT      NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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
      'created', 'updated', 'deleted', 'merged', 'merge_target',
      'ownership_transferred', 'cpf_attached', 'proposal_linked',
      'imported', 'conflict_resolved'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_client_audit_log_client_id  ON client_audit_log (client_id);
CREATE INDEX IF NOT EXISTS idx_client_audit_log_action     ON client_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_client_audit_log_created_at ON client_audit_log (created_at DESC);
