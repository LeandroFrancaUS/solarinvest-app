-- ============================================================================
-- Migration 0058: Client Duplicate Prevention & Data Quality Guardrails
-- ============================================================================
--
-- OBJETIVO:
--   Prevenir duplicação desordenada de dados de clientes implementando:
--   1. Validação de UC (Unidade Consumidora) duplicada
--   2. Validação de endereço duplicado (mesmo CEP + número/quadra/lote + UC)
--   3. Campos normalizados para quadra e lote
--   4. Constraints de qualidade de dados para campos críticos
--   5. Índices compostos para detecção eficiente de duplicatas
--
-- REGRAS DE NEGÓCIO:
--   • Clientes podem ter mesmo nome SE tiverem UC diferente OU endereço diferente
--   • Endereços são considerados diferentes se:
--     - CEP diferente, OU
--     - Número diferente (extraído de logradouro ou numero), OU
--     - Quadra/lote diferente
--   • Não permitir mesmo CEP + mesmo número + mesma UC
--   • UC pode ser NULL (leads sem instalação ainda)
--   • Endereço pode ser NULL (leads iniciais)
--
-- SAFE TO RE-RUN: Sim, usa IF NOT EXISTS e ADD COLUMN IF NOT EXISTS
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Adicionar campos normalizados para endereço
-- ============================================================================

-- Campo para número extraído e normalizado (para comparação)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS numero_normalizado TEXT;

-- Campo para quadra extraída (bloco)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS quadra TEXT;

-- Campo para lote extraído
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lote TEXT;

-- Campo para indicador de cliente duplicado permitido (override manual)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS allow_duplicate BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.clients.numero_normalizado IS
  'Número do endereço extraído e normalizado de logradouro ou numero para detecção de duplicatas. '
  'Usado para comparação: mesmo CEP + mesmo número + mesma UC = duplicata não permitida.';

COMMENT ON COLUMN public.clients.quadra IS
  'Número da quadra (bloco) do endereço, comum em áreas rurais e loteamentos. '
  'Extraído de variações: Qd, Q, Quadra, etc.';

COMMENT ON COLUMN public.clients.lote IS
  'Número do lote do endereço, comum em loteamentos e áreas rurais. '
  'Extraído de variações: Lt, L, Lote, etc.';

COMMENT ON COLUMN public.clients.allow_duplicate IS
  'Override manual para permitir duplicata quando justificável (ex: múltiplas instalações no mesmo endereço). '
  'Padrão: FALSE. Requer aprovação administrativa para ser TRUE.';


-- ============================================================================
-- SECTION 2: Função para extrair número de endereço
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extract_numero_from_address(
  logradouro_text TEXT,
  numero_text TEXT
) RETURNS TEXT AS $$
DECLARE
  result TEXT;
  matched TEXT[];
BEGIN
  -- Prioridade 1: campo numero se tiver dígitos
  IF numero_text IS NOT NULL AND numero_text ~ '\d' THEN
    -- Extrair primeiro grupo de dígitos
    matched := regexp_match(numero_text, '(\d+)');
    IF matched IS NOT NULL THEN
      RETURN matched[1];
    END IF;
  END IF;

  -- Prioridade 2: extrair de logradouro
  -- Padrões comuns:
  --   "Rua ABC, 123"
  --   "Av. XYZ 456"
  --   "Rua ABC nº 789"
  --   "Rua ABC n. 321"
  --   "Rua ABC número 654"
  IF logradouro_text IS NOT NULL THEN
    -- Procurar por "n°", "nº", "n.", "número", "numero" seguido de dígitos
    matched := regexp_match(logradouro_text, 'n[úu]?m?[°º.]?\s*(\d+)', 'i');
    IF matched IS NOT NULL THEN
      RETURN matched[1];
    END IF;

    -- Procurar por vírgula seguida de dígitos: ", 123"
    matched := regexp_match(logradouro_text, ',\s*(\d+)');
    IF matched IS NOT NULL THEN
      RETURN matched[1];
    END IF;

    -- Procurar por último grupo de dígitos no final
    matched := regexp_match(logradouro_text, '\s+(\d+)\s*$');
    IF matched IS NOT NULL THEN
      RETURN matched[1];
    END IF;
  END IF;

  -- Não encontrado
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.extract_numero_from_address IS
  'Extrai o número do endereço de logradouro ou numero, '
  'tratando variações comuns de formatação.';


-- ============================================================================
-- SECTION 3: Função para extrair quadra e lote
-- ============================================================================

CREATE OR REPLACE FUNCTION public.extract_quadra_lote(
  logradouro_text TEXT,
  numero_text TEXT,
  complemento_text TEXT
) RETURNS TABLE(quadra_extracted TEXT, lote_extracted TEXT) AS $$
DECLARE
  combined_text TEXT;
  matched TEXT[];
BEGIN
  -- Combinar todos os campos de endereço para busca
  combined_text := coalesce(logradouro_text, '') || ' ' ||
                   coalesce(numero_text, '') || ' ' ||
                   coalesce(complemento_text, '');

  -- Extrair quadra: "Qd 12", "Q. 34", "Quadra 56", "QD. 78"
  matched := regexp_match(combined_text, 'q(?:uadra|d)?\.?\s*(\d+)', 'i');
  IF matched IS NOT NULL THEN
    quadra_extracted := matched[1];
  END IF;

  -- Extrair lote: "Lt 12", "L. 34", "Lote 56", "LT. 78"
  matched := regexp_match(combined_text, 'l(?:ote|t)?\.?\s*(\d+)', 'i');
  IF matched IS NOT NULL THEN
    lote_extracted := matched[1];
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.extract_quadra_lote IS
  'Extrai quadra e lote do endereço, tratando variações: Qd, Q, Lt, L, etc.';


-- ============================================================================
-- SECTION 4: Trigger para popular campos normalizados automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_client_address_fields()
RETURNS TRIGGER AS $$
DECLARE
  extracted_numero TEXT;
  extracted_data RECORD;
BEGIN
  -- Extrair e normalizar número
  extracted_numero := public.extract_numero_from_address(
    NEW.logradouro,
    NEW.numero
  );
  NEW.numero_normalizado := extracted_numero;

  -- Extrair quadra e lote
  SELECT quadra_extracted, lote_extracted INTO extracted_data
  FROM public.extract_quadra_lote(
    NEW.logradouro,
    NEW.numero,
    NEW.complemento
  );

  -- Atualizar apenas se não foram preenchidos manualmente
  IF NEW.quadra IS NULL OR NEW.quadra = '' THEN
    NEW.quadra := extracted_data.quadra_extracted;
  END IF;

  IF NEW.lote IS NULL OR NEW.lote = '' THEN
    NEW.lote := extracted_data.lote_extracted;
  END IF;

  -- Normalizar CEP (garantir 8 dígitos ou NULL)
  IF NEW.cep IS NOT NULL AND NEW.cep != '' THEN
    NEW.cep := regexp_replace(NEW.cep, '\D', '', 'g');
    IF length(NEW.cep) != 8 THEN
      NEW.cep := NULL;
    END IF;
  END IF;

  -- Sincronizar client_cep com cep
  IF NEW.client_cep IS NULL AND NEW.cep IS NOT NULL THEN
    NEW.client_cep := NEW.cep;
  ELSIF NEW.cep IS NULL AND NEW.client_cep IS NOT NULL THEN
    NEW.cep := NEW.client_cep;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_client_address
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_client_address_fields();

COMMENT ON TRIGGER trigger_normalize_client_address ON public.clients IS
  'Automaticamente extrai e normaliza número, quadra e lote do endereço antes de inserir/atualizar.';


-- ============================================================================
-- SECTION 5: Índices compostos para detecção de duplicatas
-- ============================================================================

-- Índice composto: CEP + número normalizado + UC geradora
-- Usado para detecção rápida de endereço + UC duplicados
CREATE INDEX IF NOT EXISTS idx_clients_address_uc_dedup
  ON public.clients (cep, numero_normalizado, uc_geradora)
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND allow_duplicate = FALSE
    AND cep IS NOT NULL
    AND numero_normalizado IS NOT NULL
    AND uc_geradora IS NOT NULL;

COMMENT ON INDEX idx_clients_address_uc_dedup IS
  'Detecta duplicatas: mesmo CEP + mesmo número + mesma UC (apenas clientes ativos sem override).';

-- Índice composto: CEP + quadra + lote + UC geradora
-- Para áreas rurais onde número não é usado
CREATE INDEX IF NOT EXISTS idx_clients_address_quadra_lote_uc_dedup
  ON public.clients (cep, quadra, lote, uc_geradora)
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND allow_duplicate = FALSE
    AND cep IS NOT NULL
    AND quadra IS NOT NULL
    AND lote IS NOT NULL
    AND uc_geradora IS NOT NULL;

COMMENT ON INDEX idx_clients_address_quadra_lote_uc_dedup IS
  'Detecta duplicatas em endereços rurais: mesmo CEP + mesma quadra + mesmo lote + mesma UC.';

-- Índice para UC geradora (detecção de UC duplicada independente de endereço)
CREATE INDEX IF NOT EXISTS idx_clients_uc_geradora_active
  ON public.clients (uc_geradora)
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND uc_geradora IS NOT NULL
    AND uc_geradora != '';

COMMENT ON INDEX idx_clients_uc_geradora_active IS
  'Busca rápida por UC geradora em clientes ativos (para validação de duplicatas).';


-- ============================================================================
-- SECTION 6: View para detecção de duplicatas
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_client_duplicate_candidates AS
SELECT
  c.id,
  c.client_name,
  c.cpf_normalized,
  c.cnpj_normalized,
  c.uc_geradora,
  c.uc_beneficiaria,
  c.cep,
  c.numero_normalizado,
  c.quadra,
  c.lote,
  c.logradouro,
  c.client_city,
  c.client_state,
  c.allow_duplicate,
  c.created_at,
  c.updated_at,
  -- Identificar tipo de possível duplicata
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.clients c2
      WHERE c2.id != c.id
        AND c2.deleted_at IS NULL
        AND c2.merged_into_client_id IS NULL
        AND c2.uc_geradora = c.uc_geradora
        AND c2.uc_geradora IS NOT NULL
        AND c2.uc_geradora != ''
        AND c.uc_geradora IS NOT NULL
        AND c.uc_geradora != ''
    ) THEN 'UC_DUPLICADA'
    WHEN EXISTS (
      SELECT 1 FROM public.clients c2
      WHERE c2.id != c.id
        AND c2.deleted_at IS NULL
        AND c2.merged_into_client_id IS NULL
        AND c2.cep = c.cep
        AND c2.numero_normalizado = c.numero_normalizado
        AND c2.cep IS NOT NULL
        AND c2.numero_normalizado IS NOT NULL
        AND c.cep IS NOT NULL
        AND c.numero_normalizado IS NOT NULL
    ) THEN 'ENDERECO_DUPLICADO_CEP_NUMERO'
    WHEN EXISTS (
      SELECT 1 FROM public.clients c2
      WHERE c2.id != c.id
        AND c2.deleted_at IS NULL
        AND c2.merged_into_client_id IS NULL
        AND c2.cep = c.cep
        AND c2.quadra = c.quadra
        AND c2.lote = c.lote
        AND c2.cep IS NOT NULL
        AND c2.quadra IS NOT NULL
        AND c2.lote IS NOT NULL
        AND c.cep IS NOT NULL
        AND c.quadra IS NOT NULL
        AND c.lote IS NOT NULL
    ) THEN 'ENDERECO_DUPLICADO_QUADRA_LOTE'
    ELSE NULL
  END AS tipo_duplicata
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.allow_duplicate = FALSE;

COMMENT ON VIEW public.vw_client_duplicate_candidates IS
  'Identifica clientes que podem ser duplicatas baseado em UC e/ou endereço. '
  'Tipos: UC_DUPLICADA, ENDERECO_DUPLICADO_CEP_NUMERO, ENDERECO_DUPLICADO_QUADRA_LOTE.';


-- ============================================================================
-- SECTION 7: Constraints de qualidade de dados
-- ============================================================================

-- Constraint: UC geradora não pode ser apenas espaços ou caracteres inválidos
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS check_uc_geradora_valid;

ALTER TABLE public.clients
  ADD CONSTRAINT check_uc_geradora_valid
  CHECK (
    uc_geradora IS NULL
    OR (
      btrim(uc_geradora) != ''
      AND uc_geradora !~ '^\s*$'
      AND uc_geradora !~ '^(null|undefined|0|N/A|n/a)$'
    )
  );

-- Constraint: CEP deve ter exatamente 8 dígitos se presente
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS check_cep_format;

ALTER TABLE public.clients
  ADD CONSTRAINT check_cep_format
  CHECK (
    cep IS NULL
    OR (cep ~ '^\d{8}$')
  );

-- Constraint: client_cep deve ter exatamente 8 dígitos se presente
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS check_client_cep_format;

ALTER TABLE public.clients
  ADD CONSTRAINT check_client_cep_format
  CHECK (
    client_cep IS NULL
    OR (client_cep ~ '^\d{8}$')
  );

-- Constraint: Telefone deve ter pelo menos 10 dígitos se presente
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS check_client_phone_format;

ALTER TABLE public.clients
  ADD CONSTRAINT check_client_phone_format
  CHECK (
    client_phone IS NULL
    OR length(regexp_replace(client_phone, '\D', '', 'g')) >= 10
  );

-- Constraint: Email deve conter @ se presente
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS check_client_email_format;

ALTER TABLE public.clients
  ADD CONSTRAINT check_client_email_format
  CHECK (
    client_email IS NULL
    OR client_email ~ '@'
  );

-- Constraint: Nome não pode ser placeholder inválido
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS check_client_name_not_placeholder;

ALTER TABLE public.clients
  ADD CONSTRAINT check_client_name_not_placeholder
  CHECK (
    client_name IS NULL
    OR (
      btrim(client_name) != ''
      AND lower(btrim(client_name)) NOT IN (
        '0', 'null', 'undefined', '[object object]', '{}', '[]',
        'nan', 'n/a', 'na', '-', '—', '__', '??', 'test', 'teste',
        'cliente', 'client', 'nome', 'name'
      )
    )
  );


-- ============================================================================
-- SECTION 8: Backfill dos campos normalizados para clientes existentes
-- ============================================================================

-- Popular numero_normalizado, quadra, lote para registros existentes
UPDATE public.clients
SET
  numero_normalizado = public.extract_numero_from_address(logradouro, numero),
  quadra = (SELECT quadra_extracted FROM public.extract_quadra_lote(logradouro, numero, complemento)),
  lote = (SELECT lote_extracted FROM public.extract_quadra_lote(logradouro, numero, complemento))
WHERE deleted_at IS NULL
  AND (numero_normalizado IS NULL OR quadra IS NULL OR lote IS NULL);

-- Normalizar CEP para registros existentes
UPDATE public.clients
SET cep = regexp_replace(cep, '\D', '', 'g')
WHERE cep IS NOT NULL
  AND cep ~ '\D'
  AND deleted_at IS NULL;

-- Remover CEPs inválidos (não têm 8 dígitos)
UPDATE public.clients
SET cep = NULL
WHERE cep IS NOT NULL
  AND length(cep) != 8
  AND deleted_at IS NULL;

-- Sincronizar client_cep com cep
UPDATE public.clients
SET client_cep = cep
WHERE client_cep IS NULL
  AND cep IS NOT NULL
  AND deleted_at IS NULL;


-- ============================================================================
-- SECTION 9: Função auxiliar para API - verificar duplicata
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_client_duplicate(
  p_uc_geradora TEXT,
  p_cep TEXT,
  p_numero_normalizado TEXT,
  p_quadra TEXT,
  p_lote TEXT,
  p_exclude_client_id BIGINT DEFAULT NULL
) RETURNS TABLE(
  duplicate_found BOOLEAN,
  duplicate_type TEXT,
  duplicate_client_id BIGINT,
  duplicate_client_name TEXT,
  duplicate_uc_geradora TEXT,
  duplicate_address TEXT
) AS $$
BEGIN
  -- Verificar duplicata por UC geradora
  IF p_uc_geradora IS NOT NULL AND btrim(p_uc_geradora) != '' THEN
    RETURN QUERY
    SELECT
      TRUE AS duplicate_found,
      'UC_DUPLICADA' AS duplicate_type,
      c.id AS duplicate_client_id,
      c.client_name AS duplicate_client_name,
      c.uc_geradora AS duplicate_uc_geradora,
      coalesce(c.logradouro, '') || ' ' || coalesce(c.numero, '') || ' - ' ||
        coalesce(c.client_city, '') || '/' || coalesce(c.client_state, '') AS duplicate_address
    FROM public.clients c
    WHERE c.uc_geradora = p_uc_geradora
      AND c.deleted_at IS NULL
      AND c.merged_into_client_id IS NULL
      AND c.allow_duplicate = FALSE
      AND (p_exclude_client_id IS NULL OR c.id != p_exclude_client_id)
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Verificar duplicata por endereço (CEP + número)
  IF p_cep IS NOT NULL AND p_numero_normalizado IS NOT NULL THEN
    RETURN QUERY
    SELECT
      TRUE AS duplicate_found,
      'ENDERECO_DUPLICADO' AS duplicate_type,
      c.id AS duplicate_client_id,
      c.client_name AS duplicate_client_name,
      c.uc_geradora AS duplicate_uc_geradora,
      coalesce(c.logradouro, '') || ' ' || coalesce(c.numero, '') || ' - ' ||
        coalesce(c.client_city, '') || '/' || coalesce(c.client_state, '') AS duplicate_address
    FROM public.clients c
    WHERE c.cep = p_cep
      AND c.numero_normalizado = p_numero_normalizado
      AND c.deleted_at IS NULL
      AND c.merged_into_client_id IS NULL
      AND c.allow_duplicate = FALSE
      AND (p_exclude_client_id IS NULL OR c.id != p_exclude_client_id)
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Verificar duplicata por endereço (CEP + quadra + lote)
  IF p_cep IS NOT NULL AND p_quadra IS NOT NULL AND p_lote IS NOT NULL THEN
    RETURN QUERY
    SELECT
      TRUE AS duplicate_found,
      'ENDERECO_DUPLICADO_QUADRA_LOTE' AS duplicate_type,
      c.id AS duplicate_client_id,
      c.client_name AS duplicate_client_name,
      c.uc_geradora AS duplicate_uc_geradora,
      coalesce(c.logradouro, '') || ' Qd ' || coalesce(c.quadra, '') ||
        ' Lt ' || coalesce(c.lote, '') || ' - ' ||
        coalesce(c.client_city, '') || '/' || coalesce(c.client_state, '') AS duplicate_address
    FROM public.clients c
    WHERE c.cep = p_cep
      AND c.quadra = p_quadra
      AND c.lote = p_lote
      AND c.deleted_at IS NULL
      AND c.merged_into_client_id IS NULL
      AND c.allow_duplicate = FALSE
      AND (p_exclude_client_id IS NULL OR c.id != p_exclude_client_id)
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Nenhuma duplicata encontrada
  RETURN QUERY
  SELECT
    FALSE AS duplicate_found,
    NULL::TEXT AS duplicate_type,
    NULL::BIGINT AS duplicate_client_id,
    NULL::TEXT AS duplicate_client_name,
    NULL::TEXT AS duplicate_uc_geradora,
    NULL::TEXT AS duplicate_address;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.check_client_duplicate IS
  'Verifica se um cliente com os dados fornecidos já existe (duplicata). '
  'Retorna informações do cliente duplicado se encontrado. '
  'Usado pela API antes de criar/atualizar clientes.';


COMMIT;

-- ============================================================================
-- FIM DA MIGRATION 0058
-- ============================================================================
