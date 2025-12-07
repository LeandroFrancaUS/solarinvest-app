import fs from "fs";
import path from "path";

function clean(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

const rollupDir = "node_modules/@rollup";

if (fs.existsSync(rollupDir)) {
  for (const entry of fs.readdirSync(rollupDir)) {
    if (entry.startsWith("rollup-")) {
      clean(path.join(rollupDir, entry));
    }
  }
}
