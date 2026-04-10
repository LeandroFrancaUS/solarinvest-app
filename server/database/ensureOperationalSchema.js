// Ensures critical tables/columns used by runtime APIs exist.
// This is a safety net for environments where migrations were not fully applied.

let ensurePromise = null

export async function ensureOperationalSchema(sql) {
  if (ensurePromise) {
    return ensurePromise
  }

  ensurePromise = (async () => {
    await sql('BEGIN')
    try {
      await sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

      await sql(`
        CREATE TABLE IF NOT EXISTS public.clients (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          document TEXT,
          email TEXT,
          phone TEXT,
          city TEXT,
          state TEXT,
          address TEXT,
          uc TEXT,
          distribuidora TEXT,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `)

      await sql(`
        ALTER TABLE public.clients
          ADD COLUMN IF NOT EXISTS cpf_normalized TEXT,
          ADD COLUMN IF NOT EXISTS cpf_raw TEXT,
          ADD COLUMN IF NOT EXISTS cnpj_normalized TEXT,
          ADD COLUMN IF NOT EXISTS cnpj_raw TEXT,
          ADD COLUMN IF NOT EXISTS document_type TEXT,
          ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'pending_cpf',
          ADD COLUMN IF NOT EXISTS merged_into_client_id BIGINT,
          ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
          ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
          ADD COLUMN IF NOT EXISTS owner_stack_user_id TEXT,
          ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'online',
          ADD COLUMN IF NOT EXISTS offline_origin_id TEXT,
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
      `)

      await sql(`
        CREATE TABLE IF NOT EXISTS public.proposals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_type TEXT NOT NULL DEFAULT 'venda',
          proposal_code TEXT,
          version INT NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'draft',
          owner_user_id TEXT NOT NULL DEFAULT '',
          owner_email TEXT,
          owner_display_name TEXT,
          created_by_user_id TEXT NOT NULL DEFAULT '',
          updated_by_user_id TEXT,
          client_name TEXT,
          client_document TEXT,
          client_city TEXT,
          client_state TEXT,
          client_phone TEXT,
          client_email TEXT,
          consumption_kwh_month NUMERIC,
          system_kwp NUMERIC,
          capex_total NUMERIC,
          contract_value NUMERIC,
          term_months INT,
          payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          client_id BIGINT,
          offline_origin_id TEXT,
          is_pending_sync BOOLEAN NOT NULL DEFAULT FALSE,
          is_conflicted BOOLEAN NOT NULL DEFAULT FALSE,
          conflict_reason TEXT,
          synced_at TIMESTAMPTZ,
          uc_geradora_numero TEXT,
          draft_source TEXT,
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)

      await sql(`
        CREATE TABLE IF NOT EXISTS public.client_audit_log (
          id BIGSERIAL PRIMARY KEY,
          client_id BIGINT NOT NULL,
          actor_user_id TEXT,
          actor_email TEXT,
          action TEXT NOT NULL,
          old_value_json JSONB,
          new_value_json JSONB,
          changed_by_admin_id TEXT,
          reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)

      await sql(`
        CREATE TABLE IF NOT EXISTS public.proposal_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_id UUID NOT NULL,
          actor_user_id TEXT NOT NULL,
          actor_email TEXT,
          action TEXT NOT NULL,
          old_value_json JSONB,
          new_value_json JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)

      await sql(`
        CREATE TABLE IF NOT EXISTS public.app_user_profiles (
          stack_user_id TEXT PRIMARY KEY,
          primary_role TEXT NOT NULL DEFAULT 'unknown',
          email TEXT,
          display_name TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)

      await sql('COMMIT')
    } catch (error) {
      await sql('ROLLBACK')
      ensurePromise = null
      throw error
    }
  })()

  return ensurePromise
}
