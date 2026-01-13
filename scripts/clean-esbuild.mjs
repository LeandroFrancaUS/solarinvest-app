// scripts/clean-esbuild.mjs
import fs from "fs"
import path from "path"

const dir = path.resolve("node_modules/@esbuild")

// ✅ Só faz cleanup quando estiver rodando em Linux (ex.: build no Vercel/CI)
// Em dev (darwin/win32) NÃO remove nada.
if (process.platform !== "linux") {
  console.log("[clean-esbuild] Skipping on", process.platform)
  process.exit(0)
}

if (fs.existsSync(dir)) {
  const subdirs = fs.readdirSync(dir)
  for (const d of subdirs) {
    if (!d.includes("linux")) {
      fs.rmSync(path.join(dir, d), { recursive: true, force: true })
      console.log("[clean-esbuild] Removed non-linux esbuild binary:", d)
    }
  }
}
