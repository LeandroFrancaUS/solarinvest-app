import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

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
  console.error('\n⚠️  Unable to locate the Rollup native binary for linux-x64.');
  console.error('   npm currently treats optional dependencies as failures in some environments.');
  console.error('   To resolve this, reinstall dependencies in an environment with npm registry access,');
  console.error('   or manually download the package @rollup/rollup-linux-x64-gnu@4.52.4 into node_modules/@rollup/.');
  process.exit(1);
}

function resolveEsbuildPaths() {
  const base = path.resolve('node_modules', 'esbuild');
  return {
    bin: path.join(base, 'bin', 'esbuild'),
    installer: path.join(base, 'install.js'),
  };
}

function hasWorkingEsbuildBinary(bin) {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    if (error && error.code === 'EACCES') {
      return false;
    }
    // Exec format error (wrong architecture) bubbles up with code 'ENOEXEC'.
    if (error && error.code === 'ENOEXEC') {
      return false;
    }
    // Some distros use different code when the binary is invalid.
    if (error && error.errno === 'ENOTSUP') {
      return false;
    }
    throw error;
  }
}

function reinstallEsbuild(installer) {
  if (!fs.existsSync(installer)) {
    console.error('\n⚠️  Unable to locate esbuild\'s installer at', installer);
    console.error('   Ensure `esbuild` is listed in dependencies and reinstall.');
    return false;
  }
  const result = spawnSync(process.execPath, [installer], { stdio: 'inherit' });
  return result.status === 0;
}

function assertEsbuildBinary() {
  const { bin, installer } = resolveEsbuildPaths();
  if (hasWorkingEsbuildBinary(bin)) {
    return true;
  }
  console.warn('\n⚠️  esbuild binary missing or invalid for this platform. Reinstalling...');
  if (!reinstallEsbuild(installer)) {
    return false;
  }
  return hasWorkingEsbuildBinary(bin);
}

if (!assertEsbuildBinary()) {
  console.error('\n❌  Unable to prepare a working esbuild binary for this platform.');
  console.error('   Check that the deployment environment allows postinstall scripts,');
  console.error('   or manually install `esbuild` for the correct architecture.');
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
