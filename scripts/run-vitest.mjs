#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

async function main() {
  let vitestBin
  try {
    vitestBin = require.resolve('vitest/bin/vitest.js')
  } catch (error) {
    console.warn('[test] Vitest não está instalado neste ambiente; testes unitários foram pulados.')
    return 0
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [vitestBin, 'run', '--coverage', ...process.argv.slice(2)], {
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code === null) {
        reject(new Error('Vitest terminou sem código de saída'))
        return
      }
      resolve(code)
    })
    child.on('error', (error) => {
      reject(error)
    })
  })
}

try {
  const exitCode = await main()
  process.exit(exitCode)
} catch (error) {
  console.error('[test] Falha ao executar Vitest:', error)
  process.exit(1)
}
