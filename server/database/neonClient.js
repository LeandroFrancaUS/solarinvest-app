import { getNeonDatabaseConfig } from './neonConfig.js'

let neonFactory
let neonConfiguration
let importError
let dependencyWarningLogged = false

try {
  const neonModule = await import('@neondatabase/serverless')
  neonFactory = neonModule.neon ?? neonModule.default
  neonConfiguration = neonModule.neonConfig ?? null
  if (neonConfiguration) {
    neonConfiguration.fetchConnectionCache = true
  }
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

  clientSingleton = {
    sql: neonFactory(config.connectionString),
    config,
  }

  return clientSingleton
}
