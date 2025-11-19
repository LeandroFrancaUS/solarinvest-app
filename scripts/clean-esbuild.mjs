import fs from "fs"
import path from "path"

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
