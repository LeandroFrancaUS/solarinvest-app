-- ============================================================================
-- Migration 0061: Partial Unique Index — Client Name Deduplication
-- ============================================================================
--
-- OBJETIVO:
--   Adicionar uma barreira no banco de dados para impedir a criação de clientes
--   duplicados com o mesmo nome normalizado e mesmo dono, quando o cliente não
--   possui CPF nem CNPJ nem está marcado como merged/deletado.
--
-- ESTRATÉGIA:
--   Índice único parcial em (lower(nome_normalizado), owner_user_id) aplicado
--   apenas a registros sem CPF e sem CNPJ que estejam ativos (não deletados,
--   não merged). Isso garante a unicidade como segunda linha de defesa além
--   da deduplicação feita pela aplicação.
--
-- SAFE TO RE-RUN: Sim, usa CREATE UNIQUE INDEX IF NOT EXISTS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_name_owner_no_doc
  ON public.clients (
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
    owner_user_id
  )
  WHERE cpf_normalized IS NULL
    AND cnpj_normalized IS NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL;

COMMENT ON INDEX public.idx_clients_name_owner_no_doc IS
  'Garante unicidade de nome normalizado + dono para clientes sem CPF/CNPJ ativos. '
  'Previne duplicatas criadas por auto-save, re-sync offline ou chamadas simultâneas.';
