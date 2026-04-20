import { getNeonDatabaseConfig } from './neonConfig.js'

let neonFactory
let importError
let dependencyWarningLogged = false

try {
  const neonModule = await import('@neondatabase/serverless')
  neonFactory = neonModule.neon ?? neonModule.default
} catch (error) {
  importError = error
}

let clientSingleton

export function getDatabaseClient() {
  if (clientSingleton) {
    return clientSingleton
  }

  if (!neonFactory) {
    if (!dependencyWarningLogged) {
      dependencyWarningLogged = true
      console.error('[database] Dependência "@neondatabase/serverless" ausente ou incompatível.', importError)
    }
    return null
  }

  const config = getNeonDatabaseConfig()
  if (!config.connectionString) {
    return null
  }

  // Prefer the direct (unpooled) connection for the main client so that
  // sql.transaction() works reliably.  The pooler endpoint can interfere
  // with HTTP transaction batching in some Neon configurations.
  const connectionStr = config.directConnectionString || config.connectionString

  clientSingleton = {
    sql: neonFactory(connectionStr),
    config,
  }

  return clientSingleton
}


