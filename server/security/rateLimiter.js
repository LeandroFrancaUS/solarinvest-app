const buckets = new Map()

function getBucketKey(ip, route) {
  return `${ip}::${route}`
}

export function rateLimit({ ip, route, limit, windowMs }) {
  if (!ip) return false
  const key = getBucketKey(ip, route)
  const now = Date.now()
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }
  bucket.count += 1
  buckets.set(key, bucket)
  return bucket.count > limit
}

export function getRateLimitInfo({ ip, route }) {
  const bucket = buckets.get(getBucketKey(ip, route))
  if (!bucket) {
    return { remaining: Infinity, resetAt: Date.now() }
  }
  return { remaining: Math.max(0, bucket.count), resetAt: bucket.resetAt }
}
