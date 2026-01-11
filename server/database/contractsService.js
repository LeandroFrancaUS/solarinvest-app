/**
 * Service for managing contracts in Neon database
 */
export class ContractsService {
  constructor(sql) {
    this.sql = sql
  }

  /**
   * Ensure contracts table exists
   */
  async ensureInitialized() {
    await this.sql`
      CREATE TABLE IF NOT EXISTS contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
        uf TEXT NOT NULL,
        template_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'generated',
        contract_type TEXT,
        file_url TEXT,
        file_path TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await this.sql`
      CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id)
    `

    await this.sql`
      CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id)
    `
  }

  /**
   * Create a contract record
   * @param {string} userId - User ID
   * @param {object} contractData - Contract data
   * @returns {Promise<object>} Created contract
   */
  async createContract(userId, contractData) {
    await this.ensureInitialized()

    const {
      clientId,
      uf,
      templateKey,
      status = 'generated',
      contractType,
      fileUrl,
      filePath,
      metadata
    } = contractData

    const metadataJson = metadata ? JSON.stringify(metadata) : null

    const rows = await this.sql`
      INSERT INTO contracts (
        user_id, client_id, uf, template_key, status,
        contract_type, file_url, file_path, metadata,
        created_at, updated_at
      )
      VALUES (
        ${userId}, ${clientId || null}, ${uf}, ${templateKey},
        ${status}, ${contractType || null}, ${fileUrl || null},
        ${filePath || null}, ${metadataJson}::jsonb,
        now(), now()
      )
      RETURNING *
    `

    return rows[0]
  }

  /**
   * List contracts for a user
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Contracts list with pagination
   */
  async listContracts(userId, options = {}) {
    await this.ensureInitialized()

    const page = Math.max(1, Number.parseInt(options.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number.parseInt(options.perPage) || 30))
    const offset = (page - 1) * perPage

    const contracts = await this.sql`
      SELECT c.*, cl.name as client_name
      FROM contracts c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `

    const [countResult] = await this.sql`
      SELECT COUNT(*) as total
      FROM contracts
      WHERE user_id = ${userId}
    `

    const total = Number.parseInt(countResult?.total) || 0

    return {
      contracts,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    }
  }

  /**
   * Get a specific contract
   * @param {string} userId - User ID
   * @param {string} contractId - Contract ID
   * @returns {Promise<object|null>} Contract or null
   */
  async getContract(userId, contractId) {
    await this.ensureInitialized()

    const rows = await this.sql`
      SELECT c.*, cl.name as client_name
      FROM contracts c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ${contractId}::uuid AND c.user_id = ${userId}
      LIMIT 1
    `

    return rows.length > 0 ? rows[0] : null
  }

  /**
   * Update contract status
   * @param {string} userId - User ID
   * @param {string} contractId - Contract ID
   * @param {string} status - New status
   * @returns {Promise<object|null>} Updated contract or null
   */
  async updateContractStatus(userId, contractId, status) {
    await this.ensureInitialized()

    const rows = await this.sql`
      UPDATE contracts
      SET status = ${status}, updated_at = now()
      WHERE id = ${contractId}::uuid AND user_id = ${userId}
      RETURNING *
    `

    return rows.length > 0 ? rows[0] : null
  }
}
