-- Migration: Add is_contratante_titular to client_billing_profile
-- Description: Adds a flag to determine whether the contractor is the holder (true)
--              or SolarInvest is the holder (false). This affects which billing rule
--              is applied: standard rule vs GO/SolarInvest titularidade rule.

-- Add is_contratante_titular column with default true (standard rule)
ALTER TABLE public.client_billing_profile
ADD COLUMN IF NOT EXISTS is_contratante_titular BOOLEAN DEFAULT TRUE;

-- Add comment explaining the column
COMMENT ON COLUMN public.client_billing_profile.is_contratante_titular IS
'Flag indicating whether the contractor is the title holder (true = standard billing rule) or SolarInvest is the holder (false = GO/SolarInvest titularidade rule). Defaults to true.';
