-- Migration: 0030_clients_in_portfolio_columns.sql
-- Adds portfolio-tracking columns directly to public.clients so that
-- "Negócio fechado" (portfolio-export) operates on the clients table
-- without requiring the client_lifecycle table from migration 0029.
--
-- Safe to re-run (uses ADD COLUMN IF NOT EXISTS).

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS in_portfolio                  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_exported_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portfolio_exported_by_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_in_portfolio
  ON public.clients (in_portfolio)
  WHERE in_portfolio = true;

COMMIT;
