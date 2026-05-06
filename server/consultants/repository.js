// server/consultants/repository.js
// Database queries for the Consultants entity.
//
// All functions accept a scoped `sql` client as first argument.
// 42P01 (undefined_table)  → return null / [] — table not yet migrated.
// 42703 (undefined_column) → retry without `apelido` — migration 0042 pending.

// ─────────────────────────────────────────────────────────────────────────────
// SELECT column lists (both variants)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full column list for consultants, with apelido column.
 * @param {import('postgres').Sql} sql
 * @param {boolean} activeOnly
 * @returns {Promise<Array|null>}  null when the table does not yet exist.
 */
export async function listConsultants(sql, activeOnly) {
  try {
    if (activeOnly) {
      return await sql`
        SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        WHERE is_active = true
        ORDER BY LOWER(full_name) ASC
      `
    }
    return await sql`
      SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
             linked_user_id, is_active, created_at, updated_at, created_by_user_id
      FROM public.consultants
      ORDER BY LOWER(full_name) ASC
    `
  } catch (err) {
    if (err?.code === '42P01') return null
    if (err?.code === '42703') {
      if (activeOnly) {
        return await sql`
          SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
                 linked_user_id, is_active, created_at, updated_at, created_by_user_id
          FROM public.consultants
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      }
      return await sql`
        SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        ORDER BY LOWER(full_name) ASC
      `
    }
    throw err
  }
}

/**
 * Lightweight list of active consultants for form dropdowns.
 * Exposes only safe fields — no CPF/document.
 * @param {import('postgres').Sql} sql
 * @returns {Promise<Array|null>}  null when the table does not yet exist.
 */
export async function listConsultantsPicker(sql) {
  try {
    return await sql`
      SELECT id, full_name, apelido, email, linked_user_id
      FROM public.consultants
      WHERE is_active = true
      ORDER BY LOWER(full_name) ASC
    `
  } catch (err) {
    if (err?.code === '42P01') return null
    if (err?.code === '42703') {
      return await sql`
        SELECT id, full_name, NULL AS apelido, email, linked_user_id
        FROM public.consultants
        WHERE is_active = true
        ORDER BY LOWER(full_name) ASC
      `
    }
    throw err
  }
}

/**
 * Returns true when a consultant with the given document already exists.
 * Optionally excludes a specific record (for update uniqueness checks).
 * @param {import('postgres').Sql} sql
 * @param {string} docStr
 * @param {number|null} [excludeId]
 * @returns {Promise<boolean>}
 */
export async function isDocumentTaken(sql, docStr, excludeId = null) {
  const rows = excludeId != null
    ? await sql`SELECT id FROM public.consultants WHERE document = ${docStr} AND id != ${excludeId}`.catch(() => [])
    : await sql`SELECT id FROM public.consultants WHERE document = ${docStr}`.catch(() => [])
  return rows.length > 0
}

/**
 * Returns true when a consultant_code is already in use.
 * @param {import('postgres').Sql} sql
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function isCodeTaken(sql, code) {
  const rows = await sql`SELECT id FROM public.consultants WHERE consultant_code = ${code}`.catch(() => [])
  return rows.length > 0
}

/**
 * Insert a new consultant row.
 * Handles 42703 (apelido column missing) by retrying without that column.
 * @param {import('postgres').Sql} sql
 * @param {{ consultantCode: string, fullName: string, apelido: string, phone: string,
 *           email: string, document: string, regions: string[], linkedUserId: string|null,
 *           createdByUserId: string|null }} fields
 * @returns {Promise<object>}  The created row.
 */
export async function createConsultant(sql, { consultantCode, fullName, apelido, phone, email, document, regions, linkedUserId, createdByUserId }) {
  try {
    const rows = await sql`
      INSERT INTO public.consultants (
        consultant_code, full_name, apelido, phone, email, document, regions,
        linked_user_id, is_active, created_by_user_id, updated_by_user_id,
        created_at, updated_at
      ) VALUES (
        ${consultantCode},
        ${fullName},
        ${apelido},
        ${phone},
        ${email},
        ${document},
        ${regions},
        ${linkedUserId},
        true,
        ${createdByUserId},
        ${createdByUserId},
        now(), now()
      )
      RETURNING *
    `
    return rows[0]
  } catch (err) {
    if (err?.code === '42703') {
      const rows = await sql`
        INSERT INTO public.consultants (
          consultant_code, full_name, phone, email, document, regions,
          linked_user_id, is_active, created_by_user_id, updated_by_user_id,
          created_at, updated_at
        ) VALUES (
          ${consultantCode},
          ${fullName},
          ${phone},
          ${email},
          ${document},
          ${regions},
          ${linkedUserId},
          true,
          ${createdByUserId},
          ${createdByUserId},
          now(), now()
        )
        RETURNING *
      `
      return rows[0]
    }
    throw err
  }
}

/**
 * Update an existing consultant row.
 * Handles 42703 (apelido column missing) by retrying without that column.
 * @param {import('postgres').Sql} sql
 * @param {number} consultantId
 * @param {{ fullName: string, apelido: string|null, phone: string, email: string,
 *           document: string, regions: string[], linkedUserId: string|null,
 *           updatedByUserId: string|null }} fields
 * @returns {Promise<object|null>}  The updated row, or null if not found.
 */
export async function updateConsultant(sql, consultantId, { fullName, apelido, phone, email, document, regions, linkedUserId, updatedByUserId }) {
  let rows
  try {
    rows = await sql`
      UPDATE public.consultants SET
        full_name          = ${fullName},
        apelido            = ${apelido},
        phone              = ${phone},
        email              = ${email},
        document           = ${document},
        regions            = ${regions},
        linked_user_id     = ${linkedUserId},
        updated_by_user_id = ${updatedByUserId},
        updated_at         = now()
      WHERE id = ${consultantId}
      RETURNING *
    `
  } catch (err) {
    if (err?.code === '42703') {
      rows = await sql`
        UPDATE public.consultants SET
          full_name          = ${fullName},
          phone              = ${phone},
          email              = ${email},
          document           = ${document},
          regions            = ${regions},
          linked_user_id     = ${linkedUserId},
          updated_by_user_id = ${updatedByUserId},
          updated_at         = now()
        WHERE id = ${consultantId}
        RETURNING *
      `
    } else {
      throw err
    }
  }
  return rows.length > 0 ? rows[0] : null
}

/**
 * Soft-delete (deactivate) a consultant.
 * @param {import('postgres').Sql} sql
 * @param {number} consultantId
 * @param {string|null} updatedByUserId
 * @returns {Promise<object|null>}  The updated row, or null if not found.
 */
export async function deactivateConsultant(sql, consultantId, updatedByUserId) {
  const rows = await sql`
    UPDATE public.consultants SET
      is_active          = false,
      updated_by_user_id = ${updatedByUserId},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `
  return rows.length > 0 ? rows[0] : null
}

/**
 * Find a consultant by ID (existence check only returns id).
 * @param {import('postgres').Sql} sql
 * @param {number} consultantId
 * @returns {Promise<object|null>}
 */
export async function findConsultantById(sql, consultantId) {
  const rows = await sql`SELECT id FROM public.consultants WHERE id = ${consultantId}`
  return rows.length > 0 ? rows[0] : null
}

/**
 * Find a consultant that already has the given userId linked, excluding a specific record.
 * Used to detect "user already linked to a different consultant".
 * @param {import('postgres').Sql} sql
 * @param {string} userId
 * @param {number} excludeConsultantId
 * @returns {Promise<object|null>}
 */
export async function findOtherConsultantWithUser(sql, userId, excludeConsultantId) {
  const rows = await sql`
    SELECT id, full_name FROM public.consultants
    WHERE linked_user_id = ${userId} AND id != ${excludeConsultantId}
  `
  return rows.length > 0 ? rows[0] : null
}

/**
 * Link a user to a consultant.
 * @param {import('postgres').Sql} sql
 * @param {number} consultantId
 * @param {string} userId
 * @param {string|null} updatedByUserId
 * @returns {Promise<object>}  The updated row.
 */
export async function linkConsultant(sql, consultantId, userId, updatedByUserId) {
  const rows = await sql`
    UPDATE public.consultants SET
      linked_user_id     = ${userId},
      updated_by_user_id = ${updatedByUserId},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `
  return rows[0]
}

/**
 * Unlink a consultant from its user.
 * @param {import('postgres').Sql} sql
 * @param {number} consultantId
 * @param {string|null} updatedByUserId
 * @returns {Promise<object|null>}  The updated row, or null if not found.
 */
export async function unlinkConsultant(sql, consultantId, updatedByUserId) {
  const rows = await sql`
    UPDATE public.consultants SET
      linked_user_id     = NULL,
      updated_by_user_id = ${updatedByUserId},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `
  return rows.length > 0 ? rows[0] : null
}

/**
 * Find an active consultant by linked_user_id.
 * Returns undefined when the table does not yet exist (42P01).
 * Returns null when no matching row found.
 * Handles 42703 (apelido missing) → retry.
 * @param {import('postgres').Sql} sql
 * @param {string} userId
 * @returns {Promise<object|null|undefined>}
 */
export async function findConsultantByUserId(sql, userId) {
  try {
    const rows = await sql`
      SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
             linked_user_id, is_active, created_at, updated_at, created_by_user_id
      FROM public.consultants
      WHERE linked_user_id = ${userId} AND is_active = true
      LIMIT 1
    `
    return rows.length > 0 ? rows[0] : null
  } catch (err) {
    if (err?.code === '42P01') return undefined
    if (err?.code === '42703') {
      const rows = await sql`
        SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        WHERE linked_user_id = ${userId} AND is_active = true
        LIMIT 1
      `
      return rows.length > 0 ? rows[0] : null
    }
    throw err
  }
}

/**
 * Find an active consultant by email (case-insensitive).
 * Handles 42703 (apelido missing) → retry.
 * @param {import('postgres').Sql} sql
 * @param {string} email  Already lowercased.
 * @returns {Promise<object|null>}
 */
export async function findConsultantByEmail(sql, email) {
  try {
    const rows = await sql`
      SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
             linked_user_id, is_active, created_at, updated_at, created_by_user_id
      FROM public.consultants
      WHERE LOWER(email) = ${email} AND is_active = true
      LIMIT 1
    `
    return rows.length > 0 ? rows[0] : null
  } catch (err) {
    if (err?.code === '42703') {
      const rows = await sql`
        SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        WHERE LOWER(email) = ${email} AND is_active = true
        LIMIT 1
      `
      return rows.length > 0 ? rows[0] : null
    }
    throw err
  }
}

/**
 * Find an active consultant by first + last name (case-insensitive PostgreSQL split).
 * Handles 42703 (apelido missing) → retry.
 * @param {import('postgres').Sql} sql
 * @param {string} firstName  Already lowercased.
 * @param {string} lastName   Already lowercased.
 * @returns {Promise<object|null>}
 */
export async function findConsultantByName(sql, firstName, lastName) {
  try {
    const rows = await sql`
      SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
             linked_user_id, is_active, created_at, updated_at, created_by_user_id
      FROM public.consultants
      WHERE is_active = true
        AND LOWER(SPLIT_PART(full_name, ' ', 1)) = ${firstName}
        AND LOWER(SPLIT_PART(full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1))) = ${lastName}
      LIMIT 1
    `
    return rows.length > 0 ? rows[0] : null
  } catch (err) {
    if (err?.code === '42703') {
      const rows = await sql`
        SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        WHERE is_active = true
          AND LOWER(SPLIT_PART(full_name, ' ', 1)) = ${firstName}
          AND LOWER(SPLIT_PART(full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1))) = ${lastName}
        LIMIT 1
      `
      return rows.length > 0 ? rows[0] : null
    }
    throw err
  }
}
