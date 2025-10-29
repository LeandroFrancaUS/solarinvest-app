import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.resolve(__dirname, '../data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

const EMPTY_DB = {
  users: [],
  invitations: [],
  sessions: [],
  passwordResets: [],
  auditLog: [],
  mfaChallenges: [],
}

let database = null

function ensureLoaded() {
  if (database) return
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(DB_FILE)) {
    database = JSON.parse(JSON.stringify(EMPTY_DB))
    saveDatabase()
    return
  }
  try {
    const raw = readFileSync(DB_FILE, 'utf-8')
    database = { ...JSON.parse(raw) }
  } catch (error) {
    database = JSON.parse(JSON.stringify(EMPTY_DB))
  }
  for (const key of Object.keys(EMPTY_DB)) {
    if (!Array.isArray(database[key])) {
      database[key] = []
    }
  }
}

export function getDb() {
  ensureLoaded()
  return database
}

export function saveDatabase() {
  ensureLoaded()
  writeFileSync(DB_FILE, JSON.stringify(database, null, 2))
}

export function resetDatabase() {
  database = JSON.parse(JSON.stringify(EMPTY_DB))
  saveDatabase()
}

export function createId() {
  return randomUUID()
}
