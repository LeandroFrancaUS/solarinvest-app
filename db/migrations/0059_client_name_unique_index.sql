-- Migration: 0059_client_name_unique_index.sql
--
-- Adds a partial unique index to prevent duplicate active clients that share
-- the same normalized name and owner when no CPF or CNPJ is present.
--
-- This is a database-level safety net that prevents concurrent inserts (e.g.
-- two auto-save requests racing) from bypassing the application-level
-- deduplication checks implemented in the /api/clients handlers.
--
-- The index is PARTIAL (WHERE clause) so it only covers the case that is
-- susceptible to duplication — no-document clients — and never interferes
-- with legitimate clients that have distinct CPF/CNPJ values.
--
-- The normalization expression mirrors findClientByNormalizedName in
-- server/clients/repository.js so both layers use identical logic.
--
-- Safe to re-run (uses IF NOT EXISTS).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_name_owner_no_doc
  ON public.clients (
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
    owner_user_id
  )
  WHERE cpf_normalized IS NULL
    AND cnpj_normalized IS NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL;

COMMENT ON INDEX idx_clients_name_owner_no_doc IS
  'Prevents duplicate active clients with identical normalized names for the same owner when no CPF/CNPJ is stored.';

COMMIT;
