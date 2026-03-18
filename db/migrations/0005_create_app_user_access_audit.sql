-- Migration: create app_user_access_audit table
-- Records all authorization changes for auditing purposes.

CREATE TABLE IF NOT EXISTS app_user_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NULL,
  old_role TEXT NULL,
  new_role TEXT NULL,
  performed_by_user_id UUID NULL,
  performed_by_email TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_user_access_audit_target ON app_user_access_audit (target_user_id);
CREATE INDEX IF NOT EXISTS idx_app_user_access_audit_action ON app_user_access_audit (action);
