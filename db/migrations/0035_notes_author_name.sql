-- Migration: 0035_notes_author_name.sql
-- Adds created_by_name column to client_notes for displaying author names
-- without requiring a user lookup join.
-- Safe to re-run (idempotent via IF NOT EXISTS).

BEGIN;

ALTER TABLE public.client_notes
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

COMMIT;
