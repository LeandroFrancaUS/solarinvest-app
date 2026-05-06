// server/engineers/repository.js
// Database queries for the Engineers entity.
//
// All functions accept a scoped `sql` client as first argument.
// 42P01 (undefined_table) → return null — table not yet migrated.

/**
 * List all engineers, ordered by name.
 * @param {import('postgres').Sql} sql
 * @param {boolean} activeOnly
 * @returns {Promise<Array|null>}  null when the table does not yet exist.
 */
export async function listEngineers(sql, activeOnly) {
  try {
    if (activeOnly) {
      return await sql`
        SELECT id, engineer_code, full_name, phone, email, crea, document, linked_user_id,
               is_active, created_at, updated_at, created_by_user_id
        FROM public.engineers
        WHERE is_active = true
        ORDER BY LOWER(full_name) ASC
      `
    }
    return await sql`
      SELECT id, engineer_code, full_name, phone, email, crea, document, linked_user_id,
             is_active, created_at, updated_at, created_by_user_id
      FROM public.engineers
      ORDER BY LOWER(full_name) ASC
    `
  } catch (err) {
    if (err?.code === '42P01') return null
    throw err
  }
}

/**
 * Returns true when an engineer with the given document already exists.
 * Optionally excludes a specific record (for update uniqueness checks).
 * @param {import('postgres').Sql} sql
 * @param {string} docStr
 * @param {number|null} [excludeId]
 * @returns {Promise<boolean>}
 */
export async function isDocumentTaken(sql, docStr, excludeId = null) {
  const rows = excludeId != null
    ? await sql`SELECT id FROM public.engineers WHERE document = ${docStr} AND id != ${excludeId}`.catch(() => [])
    : await sql`SELECT id FROM public.engineers WHERE document = ${docStr}`.catch(() => [])
  return rows.length > 0
}

/**
 * Returns true when an engineer_code is already in use.
 * @param {import('postgres').Sql} sql
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function isCodeTaken(sql, code) {
  const rows = await sql`SELECT id FROM public.engineers WHERE engineer_code = ${code}`.catch(() => [])
  return rows.length > 0
}

/**
 * Insert a new engineer row.
 * @param {import('postgres').Sql} sql
 * @param {{ engineerCode: string, fullName: string, phone: string, email: string,
 *           crea: string, document: string, linkedUserId: string|null,
 *           createdByUserId: string|null }} fields
 * @returns {Promise<object>}  The created row.
 */
export async function createEngineer(sql, { engineerCode, fullName, phone, email, crea, document, linkedUserId, createdByUserId }) {
  const rows = await sql`
    INSERT INTO public.engineers (
      engineer_code, full_name, phone, email, crea, document,
      linked_user_id, is_active, created_by_user_id, updated_by_user_id,
      created_at, updated_at
    ) VALUES (
      ${engineerCode},
      ${fullName},
      ${phone},
      ${email},
      ${crea},
      ${document},
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

/**
 * Update an existing engineer row.
 * @param {import('postgres').Sql} sql
 * @param {number} engineerId
 * @param {{ fullName: string, phone: string, email: string, crea: string,
 *           document: string, linkedUserId: string|null,
 *           updatedByUserId: string|null }} fields
 * @returns {Promise<object|null>}  The updated row, or null if not found.
 */
export async function updateEngineer(sql, engineerId, { fullName, phone, email, crea, document, linkedUserId, updatedByUserId }) {
  const rows = await sql`
    UPDATE public.engineers SET
      full_name          = ${fullName},
      phone              = ${phone},
      email              = ${email},
      crea               = ${crea},
      document           = ${document},
      linked_user_id     = ${linkedUserId},
      updated_by_user_id = ${updatedByUserId},
      updated_at         = now()
    WHERE id = ${engineerId}
    RETURNING *
  `
  return rows.length > 0 ? rows[0] : null
}

/**
 * Soft-delete (deactivate) an engineer.
 * @param {import('postgres').Sql} sql
 * @param {number} engineerId
 * @param {string|null} updatedByUserId
 * @returns {Promise<object|null>}  The updated row, or null if not found.
 */
export async function deactivateEngineer(sql, engineerId, updatedByUserId) {
  const rows = await sql`
    UPDATE public.engineers SET
      is_active          = false,
      updated_by_user_id = ${updatedByUserId},
      updated_at         = now()
    WHERE id = ${engineerId}
    RETURNING *
  `
  return rows.length > 0 ? rows[0] : null
}
