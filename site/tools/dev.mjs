// Watches site/ sources, rebuilds site/dist/ on save, and runs site/tools/serve.mjs.
//   npm run site:dev [port]
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const port = process.argv[2] ?? "4620";

let building = false;
let pendingFull = false;
let pendingQuick = false;
let timer = null;

function runBuild(full = false) {
  if (building) {
    if (full) pendingFull = true;
    else pendingQuick = true;
    return;
  }
  building = true;
  const t0 = performance.now();
  const args = full ? ["site/build.ts"] : ["site/build.ts", "--quick"];
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  child.on("exit", (code) => {
    building = false;
    const ms = Math.round(performance.now() - t0);
    if (code === 0) {
      console.log(`[site:dev] rebuilt in ${ms}ms (${full ? "full" : "quick"})`);
      fetch(`http://127.0.0.1:${port}/_reload_trigger`).catch(() => {});
    } else {
      console.error(`[site:dev] build failed with code ${code}`);
    }
    if (pendingFull || pendingQuick) {
      const nextFull = pendingFull;
      pendingFull = false;
      pendingQuick = false;
      runBuild(nextFull);
    }
  });
}

runBuild(true);

const server = spawn(process.execPath, ["site/tools/serve.mjs", port], { cwd: root, stdio: "inherit" });

const schedule = (full) => {
  clearTimeout(timer);
  timer = setTimeout(() => runBuild(full), 120);
};

for (const rel of ["site/src", "site/pages", "site/legal", "site/build.ts", "site/variants.json", "types"]) {
  watch(join(root, rel), { recursive: true }, () => schedule(false));
}
watch(join(root, "site/stats-embed"), { recursive: true }, () => schedule(true));

const shutdown = () => {
  server.kill();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

