// scripts/clean-esbuild.mjs
// ⚠️ Este script deve rodar APENAS em Linux (CI / Vercel)
// Em macOS / Windows ele quebra o dev local ao remover o binário correto

if (process.platform !== "linux") {
  console.log(
    "Skipping esbuild cleanup on non-linux platform:",
    process.platform
  )
  process.exit(0)
}

import fs from "fs"
import path from "path"

const dir = path.resolve("node_modules/@esbuild")

if (!fs.existsSync(dir)) {
  console.log("No @esbuild directory found, skipping cleanup")
  process.exit(0)
}

const subdirs = fs.readdirSync(dir)

for (const d of subdirs) {
  if (!d.includes("linux")) {
    fs.rmSync(path.join(dir, d), { recursive: true, force: true })
    console.log("Removed non-linux esbuild binary:", d)
  }
}
