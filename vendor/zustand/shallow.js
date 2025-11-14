const hasOwn = Object.prototype.hasOwnProperty

const isObjectLike = (value) => value !== null && typeof value === 'object'

export function shallow(objA, objB) {
  if (Object.is(objA, objB)) {
    return true
  }

  if (!isObjectLike(objA) || !isObjectLike(objB)) {
    return false
  }

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (const key of keysA) {
    if (!hasOwn.call(objB, key) || !Object.is(objA[key], objB[key])) {
      return false
    }
  }

  return true
}

export default shallow
