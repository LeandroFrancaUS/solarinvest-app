// scripts/clean-esbuild.mjs
import fs from "node:fs"
import path from "node:path"

if (process.platform !== "linux") {
  console.log("[postinstall] Skipping esbuild cleanup on:", process.platform)
  process.exit(0)
}

const dir = path.resolve("node_modules/@esbuild")

if (fs.existsSync(dir)) {
  const subdirs = fs.readdirSync(dir)
  for (const d of subdirs) {
    if (!d.includes("linux")) {
      fs.rmSync(path.join(dir, d), { recursive: true, force: true })
      console.log("Removed non-linux esbuild binary:", d)
    }
  }
}
