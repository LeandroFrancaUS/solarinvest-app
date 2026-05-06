// server/personnel-import/repository.js
// Database queries for the personnel import search endpoints.
//
// These endpoints are read-only and never write, link, or merge entities.
// All functions accept a scoped `sql` client as first argument.
// 42P01 (undefined_table) → return null — table not yet migrated.

/**
 * Search active app users eligible for personnel form pre-fill.
 * Returns only safe fields: id, full_name, email.
 * @param {import('postgres').Sql} sql
 * @param {string} q  Optional search term (already lowercased).
 * @returns {Promise<Array|null>}  null when the table does not yet exist.
 */
export async function searchImportableUsers(sql, q) {
  try {
    if (q) {
      const pattern = `%${q}%`
      return await sql`
        SELECT id, full_name, email
        FROM public.app_user_access
        WHERE is_active = true
          AND can_access_app = true
          AND (lower(full_name) LIKE ${pattern} OR lower(email) LIKE ${pattern})
        ORDER BY lower(full_name) ASC
        LIMIT 30
      `
    }
    return await sql`
      SELECT id, full_name, email
      FROM public.app_user_access
      WHERE is_active = true
        AND can_access_app = true
      ORDER BY lower(full_name) ASC
      LIMIT 30
    `
  } catch (err) {
    if (err?.code === '42P01') return null
    throw err
  }
}

/**
 * Fetch phone numbers from app_user_profiles for the given user IDs.
 * Silently returns an empty array if the table does not exist.
 * @param {import('postgres').Sql} sql
 * @param {Array<string|number>} ids
 * @returns {Promise<Array>}
 */
export async function getUserProfiles(sql, ids) {
  try {
    return await sql`
      SELECT user_access_id, phone
      FROM public.app_user_profiles
      WHERE user_access_id = ANY(${ids})
    `
  } catch {
    // app_user_profiles may not exist in all environments — silently ignore
    return []
  }
}

/**
 * Search active clients eligible for personnel form pre-fill.
 * Returns only fields needed for the import modal.
 * @param {import('postgres').Sql} sql
 * @param {string} q  Optional search term (already lowercased).
 * @returns {Promise<Array|null>}  null when the table does not yet exist.
 */
export async function searchImportableClients(sql, q) {
  try {
    if (q) {
      const pattern = `%${q}%`
      return await sql`
        SELECT id, name, email, phone, document, state, city
        FROM public.clients
        WHERE deleted_at IS NULL
          AND (
            lower(name)     LIKE ${pattern} OR
            lower(email)    LIKE ${pattern} OR
            lower(document) LIKE ${pattern} OR
            lower(phone)    LIKE ${pattern}
          )
        ORDER BY lower(name) ASC
        LIMIT 30
      `
    }
    return await sql`
      SELECT id, name, email, phone, document, state, city
      FROM public.clients
      WHERE deleted_at IS NULL
      ORDER BY lower(name) ASC
      LIMIT 30
    `
  } catch (err) {
    if (err?.code === '42P01') return null
    throw err
  }
}
