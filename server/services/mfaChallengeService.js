import { randomBytes } from 'node:crypto'
import { getDb, saveDatabase, createId } from '../storage/database.js'

function generateChallengeId() {
  return randomBytes(16).toString('hex')
}

export function createMfaChallenge({ userId, method, context = {} }) {
  const db = getDb()
  const now = new Date().toISOString()
  const challenge = {
    id: generateChallengeId(),
    userId,
    method,
    createdAt: now,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    context,
  }
  db.mfaChallenges.push(challenge)
  saveDatabase()
  return challenge
}

export function consumeMfaChallenge(challengeId) {
  const db = getDb()
  const index = db.mfaChallenges.findIndex((challenge) => challenge.id === challengeId)
  if (index === -1) {
    return null
  }
  const [challenge] = db.mfaChallenges.splice(index, 1)
  saveDatabase()
  return challenge
}

export function purgeExpiredChallenges() {
  const db = getDb()
  const now = Date.now()
  db.mfaChallenges = db.mfaChallenges.filter((challenge) => {
    const expires = new Date(challenge.expiresAt).getTime()
    return Number.isNaN(expires) || expires > now
  })
  saveDatabase()
}
