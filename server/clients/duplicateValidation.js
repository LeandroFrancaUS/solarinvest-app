/**
 * Client Duplicate Detection Middleware
 *
 * Validates that a client being created/updated doesn't conflict with
 * existing clients based on:
 * - UC (Unidade Consumidora) geradora
 * - Address (CEP + número or CEP + quadra + lote)
 *
 * Uses database function check_client_duplicate() from migration 0058.
 */

/**
 * Extract número from address fields using same logic as DB function
 * @param {string|null} logradouro - Street address
 * @param {string|null} numero - Building number
 * @returns {string|null} Normalized number
 */
function extractNumeroFromAddress(logradouro, numero) {
  // Priority 1: numero field if it has digits
  if (numero && /\d/.test(numero)) {
    const match = numero.match(/(\d+)/);
    if (match) return match[1];
  }

  // Priority 2: extract from logradouro
  if (logradouro) {
    // Look for "n°", "nº", "n.", "número", "numero" followed by digits
    let match = logradouro.match(/n[úu]?m?[°º.]?\s*(\d+)/i);
    if (match) return match[1];

    // Look for comma followed by digits: ", 123"
    match = logradouro.match(/,\s*(\d+)/);
    if (match) return match[1];

    // Look for last group of digits at the end
    match = logradouro.match(/\s+(\d+)\s*$/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract quadra and lote from address fields
 * @param {string|null} logradouro - Street address
 * @param {string|null} numero - Building number
 * @param {string|null} complemento - Address complement
 * @returns {{quadra: string|null, lote: string|null}}
 */
function extractQuadraLote(logradouro, numero, complemento) {
  const combinedText = [logradouro, numero, complemento]
    .filter(Boolean)
    .join(' ');

  const result = { quadra: null, lote: null };

  // Extract quadra: "Qd 12", "Q. 34", "Quadra 56", "QD. 78"
  const quadraMatch = combinedText.match(/q(?:uadra|d)?\.?\s*(\d+)/i);
  if (quadraMatch) {
    result.quadra = quadraMatch[1];
  }

  // Extract lote: "Lt 12", "L. 34", "Lote 56", "LT. 78"
  const loteMatch = combinedText.match(/l(?:ote|t)?\.?\s*(\d+)/i);
  if (loteMatch) {
    result.lote = loteMatch[1];
  }

  return result;
}

/**
 * Normalize CEP to 8 digits (remove formatting)
 * @param {string|null|undefined} cep - CEP value
 * @returns {string|null}
 */
function normalizeCep(cep) {
  if (!cep) return null;
  const digits = String(cep).replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
}

/**
 * Check if a client with the given data already exists (duplicate detection)
 *
 * @param {import('postgres').Sql} sql - Postgres.js instance
 * @param {object} clientData - Client data to check
 * @param {string|null} clientData.uc_geradora - UC geradora
 * @param {string|null} clientData.cep - CEP (will be normalized)
 * @param {string|null} clientData.logradouro - Street address
 * @param {string|null} clientData.numero - Building number
 * @param {string|null} clientData.complemento - Address complement
 * @param {string|null} clientData.quadra - Block/quadra (optional, will be extracted if not provided)
 * @param {string|null} clientData.lote - Lot (optional, will be extracted if not provided)
 * @param {number|null} excludeClientId - Client ID to exclude from check (for updates)
 * @returns {Promise<{isDuplicate: boolean, duplicateInfo: object|null}>}
 */
async function checkClientDuplicate(sql, clientData, excludeClientId = null) {
  const {
    uc_geradora,
    cep: rawCep,
    logradouro,
    numero,
    complemento,
    quadra: providedQuadra,
    lote: providedLote,
  } = clientData;

  // Normalize inputs
  const cepNormalized = normalizeCep(rawCep);
  const numeroNormalizado = extractNumeroFromAddress(logradouro, numero);
  const { quadra: extractedQuadra, lote: extractedLote } = extractQuadraLote(
    logradouro,
    numero,
    complemento
  );
  const quadra = providedQuadra || extractedQuadra;
  const lote = providedLote || extractedLote;

  // Call database function to check for duplicates
  const result = await sql`
    SELECT
      duplicate_found,
      duplicate_type,
      duplicate_client_id,
      duplicate_client_name,
      duplicate_uc_geradora,
      duplicate_address
    FROM public.check_client_duplicate(
      ${uc_geradora || null},
      ${cepNormalized || null},
      ${numeroNormalizado || null},
      ${quadra || null},
      ${lote || null},
      ${excludeClientId || null}
    )
  `;

  if (!result || result.length === 0) {
    return { isDuplicate: false, duplicateInfo: null };
  }

  const row = result[0];

  if (!row.duplicate_found) {
    return { isDuplicate: false, duplicateInfo: null };
  }

  return {
    isDuplicate: true,
    duplicateInfo: {
      type: row.duplicate_type,
      clientId: row.duplicate_client_id,
      clientName: row.duplicate_client_name,
      ucGeradora: row.duplicate_uc_geradora,
      address: row.duplicate_address,
    },
  };
}

/**
 * Validate client data before create/update to prevent duplicates
 * Returns validation result with user-friendly error message
 *
 * @param {import('postgres').Sql} sql - Postgres.js instance
 * @param {object} clientData - Client data to validate
 * @param {number|null} existingClientId - For updates, the ID of the client being updated
 * @returns {Promise<{ok: boolean, error?: string, errorCode?: string, duplicateInfo?: object}>}
 */
async function validateClientDuplicates(sql, clientData, existingClientId = null) {
  try {
    const { isDuplicate, duplicateInfo } = await checkClientDuplicate(
      sql,
      clientData,
      existingClientId
    );

    if (!isDuplicate) {
      return { ok: true };
    }

    // Generate user-friendly error message based on duplicate type
    let errorMessage = '';
    let errorCode = '';

    switch (duplicateInfo.type) {
      case 'UC_DUPLICADA':
        errorCode = 'DUPLICATE_UC';
        errorMessage = `Já existe um cliente com a mesma UC (${duplicateInfo.ucGeradora}). ` +
          `Cliente existente: "${duplicateInfo.clientName}" (ID: ${duplicateInfo.clientId}). ` +
          `Não é possível cadastrar o mesmo número de UC para dois clientes diferentes. ` +
          `Se este é um novo contrato para o mesmo endereço, edite o cliente existente.`;
        break;

      case 'ENDERECO_DUPLICADO':
        errorCode = 'DUPLICATE_ADDRESS';
        errorMessage = `Já existe um cliente no mesmo endereço (CEP e número idênticos). ` +
          `Cliente existente: "${duplicateInfo.clientName}" no endereço ${duplicateInfo.address}. ` +
          `Para cadastrar uma nova UC no mesmo endereço, é necessário que a UC seja diferente. ` +
          `Se este é o mesmo cliente, edite o cadastro existente ao invés de criar um novo.`;
        break;

      case 'ENDERECO_DUPLICADO_QUADRA_LOTE':
        errorCode = 'DUPLICATE_ADDRESS_QUADRA_LOTE';
        errorMessage = `Já existe um cliente no mesmo endereço (CEP, quadra e lote idênticos). ` +
          `Cliente existente: "${duplicateInfo.clientName}" no endereço ${duplicateInfo.address}. ` +
          `Para cadastrar uma nova UC no mesmo endereço, é necessário que a UC seja diferente. ` +
          `Se este é o mesmo cliente, edite o cadastro existente ao invés de criar um novo.`;
        break;

      default:
        errorCode = 'DUPLICATE_CLIENT';
        errorMessage = `Já existe um cliente com dados similares. ` +
          `Cliente existente: "${duplicateInfo.clientName}" (ID: ${duplicateInfo.clientId}). ` +
          `Verifique se este cliente já não está cadastrado.`;
    }

    return {
      ok: false,
      error: errorMessage,
      errorCode,
      duplicateInfo,
    };
  } catch (err) {
    // Graceful fallback: if the database function doesn't exist (migration 0058 not run),
    // allow the operation to proceed without duplicate validation
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('function public.check_client_duplicate') ||
        errorMessage.includes('does not exist')) {
      console.warn('[duplicate-validation] DB function not available (migration 0058 pending), skipping validation:', errorMessage);
      return { ok: true };
    }
    // Re-throw other errors
    throw err;
  }
}

export {
  checkClientDuplicate,
  validateClientDuplicates,
  extractNumeroFromAddress,
  extractQuadraLote,
  normalizeCep,
};
