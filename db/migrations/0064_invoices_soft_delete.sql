-- Migration 0064: Add soft-delete column to client_invoices
-- Replaces hard DELETE with a logical deletion flag so invoice history
-- is preserved for audit and financial reconciliation purposes.
--
-- After applying this migration:
--   • deleted_at IS NULL  → active invoice (visible to users)
--   • deleted_at IS NOT NULL → soft-deleted (hidden from normal queries)
--
-- This is an additive-only migration — no data is deleted or modified.

ALTER TABLE public.client_invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index: only un-deleted invoices participate in uniqueness checks.
CREATE INDEX IF NOT EXISTS client_invoices_active_idx
  ON public.client_invoices (client_id, reference_month)
  WHERE deleted_at IS NULL;
