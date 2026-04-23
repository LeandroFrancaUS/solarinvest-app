/**
 * src/domain/conversion/merge-resolved-into-record.ts
 *
 * DEFENSIVE MERGE HELPER for distributing resolved data into dependent records.
 *
 * Policies:
 *   fillIfEmpty        — write resolved value only when destination field is null/undefined.
 *   preserveManual     — always keep the existing destination value (never overwrite).
 *   overwriteCanonical — always use the resolved value (canonical source of truth).
 *   neverDowngradeToNull — skip resolved value when it is null/undefined/empty.
 *
 * Rule: a resolved value that is null/undefined/empty string is never written
 * regardless of policy — this prevents value-downgrades across all policies.
 */

// ─── Policy type ───────────────────────────────────────────────────────────────

export type MergePolicy =
  | 'fillIfEmpty'
  | 'preserveManual'
  | 'overwriteCanonical'
  | 'neverDowngradeToNull'

// ─── Per-field policy override ─────────────────────────────────────────────────

export type FieldPolicy = {
  [destKey: string]: MergePolicy
}

// ─── Core merge function ───────────────────────────────────────────────────────

/**
 * Merge `resolved` fields into `existing` record using the given policy.
 *
 * @param existing   The current record already in the database (or {}).
 * @param resolved   The new data to merge in.
 * @param policy     Default policy applied to every field.
 * @param perField   Per-field policy overrides (applied before the default).
 *
 * @returns A new object containing only the fields that should be written
 *          (i.e. the patch payload to send to the API).
 *
 * @example
 * ```ts
 * const patch = mergeResolvedIntoDependentRecord(
 *   { city: 'São Paulo', email: null },
 *   { city: 'Rio',       email: 'x@y.com' },
 *   'fillIfEmpty',
 * )
 * // → { email: 'x@y.com' }   (city preserved because it was not empty)
 * ```
 */
export function mergeResolvedIntoDependentRecord(
  existing: Record<string, unknown>,
  resolved: Record<string, unknown>,
  policy: MergePolicy,
  perField: FieldPolicy = {},
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  for (const key of Object.keys(resolved)) {
    const resolvedValue = resolved[key]
    const existingValue = existing[key]

    // Global guard: never write null/undefined/empty-string resolved values.
    if (resolvedValue === null || resolvedValue === undefined) continue
    if (typeof resolvedValue === 'string' && resolvedValue.trim() === '') continue

    const effectivePolicy: MergePolicy = perField[key] ?? policy

    switch (effectivePolicy) {
      case 'preserveManual':
        // Never write to this field at all.
        break

      case 'overwriteCanonical':
        // Always use resolved value.
        patch[key] = resolvedValue
        break

      case 'fillIfEmpty':
        // Write only when destination is empty (null/undefined/empty-string).
        if (
          existingValue === null ||
          existingValue === undefined ||
          (typeof existingValue === 'string' && existingValue.trim() === '')
        ) {
          patch[key] = resolvedValue
        }
        break

      case 'neverDowngradeToNull':
        // Resolved is already non-null (checked above), so always write.
        patch[key] = resolvedValue
        break
    }
  }

  return patch
}
