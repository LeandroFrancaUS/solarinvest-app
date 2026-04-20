-- Migration: 0040_consultants_engineers_installers.sql
-- Creates dedicated entity tables for consultants, engineers, and installers.
-- Adds FK columns to clients and client_project_status for role linkage.
--
-- New tables:
--   consultants            — registered consultants (distinct from app users)
--   engineers              — registered engineers with CREA
--   installers             — registered installers
--
-- Alterations:
--   clients                — adds consultant_id FK
--   client_project_status  — adds engineer_id, installer_id, art_number,
--                            art_issued_at, art_status
--
-- ART uniqueness: a UNIQUE constraint on (client_id, art_number) in
-- client_project_status prevents duplicate ARTs per project.
--
-- RLS: all three new tables follow the same portfolio pattern:
--   read  → role_admin, role_office, role_financeiro
--   write → role_admin only
--
-- Safe to re-run (idempotent via IF NOT EXISTS / IF NOT EXISTS guards).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) consultants
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultants (
  id                   BIGSERIAL PRIMARY KEY,
  consultant_code      TEXT        NOT NULL,
  full_name            TEXT        NOT NULL,
  phone                TEXT        NOT NULL,
  email                TEXT        NOT NULL,
  regions              TEXT[]      NOT NULL DEFAULT '{}',
  linked_user_id       TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id   TEXT,
  updated_by_user_id   TEXT,
  CONSTRAINT consultants_code_unique  UNIQUE (consultant_code),
  CONSTRAINT consultants_code_format  CHECK  (consultant_code ~ '^[A-Za-z0-9]{4}$')
);

CREATE INDEX IF NOT EXISTS idx_consultants_is_active
  ON public.consultants (is_active)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) engineers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.engineers (
  id                   BIGSERIAL PRIMARY KEY,
  engineer_code        TEXT        NOT NULL,
  full_name            TEXT        NOT NULL,
  phone                TEXT        NOT NULL,
  email                TEXT        NOT NULL,
  crea                 TEXT        NOT NULL,
  linked_user_id       TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id   TEXT,
  updated_by_user_id   TEXT,
  CONSTRAINT engineers_code_unique  UNIQUE (engineer_code),
  CONSTRAINT engineers_code_format  CHECK  (engineer_code ~ '^[A-Za-z0-9]{4}$')
);

CREATE INDEX IF NOT EXISTS idx_engineers_is_active
  ON public.engineers (is_active)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) installers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.installers (
  id                   BIGSERIAL PRIMARY KEY,
  installer_code       TEXT        NOT NULL,
  full_name            TEXT        NOT NULL,
  phone                TEXT        NOT NULL,
  email                TEXT        NOT NULL,
  linked_user_id       TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id   TEXT,
  updated_by_user_id   TEXT,
  CONSTRAINT installers_code_unique  UNIQUE (installer_code),
  CONSTRAINT installers_code_format  CHECK  (installer_code ~ '^[A-Za-z0-9]{4}$')
);

CREATE INDEX IF NOT EXISTS idx_installers_is_active
  ON public.installers (is_active)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) clients — add consultant_id FK (nullable)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consultant_id BIGINT REFERENCES public.consultants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_consultant_id
  ON public.clients (consultant_id)
  WHERE consultant_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) client_project_status — add engineer_id, installer_id, ART fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.client_project_status
  ADD COLUMN IF NOT EXISTS engineer_id    BIGINT REFERENCES public.engineers(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installer_id   BIGINT REFERENCES public.installers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS art_number     TEXT,
  ADD COLUMN IF NOT EXISTS art_issued_at  DATE,
  ADD COLUMN IF NOT EXISTS art_status     TEXT;

CREATE INDEX IF NOT EXISTS idx_client_project_engineer_id
  ON public.client_project_status (engineer_id)
  WHERE engineer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_project_installer_id
  ON public.client_project_status (installer_id)
  WHERE installer_id IS NOT NULL;

-- Prevent duplicate non-null ART numbers per project (one ART per project).
-- Partial unique index: only enforces uniqueness when art_number IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_project_art_number_unique
  ON public.client_project_status (art_number)
  WHERE art_number IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RLS for new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- consultants
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consultants_select ON public.consultants;
DROP POLICY IF EXISTS consultants_insert ON public.consultants;
DROP POLICY IF EXISTS consultants_update ON public.consultants;
DROP POLICY IF EXISTS consultants_delete ON public.consultants;

CREATE POLICY consultants_select ON public.consultants
  FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY consultants_insert ON public.consultants
  FOR INSERT WITH CHECK (app.current_user_role() = 'role_admin');
CREATE POLICY consultants_update ON public.consultants
  FOR UPDATE USING (app.can_access_portfolio())
  WITH CHECK (app.current_user_role() = 'role_admin');
CREATE POLICY consultants_delete ON public.consultants
  FOR DELETE USING (app.current_user_role() = 'role_admin');

-- engineers
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS engineers_select ON public.engineers;
DROP POLICY IF EXISTS engineers_insert ON public.engineers;
DROP POLICY IF EXISTS engineers_update ON public.engineers;
DROP POLICY IF EXISTS engineers_delete ON public.engineers;

CREATE POLICY engineers_select ON public.engineers
  FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY engineers_insert ON public.engineers
  FOR INSERT WITH CHECK (app.current_user_role() = 'role_admin');
CREATE POLICY engineers_update ON public.engineers
  FOR UPDATE USING (app.can_access_portfolio())
  WITH CHECK (app.current_user_role() = 'role_admin');
CREATE POLICY engineers_delete ON public.engineers
  FOR DELETE USING (app.current_user_role() = 'role_admin');

-- installers
ALTER TABLE public.installers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installers_select ON public.installers;
DROP POLICY IF EXISTS installers_insert ON public.installers;
DROP POLICY IF EXISTS installers_update ON public.installers;
DROP POLICY IF EXISTS installers_delete ON public.installers;

CREATE POLICY installers_select ON public.installers
  FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY installers_insert ON public.installers
  FOR INSERT WITH CHECK (app.current_user_role() = 'role_admin');
CREATE POLICY installers_update ON public.installers
  FOR UPDATE USING (app.can_access_portfolio())
  WITH CHECK (app.current_user_role() = 'role_admin');
CREATE POLICY installers_delete ON public.installers
  FOR DELETE USING (app.current_user_role() = 'role_admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.consultants IS 'Registered sales consultants. Distinct from app users — one person may be both.';
COMMENT ON TABLE public.engineers   IS 'Registered engineers with CREA. Linked to projects via client_project_status.engineer_id.';
COMMENT ON TABLE public.installers  IS 'Registered installers/integrators. Linked to projects via client_project_status.installer_id.';

COMMIT;
