import fs from "fs";
import path from "path";

function isMusl() {
  // Adapted from rollup's own platform detection
  if (process.report && typeof process.report.getReport === "function") {
    const report = process.report.getReport();
    return !report.header?.glibcVersionRuntime;
  }

  return process.versions?.musl != null;
}

function expectedRollupBinary() {
  const { platform, arch } = process;

  switch (platform) {
    case "darwin":
      return `rollup-darwin-${arch}`;
    case "linux":
      return `rollup-linux-${arch}-${isMusl() ? "musl" : "gnu"}`;
    case "win32":
      return `rollup-win32-${arch}-msvc`;
    case "android":
      return `rollup-android-${arch}`;
    default:
      return null;
  }
}

function clean(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

const rollupDir = "node_modules/@rollup";
const keep = expectedRollupBinary();

if (fs.existsSync(rollupDir) && keep) {
  for (const entry of fs.readdirSync(rollupDir)) {
    if (entry.startsWith("rollup-") && entry !== keep) {
      clean(path.join(rollupDir, entry));
    }
  }
}
