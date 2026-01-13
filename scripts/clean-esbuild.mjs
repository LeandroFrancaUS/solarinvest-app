// scripts/clean-esbuild.mjs
import fs from "fs"
import path from "path"

const dir = path.resolve("node_modules/@esbuild")

const platform = process.platform // "darwin", "linux", "win32"
const arch = process.arch         // "arm64", "x64", etc.

const keep = `${platform}-${arch}`

if (!fs.existsSync(dir)) {
  process.exit(0)
}

for (const d of fs.readdirSync(dir)) {
  // Só mexe em pastas que parecem bins do esbuild (ex: darwin-arm64, linux-x64, win32-x64)
  if (!/^(darwin|linux|win32)-/.test(d)) continue

  // Mantém a pasta da sua plataforma/arch
  if (d === keep) continue

  fs.rmSync(path.join(dir, d), { recursive: true, force: true })
  console.log(`Removed esbuild binary not for this platform: ${d} (keeping ${keep})`)
}
