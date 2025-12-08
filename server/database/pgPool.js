import { Pool } from 'pg'
import { getNeonDatabaseConfig } from './neonConfig.js'

let poolSingleton

export function getPgPool() {
  if (poolSingleton) {
    return poolSingleton
  }

  if (global.__pgPool) {
    poolSingleton = global.__pgPool
    return poolSingleton
  }

  const { directConnectionString, connectionString } = getNeonDatabaseConfig()
  const resolvedConnection = directConnectionString || connectionString

  if (!resolvedConnection) {
    throw new Error('[database] Connection string is not configured for pg Pool')
  }

  poolSingleton = new Pool({ connectionString: resolvedConnection })
  global.__pgPool = poolSingleton
  return poolSingleton
}
