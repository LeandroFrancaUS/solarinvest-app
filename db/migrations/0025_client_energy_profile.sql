-- Migration: Create client_energy_profile table and add UC uniqueness index
--
-- Stores energy/commercial data collected during bulk import.
-- Kept separate from clients for scalability.

BEGIN;

-- 1) Create client_energy_profile table
CREATE TABLE IF NOT EXISTS public.client_energy_profile (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kwh_contratado      NUMERIC(12, 2),
  potencia_kwp        NUMERIC(10, 3),
  tipo_rede           TEXT,
  tarifa_atual        NUMERIC(10, 6),
  desconto_percentual NUMERIC(5, 2),
  mensalidade         NUMERIC(12, 2),
  indicacao           TEXT,
  modalidade          TEXT,
  prazo_meses         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_energy_profile_client_id_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_energy_profile_client_id
  ON public.client_energy_profile (client_id);

-- 2) Add partial unique index on UC (one active client per UC)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_uc_unique
  ON public.clients (uc)
  WHERE uc IS NOT NULL
    AND btrim(uc) <> ''
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL;

-- 3) Enable RLS on client_energy_profile and add policies that piggy-back
--    on the clients table RLS (same owner scoping).
ALTER TABLE public.client_energy_profile ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: user can read profiles for clients they can access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_energy_profile'
      AND policyname = 'energy_profile_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY energy_profile_select
        ON public.client_energy_profile
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_energy_profile.client_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- INSERT: user can insert profiles for clients they own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_energy_profile'
      AND policyname = 'energy_profile_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY energy_profile_insert
        ON public.client_energy_profile
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_energy_profile.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- UPDATE: user can update profiles for clients they own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_energy_profile'
      AND policyname = 'energy_profile_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY energy_profile_update
        ON public.client_energy_profile
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = client_energy_profile.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;
END
$$;

COMMENT ON TABLE public.client_energy_profile IS
  'Energy and commercial profile data collected during import, kept separate from clients for scalability.';
COMMENT ON COLUMN public.client_energy_profile.kwh_contratado IS
  'Monthly energy consumption in kWh contracted by the client.';
COMMENT ON COLUMN public.client_energy_profile.potencia_kwp IS
  'System power in kWp.';
COMMENT ON COLUMN public.client_energy_profile.tipo_rede IS
  'Grid type (e.g., monofásico, bifásico, trifásico).';
COMMENT ON COLUMN public.client_energy_profile.tarifa_atual IS
  'Current energy tariff in R$/kWh.';
COMMENT ON COLUMN public.client_energy_profile.desconto_percentual IS
  'Discount percentage applied to the tariff.';
COMMENT ON COLUMN public.client_energy_profile.mensalidade IS
  'Monthly fee in R$.';
COMMENT ON COLUMN public.client_energy_profile.indicacao IS
  'Lead origin / referral source.';
COMMENT ON COLUMN public.client_energy_profile.modalidade IS
  'Contract modality (e.g., leasing, venda).';
COMMENT ON COLUMN public.client_energy_profile.prazo_meses IS
  'Contractual term in months.';

COMMIT;
