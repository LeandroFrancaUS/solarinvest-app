import { execSync } from 'node:child_process';

function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

run('node tools/audit/site-audit.mjs');

try {
  run('npx madge src --circular --extensions ts,tsx');
} catch (e) {
  console.warn('⚠️ Madge encontrou ciclos ou não está instalado.');
}

console.log('\n✅ Auditoria básica concluída.');
