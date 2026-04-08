-- Migration: create proposals and proposal_audit_log tables
-- Stores solar energy proposals (leasing and venda types) with audit history.

CREATE TABLE IF NOT EXISTS proposals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_type         TEXT        NOT NULL,
  proposal_code         TEXT,
  version               INT         NOT NULL DEFAULT 1,
  status                TEXT        NOT NULL DEFAULT 'draft',
  owner_user_id         TEXT        NOT NULL,
  owner_email           TEXT,
  owner_display_name    TEXT,
  created_by_user_id    TEXT        NOT NULL,
  updated_by_user_id    TEXT,
  client_name           TEXT,
  client_document       TEXT,
  client_city           TEXT,
  client_state          TEXT,
  client_phone          TEXT,
  client_email          TEXT,
  consumption_kwh_month NUMERIC,
  system_kwp            NUMERIC,
  capex_total           NUMERIC,
  contract_value        NUMERIC,
  term_months           INT,
  payload_json          JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ NULL,
  CONSTRAINT proposals_type_chk   CHECK (proposal_type IN ('leasing', 'venda')),
  CONSTRAINT proposals_status_chk CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_type             ON proposals (proposal_type);
CREATE INDEX IF NOT EXISTS idx_proposals_status           ON proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_user_id    ON proposals (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at       ON proposals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_updated_at       ON proposals (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_updated    ON proposals (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS proposal_audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id    UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  actor_user_id  TEXT        NOT NULL,
  actor_email    TEXT,
  action         TEXT        NOT NULL,
  old_value_json JSONB,
  new_value_json JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_audit_log_proposal_id ON proposal_audit_log (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_audit_log_created_at  ON proposal_audit_log (created_at DESC);
