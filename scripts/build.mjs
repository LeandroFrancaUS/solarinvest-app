import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function getExpectedRollupPackage() {
  if (process.platform === 'linux' && process.arch === 'x64') {
    return '@rollup/rollup-linux-x64-gnu';
  }
  return null;
}

function assertRollupNativeBinding() {
  const packageName = getExpectedRollupPackage();
  if (!packageName) {
    return true;
  }

  try {
    require(packageName);
    return true;
  } catch (error) {
    if (error && error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    return false;
  }
}

if (!assertRollupNativeBinding()) {
  console.error('\n⚠️  Unable to locate the Rollup native binary for linux-x64.');
  console.error('   npm currently treats optional dependencies as failures in some environments.');
  console.error('   To resolve this, reinstall dependencies in an environment with npm registry access,');
  console.error('   or manually download the package @rollup/rollup-linux-x64-gnu@4.52.4 into node_modules/@rollup/.');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build'],
  { stdio: 'inherit', env: process.env }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
