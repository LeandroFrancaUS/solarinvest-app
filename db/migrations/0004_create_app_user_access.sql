-- Migration: create app_user_access and app_user_access_audit tables
-- These tables power the internal authorization layer (separate from Stack Auth identity)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS app_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  access_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  can_access_app BOOLEAN NOT NULL DEFAULT false,
  invited_by TEXT NULL,
  approved_by TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  revoked_by TEXT NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_user_access_role_chk CHECK (role IN ('admin', 'manager', 'user')),
  CONSTRAINT app_user_access_status_chk CHECK (access_status IN ('pending', 'approved', 'revoked', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_app_user_access_email ON app_user_access (email);
CREATE INDEX IF NOT EXISTS idx_app_user_access_status ON app_user_access (access_status);
CREATE INDEX IF NOT EXISTS idx_app_user_access_role ON app_user_access (role);

-- Audit table for all access changes
CREATE TABLE IF NOT EXISTS app_user_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES app_user_access(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_app_user_access_audit_created ON app_user_access_audit (created_at DESC);
