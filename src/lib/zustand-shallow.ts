const hasOwnProperty = Object.prototype.hasOwnProperty

const isObject = (value: unknown): value is Record<string, unknown> | unknown[] =>
  typeof value === 'object' && value !== null

export const shallow = <T>(objA: T, objB: T): boolean => {
  if (Object.is(objA, objB)) {
    return true
  }

  if (!isObject(objA) || !isObject(objB)) {
    return false
  }

  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) {
      return false
    }

    for (let index = 0; index < objA.length; index += 1) {
      if (!Object.is(objA[index], objB[index])) {
        return false
      }
    }

    return true
  }

  const keysA = Object.keys(objA as Record<string, unknown>)
  const keysB = Object.keys(objB as Record<string, unknown>)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (let index = 0; index < keysA.length; index += 1) {
    const key = keysA[index]
    if (
      !hasOwnProperty.call(objB, key) ||
      !Object.is(
        (objA as Record<string, unknown>)[key],
        (objB as Record<string, unknown>)[key],
      )
    ) {
      return false
    }
  }

  return true
}

export default shallow
