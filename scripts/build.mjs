import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function assertRollupNativeBinding() {
  try {
    require('@rollup/rollup-linux-x64-gnu');
    return true;
  } catch (error) {
    if (error && error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    return false;
  }
}

if (!assertRollupNativeBinding()) {
  console.warn('\n⚠️  Unable to locate the Rollup native binary for linux-x64.');
  console.warn('   npm may treat optional dependencies as warnings in some environments.');
  console.warn('   Falling back to the JavaScript implementation of Rollup. Build performance may be reduced.');
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
