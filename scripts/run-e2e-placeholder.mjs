#!/usr/bin/env node
const message = `E2E headless tests não estão implementados neste ambiente. ` +
  `Defina PLAYWRIGHT_TESTS para executá-los externamente.`
console.warn(message)
process.exit(0)
