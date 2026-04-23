-- ============================================================================
-- Migration 0050: Cleanup — drop unused CRM tables, app_storage, storage_events
-- and remove legacy usina keys from clients.metadata
--
-- SAFE TO RUN: all statements are guarded with IF EXISTS / conditional checks.
-- DEPENDS ON: migrations 0033 + 0034 must have run first (usina data already
--             migrated from metadata → client_usina_config).
--
-- What this script does (in order):
--
--   SECTION A — Verify prerequisites
--     Checks that migrations 0032/0033/0034 have been applied (client_usina_config
--     exists) before touching metadata or dropping app_storage.
--
--   SECTION B — Remove residual usina keys from clients.metadata
--     The usina fields were migrated to client_usina_config by migration 0033,
--     and 0034 was supposed to clean them. This section is idempotent and
--     ensures the keys are gone even if 0034 was never applied.
--     Keys removed: potencia_modulo_wp, numero_modulos, modelo_modulo,
--                   modelo_inversor, tipo_instalacao, area_instalacao_m2,
--                   geracao_estimada_kwh
--
--   SECTION C — Drop legacy app_storage table
--     The app_storage table was the original key-value store.  It was replaced
--     by the storage table (migration 0038).  StorageService already performs a
--     one-time migration on startup (migrateLegacyStorage) and then reads from
--     storage.  Dropping app_storage prevents the fallback read on every request.
--
--   SECTION D — Drop unused CRM prototype tables
--     Created in migration 0003 (crm_schema.sql) but never queried by any
--     server or frontend code. No FK constraints outside the CRM group itself.
--     Tables dropped: deals, quotes, activities, contacts, pipeline_stages,
--                     pipelines, notes, users
--
--   SECTION E — Drop unused storage_events table
--     Created in migration 0001 but never written to or queried by the server.
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION A — Prerequisite guard
-- ============================================================================
-- Abort if client_usina_config does not exist, which means migrations 0032-0034
-- have not run yet and dropping app_storage or cleaning metadata would be unsafe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'client_usina_config'
  ) THEN
    RAISE EXCEPTION
      'Prerequisite check failed: table public.client_usina_config does not exist. '
      'Run migrations 0032, 0033, and 0034 before applying this cleanup migration.';
  END IF;
END
$$;

-- ============================================================================
-- SECTION B — Remove residual usina keys from clients.metadata
-- ============================================================================
-- Idempotent: uses the jsonb subtraction operator (-). If a key is already
-- absent the operation is a no-op for that row.

UPDATE public.clients
SET metadata = metadata
  - 'potencia_modulo_wp'
  - 'numero_modulos'
  - 'modelo_modulo'
  - 'modelo_inversor'
  - 'tipo_instalacao'
  - 'area_instalacao_m2'
  - 'geracao_estimada_kwh'
WHERE metadata IS NOT NULL
  AND (
    metadata ? 'potencia_modulo_wp'
    OR metadata ? 'numero_modulos'
    OR metadata ? 'modelo_modulo'
    OR metadata ? 'modelo_inversor'
    OR metadata ? 'tipo_instalacao'
    OR metadata ? 'area_instalacao_m2'
    OR metadata ? 'geracao_estimada_kwh'
  );

-- ============================================================================
-- SECTION C — Drop legacy app_storage table
-- ============================================================================
-- StorageService checks for app_storage on every initialisation via
-- to_regclass() and reads from it as a fallback.  Once dropped, that check
-- returns NULL and the fallback is skipped — no code change required.
--
-- BEFORE RUNNING: confirm that app_storage is either empty or that its rows
-- have already been migrated into the storage table by StorageService.
-- You can verify with:
--   SELECT count(*) FROM app_storage;
--   SELECT count(*) FROM storage;
-- If app_storage still has rows not present in storage, call the
-- /api/storage endpoint once (or wait for a deploy) to trigger the migration.

DROP TABLE IF EXISTS public.app_storage;

-- ============================================================================
-- SECTION D — Drop unused CRM prototype tables
-- ============================================================================
-- These tables were created by migration 0003 (crm_schema.sql) as part of an
-- early CRM prototype. They have never been queried, written to, or exposed by
-- any server route or frontend call. Drop order respects FK dependencies.
--
-- Notes:
--   · The internal "users" table (UUID PK) is separate from app_user_access
--     (Stack Auth integration) and is safe to drop.
--   · The public.notes CRM table is separate from public.client_notes
--     (portfolio notes — still in active use); only the CRM one is dropped.

DROP TABLE IF EXISTS public.activities;
DROP TABLE IF EXISTS public.quotes;
DROP TABLE IF EXISTS public.deals;
DROP TABLE IF EXISTS public.contacts;
DROP TABLE IF EXISTS public.pipeline_stages;
DROP TABLE IF EXISTS public.pipelines;
DROP TABLE IF EXISTS public.notes;       -- CRM notes, NOT client_notes (portfolio)
DROP TABLE IF EXISTS public.users;       -- CRM internal users, NOT app_user_access

-- ============================================================================
-- SECTION E — Drop unused storage_events table
-- ============================================================================
-- Created in migration 0001 and enabled with RLS in 0016, but never written
-- to or queried by server or frontend code.

DROP TABLE IF EXISTS public.storage_events;

-- ============================================================================

COMMIT;
