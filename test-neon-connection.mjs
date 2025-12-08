// test-neon-connection.mjs
// Utilitário simples para validar se a aplicação consegue se conectar ao banco Neon.
// Ele lê as variáveis de ambiente padrão usadas no projeto e executa um SELECT NOW().

async function tryLoadDotenv() {
  try {
    await import('dotenv/config')
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      console.warn('⚠️  Pacote "dotenv" não encontrado; prosseguindo sem carregar .env.')
    } else {
      console.warn('⚠️  Falha ao carregar dotenv. Variáveis de ambiente podem não ser lidas do .env.', error)
    }
  }
}

await tryLoadDotenv()

async function main() {
  try {
    const connectionString =
      process.env.NEON_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.NEON_POSTGRESQL_URL

    if (!connectionString) {
      throw new Error('Nenhuma variável de ambiente NEON_DATABASE_URL / DATABASE_URL / NEON_POSTGRESQL_URL foi encontrada.')
    }

    let targetHost = 'desconhecido'
    try {
      const parsed = new URL(connectionString)
      targetHost = parsed.host
    } catch (parseError) {
      console.warn('⚠️  Não foi possível analisar o host do connection string.', parseError)
    }

    console.log(`🔎 Verificando conexão com o host Neon: ${targetHost}`)

    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(connectionString)

    const result = await sql`select now() as now, current_database() as db, current_user as usr`

    console.log('✅ Conexão bem-sucedida com o Neon!')
    console.log('Resultado:')
    console.log(result)
  } catch (err) {
    console.error('❌ Erro ao conectar no Neon:')
    console.error(err)

    const isNetworkError =
      err?.code === 'ENETUNREACH' ||
      err?.cause?.code === 'ENETUNREACH' ||
      err?.sourceError?.cause?.code === 'ENETUNREACH'

    if (isNetworkError) {
      console.error('💡 Dica: a conexão foi bloqueada pela rede (ENETUNREACH). Verifique conectividade externa ou regras de firewall.')
    }

    process.exit(1)
  }
}

main()
