/**
 * Service for managing CRM clients in Neon database
 */
export class ClientsService {
  constructor(sql) {
    this.sql = sql
  }

  /**
   * List all clients for a specific user
   * @param {string} userId - User ID
   * @param {object} options - Query options (page, perPage, search)
   * @returns {Promise<object>} Clients list with pagination info
   */
  async listClients(userId, options = {}) {
    const page = Math.max(1, Number.parseInt(options.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number.parseInt(options.perPage) || 30))
    const offset = (page - 1) * perPage
    const search = typeof options.search === 'string' ? options.search.trim() : ''

    let whereClause = this.sql`user_id = ${userId}`
    
    if (search) {
      whereClause = this.sql`user_id = ${userId} AND (
        name ILIKE ${`%${search}%`} OR
        email ILIKE ${`%${search}%`} OR
        document ILIKE ${`%${search}%`}
      )`
    }

    const clients = await this.sql`
      SELECT 
        id, user_id, name, document, email, phone, city, state, 
        address, uc, distribuidora, metadata, created_at, updated_at
      FROM clients
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `

    const [countResult] = await this.sql`
      SELECT COUNT(*) as total
      FROM clients
      WHERE ${whereClause}
    `

    const total = Number.parseInt(countResult?.total) || 0

    return {
      clients,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    }
  }

  /**
   * Get a specific client by ID
   * @param {string} userId - User ID
   * @param {number|string} clientId - Client ID
   * @returns {Promise<object|null>} Client data or null
   */
  async getClient(userId, clientId) {
    const rows = await this.sql`
      SELECT 
        id, user_id, name, document, email, phone, city, state,
        address, uc, distribuidora, metadata, created_at, updated_at,
        tipo, nome_razao, telefone_secundario, logradouro, numero,
        complemento, bairro, cep, origem, observacoes, responsavel_id
      FROM clients
      WHERE id = ${clientId} AND user_id = ${userId}
      LIMIT 1
    `

    return rows.length > 0 ? rows[0] : null
  }

  /**
   * Create a new client
   * @param {string} userId - User ID
   * @param {object} clientData - Client data
   * @returns {Promise<object>} Created client
   */
  async createClient(userId, clientData) {
    const {
      name,
      document,
      email,
      phone,
      city,
      state,
      address,
      uc,
      distribuidora,
      metadata,
      tipo,
      nome_razao,
      telefone_secundario,
      logradouro,
      numero,
      complemento,
      bairro,
      cep,
      origem,
      observacoes
    } = clientData

    const metadataJson = metadata ? JSON.stringify(metadata) : null

    const rows = await this.sql`
      INSERT INTO clients (
        user_id, name, document, email, phone, city, state,
        address, uc, distribuidora, metadata, tipo, nome_razao,
        telefone_secundario, logradouro, numero, complemento,
        bairro, cep, origem, observacoes,
        created_at, updated_at
      )
      VALUES (
        ${userId}, ${name || ''}, ${document || null}, ${email || null},
        ${phone || null}, ${city || null}, ${state || null},
        ${address || null}, ${uc || null}, ${distribuidora || null},
        ${metadataJson}::jsonb, ${tipo || null}, ${nome_razao || null},
        ${telefone_secundario || null}, ${logradouro || null}, ${numero || null},
        ${complemento || null}, ${bairro || null}, ${cep || null},
        ${origem || null}, ${observacoes || null},
        now(), now()
      )
      RETURNING *
    `

    return rows[0]
  }

  /**
   * Update an existing client
   * @param {string} userId - User ID
   * @param {number|string} clientId - Client ID
   * @param {object} clientData - Updated client data
   * @returns {Promise<object|null>} Updated client or null
   */
  async updateClient(userId, clientId, clientData) {
    const existing = await this.getClient(userId, clientId)
    if (!existing) {
      return null
    }

    const {
      name,
      document,
      email,
      phone,
      city,
      state,
      address,
      uc,
      distribuidora,
      metadata,
      tipo,
      nome_razao,
      telefone_secundario,
      logradouro,
      numero,
      complemento,
      bairro,
      cep,
      origem,
      observacoes
    } = clientData

    const metadataJson = metadata ? JSON.stringify(metadata) : existing.metadata

    const rows = await this.sql`
      UPDATE clients
      SET
        name = ${name !== undefined ? name : existing.name},
        document = ${document !== undefined ? document : existing.document},
        email = ${email !== undefined ? email : existing.email},
        phone = ${phone !== undefined ? phone : existing.phone},
        city = ${city !== undefined ? city : existing.city},
        state = ${state !== undefined ? state : existing.state},
        address = ${address !== undefined ? address : existing.address},
        uc = ${uc !== undefined ? uc : existing.uc},
        distribuidora = ${distribuidora !== undefined ? distribuidora : existing.distribuidora},
        metadata = ${metadataJson}::jsonb,
        tipo = ${tipo !== undefined ? tipo : existing.tipo},
        nome_razao = ${nome_razao !== undefined ? nome_razao : existing.nome_razao},
        telefone_secundario = ${telefone_secundario !== undefined ? telefone_secundario : existing.telefone_secundario},
        logradouro = ${logradouro !== undefined ? logradouro : existing.logradouro},
        numero = ${numero !== undefined ? numero : existing.numero},
        complemento = ${complemento !== undefined ? complemento : existing.complemento},
        bairro = ${bairro !== undefined ? bairro : existing.bairro},
        cep = ${cep !== undefined ? cep : existing.cep},
        origem = ${origem !== undefined ? origem : existing.origem},
        observacoes = ${observacoes !== undefined ? observacoes : existing.observacoes},
        updated_at = now()
      WHERE id = ${clientId} AND user_id = ${userId}
      RETURNING *
    `

    return rows.length > 0 ? rows[0] : null
  }

  /**
   * Delete a client
   * @param {string} userId - User ID
   * @param {number|string} clientId - Client ID
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async deleteClient(userId, clientId) {
    const result = await this.sql`
      DELETE FROM clients
      WHERE id = ${clientId} AND user_id = ${userId}
    `

    return result.count > 0
  }
}
