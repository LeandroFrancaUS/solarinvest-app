-- ============================================================================
-- client_duplicates_audit.sql
-- ============================================================================
--
-- Read-only diagnostic queries for auditing duplicate client records in the
-- NeonDB `clients` table.  All queries are SELECT-only — safe to run on
-- production at any time without modifying data.
--
-- USAGE:
--   Run these queries in the NeonDB SQL editor or via psql.
--   Review each result before proceeding to db/fix_duplicate_clients.sql.
--
-- SECTIONS:
--   1. Infrastructure check  — verify migration 0059 index is applied
--   2. General counts        — active vs deleted vs merged
--   3. Same-owner duplicates — clients with identical name + owner (race cond.)
--   4. Cross-owner duplicates — same name owned by different users
--   5. offline_origin_id duplicates — idempotency key collisions
--   6. Summary               — one-row overview of all duplicate categories
--
-- ============================================================================


-- ============================================================================
-- SECTION 1 — Infrastructure: verify migration 0059 index exists
-- ============================================================================

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'clients'
  AND indexname = 'idx_clients_name_owner_no_doc';

-- Expected: one row.
-- If no rows: the unique-index safety net is MISSING — run migration 0059
-- immediately to prevent future race-condition duplicates.


-- ============================================================================
-- SECTION 2 — General counts
-- ============================================================================

SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL)
    AS clientes_ativos,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
    AS soft_deletados,
  COUNT(*) FILTER (WHERE merged_into_client_id IS NOT NULL)
    AS merged,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
  ) AS sem_documento,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND offline_origin_id IS NOT NULL
  ) AS com_offline_origin_id
FROM public.clients;


-- ============================================================================
-- SECTION 3 — Same-owner duplicates (race condition / auto-save retries)
-- ============================================================================

-- 3a. How many duplicate groups exist?
SELECT
  COUNT(*) AS total_clientes_duplicados,
  COUNT(DISTINCT (
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
    owner_user_id
  )) AS grupos_duplicados
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NULL
  AND cnpj_normalized IS NULL
  AND (
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
    owner_user_id
  ) IN (
    SELECT
      lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
      owner_user_id
    FROM public.clients
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  );

-- 3b. Top 50 same-owner duplicate groups (sorted by count desc)
SELECT
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS nome_normalizado,
  owner_user_id,
  COUNT(*) AS qtd_duplicatas,
  MIN(created_at)  AS primeiro_criado,
  MAX(created_at)  AS ultimo_criado,
  MAX(created_at) - MIN(created_at) AS intervalo,
  array_agg(id ORDER BY created_at) AS ids
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NULL
  AND cnpj_normalized IS NULL
GROUP BY
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
  owner_user_id
HAVING COUNT(*) > 1
ORDER BY qtd_duplicatas DESC, nome_normalizado
LIMIT 50;


-- ============================================================================
-- SECTION 4 — Cross-owner duplicates (same name, different owners)
-- Causes inflated client list for admin/diretoria users
-- ============================================================================

SELECT
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS nome_normalizado,
  COUNT(DISTINCT owner_user_id) AS qtd_owners,
  COUNT(*) AS total_registros,
  array_agg(DISTINCT owner_user_id) AS owners,
  array_agg(id ORDER BY created_at) AS ids
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NULL
  AND cnpj_normalized IS NULL
GROUP BY 1
HAVING COUNT(DISTINCT owner_user_id) > 1
ORDER BY total_registros DESC
LIMIT 50;


-- ============================================================================
-- SECTION 5 — offline_origin_id duplicates (idempotency key collisions)
-- These should never happen; if present, indicates a sync engine bug
-- ============================================================================

SELECT
  offline_origin_id,
  COUNT(*) AS qtd,
  array_agg(id ORDER BY created_at) AS ids,
  array_agg(client_name ORDER BY created_at) AS nomes,
  MIN(created_at) AS primeiro_criado,
  MAX(created_at) AS ultimo_criado
FROM public.clients
WHERE deleted_at IS NULL
  AND offline_origin_id IS NOT NULL
GROUP BY offline_origin_id
HAVING COUNT(*) > 1
ORDER BY qtd DESC
LIMIT 20;


-- ============================================================================
-- SECTION 6 — One-row summary
-- ============================================================================

WITH same_owner_dupes AS (
  SELECT COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND cpf_normalized IS NULL
    AND cnpj_normalized IS NULL
    AND (
      lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
      owner_user_id
    ) IN (
      SELECT
        lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
        owner_user_id
      FROM public.clients
      WHERE deleted_at IS NULL
        AND merged_into_client_id IS NULL
        AND cpf_normalized IS NULL
        AND cnpj_normalized IS NULL
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    )
),
cross_owner_dupes AS (
  SELECT COUNT(*) AS cnt
  FROM (
    SELECT 1
    FROM public.clients
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
    GROUP BY lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
    HAVING COUNT(DISTINCT owner_user_id) > 1
  ) t
),
offline_origin_dupes AS (
  SELECT COUNT(*) AS cnt
  FROM (
    SELECT 1
    FROM public.clients
    WHERE deleted_at IS NULL
      AND offline_origin_id IS NOT NULL
    GROUP BY offline_origin_id
    HAVING COUNT(*) > 1
  ) t
),
index_ok AS (
  SELECT COUNT(*) > 0 AS exists
  FROM pg_indexes
  WHERE tablename = 'clients'
    AND indexname = 'idx_clients_name_owner_no_doc'
)
SELECT
  so.cnt  AS same_owner_duplicate_rows,
  co.cnt  AS cross_owner_duplicate_name_groups,
  oo.cnt  AS offline_origin_id_collision_groups,
  io.exists AS migration_0059_index_present
FROM same_owner_dupes so, cross_owner_dupes co, offline_origin_dupes oo, index_ok io;
