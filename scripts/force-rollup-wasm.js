import fs from "fs";
function clean(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}
clean("node_modules/@rollup/rollup-linux-x64-gnu");
clean("node_modules/@rollup/rollup-linux-x64-musl");
