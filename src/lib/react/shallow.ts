/**
 * Shallow equality comparison for plain objects.
 *
 * Drop-in replacement for `zustand/shallow` — avoids pulling in the zustand
 * package just for this one utility in components that use the custom
 * `createStore` helper.
 *
 * Returns true when:
 *   - both values are reference-equal (Object.is), OR
 *   - both are plain objects whose own enumerable keys are reference-equal.
 *
 * Returns false for:
 *   - primitives that differ
 *   - objects with different key counts
 *   - objects with any key whose value differs by Object.is
 *   - null, non-objects
 */
export function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (
    typeof a !== 'object' || a === null ||
    typeof b !== 'object' || b === null
  ) {
    return false
  }
  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false
    }
  }
  return true
}
