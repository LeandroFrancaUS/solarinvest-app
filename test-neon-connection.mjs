// test-neon-connection.mjs
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  try {
    const connectionString =
      process.env.NEON_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.NEON_POSTGRESQL_URL;

    if (!connectionString) {
      throw new Error('Nenhuma variável de ambiente NEON_DATABASE_URL / DATABASE_URL / NEON_POSTGRESQL_URL foi encontrada.');
    }

    const sql = neon(connectionString);

    const result = await sql`select now() as now, current_database() as db, current_user as usr`;

    console.log('✅ Conexão bem-sucedida com o Neon!');
    console.log('Resultado:');
    console.log(result);
  } catch (err) {
    console.error('❌ Erro ao conectar no Neon:');
    console.error(err);
    process.exit(1);
  }
}

main();
