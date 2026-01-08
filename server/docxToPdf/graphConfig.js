const readEnv = (key) => {
  const raw = typeof process.env[key] === 'string' ? process.env[key].trim() : ''
  return raw || ''
}

export const getGraphConfig = () => ({
  tenantId: readEnv('MS_TENANT_ID'),
  clientId: readEnv('MS_CLIENT_ID'),
  clientSecret: readEnv('MS_CLIENT_SECRET'),
  userId: readEnv('MS_GRAPH_USER_ID'),
  driveId: readEnv('MS_GRAPH_DRIVE_ID'),
  tempFolder: readEnv('MS_GRAPH_TEMP_FOLDER'),
  basePath: readEnv('MS_GRAPH_BASE_PATH'),
  scope: readEnv('MS_GRAPH_SCOPE') || 'https://graph.microsoft.com/.default',
})

export const isGraphConfigured = () => {
  const config = getGraphConfig()
  const hasAuth = Boolean(config.tenantId && config.clientId && config.clientSecret)
  const hasTarget = Boolean(config.userId || config.driveId)
  return hasAuth && hasTarget && Boolean(config.tempFolder)
}

export const requireGraphConfig = () => {
  const config = getGraphConfig()
  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    throw new Error('Configuração do Microsoft Graph ausente. Verifique MS_TENANT_ID, MS_CLIENT_ID e MS_CLIENT_SECRET.')
  }
  if (!config.userId && !config.driveId) {
    throw new Error('Configuração do Microsoft Graph incompleta. Defina MS_GRAPH_USER_ID ou MS_GRAPH_DRIVE_ID.')
  }
  if (!config.tempFolder) {
    throw new Error('Configuração do Microsoft Graph incompleta. Defina MS_GRAPH_TEMP_FOLDER.')
  }
  return config
}
