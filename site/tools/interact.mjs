// End-to-end interactive check of the Wikae landing page: tests the hero Mutashabihat challenge,
// the live #decks suite (quran-mutashabihat, order, match), #exams & #tempo FSRS charts, #market,
// and #repertoire, reporting any runtime exceptions.
//   node site/tools/interact.mjs <base-url> <outdir> [width]
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const [BASE, OUT, WIDTH = "1440"] = process.argv.slice(2);
const width = Number(WIDTH), mobile = width < 700;
mkdirSync(OUT, { recursive: true });
const profile = `${process.env.TMPDIR ?? "/tmp"}/wikae-site-int-${process.pid}`;
const port = 9500 + (process.pid % 40);
const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  for (const bin of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    try { return execFileSync("which", [bin], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
  }
  return "chromium";
};
const chrome = spawn(findChrome(), ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    break;
  } catch { await sleep(200); }
}
let id = 0;
const pending = new Map(), errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails?.exception?.description?.split("\n")[0] ?? d.params.exceptionDetails?.text);
};
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, "base64")); };

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height: mobile ? 844 : 900, deviceScaleFactor: 2, mobile });
await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
await send("Page.navigate", { url: BASE + "index.html" });
await sleep(2500);

const report = {};

// 1. Hero interactive Mutashabihat preview
await evaluate(`document.querySelector('[data-hero-answer="correct"]')?.click()`);
await sleep(300);
report.heroChallenge = await evaluate(`(() => {
  const btn = document.querySelector('[data-hero-answer="correct"]');
  const fb = document.querySelector('#hero-proof-feedback-correct');
  return { answered: btn?.classList.contains('is-correct') ?? false, feedbackVisible: fb ? !fb.hidden : false };
})()`);
await shot("hero-answered");

// 2. Live #decks section (quran-mutashabihat, order, match)
await evaluate(`document.querySelector("#decks")?.scrollIntoView({ behavior: "instant" })`);
await sleep(2200);
report.decksInitial = await evaluate(`window.__suite?.()`);
await shot("decks-mutashabihat");

await evaluate(`document.querySelector('[data-suite-type="order"]')?.click()`);
await sleep(1800);
report.decksOrder = await evaluate(`window.__suite?.()`);

await evaluate(`document.querySelector('[data-suite-type="match"]')?.click()`);
await sleep(1800);
report.decksMatch = await evaluate(`window.__suite?.()`);

// 3. #exams & #tempo FSRS charts
await evaluate(`document.querySelector("#exams")?.scrollIntoView({ behavior: "instant" })`);
await sleep(1000);
report.examChartPaths = await evaluate(`document.querySelectorAll('#exam [data-chart] svg path').length`);

await evaluate(`document.querySelector("#tempo")?.scrollIntoView({ behavior: "instant" })`);
await sleep(1000);
report.tempoChartCircles = await evaluate(`document.querySelectorAll('[data-tempo-chart] svg circle').length`);

// 4. #market snapshot
await evaluate(`document.querySelector("#market")?.scrollIntoView({ behavior: "instant" })`);
await sleep(1500);
report.marketCount = await evaluate(`document.querySelectorAll('[data-market-grid] .mk').length`);

// 5. #repertoire live card gallery
await evaluate(`document.querySelector("#repertoire")?.scrollIntoView({ behavior: "instant" })`);
await sleep(2200);
report.repertoireActiveType = await evaluate(`window.__rep?.()?.type ?? null`);
await shot("repertoire-mounted");

report.errors = errors;
console.log(JSON.stringify(report, null, 2));
ws.close(); chrome.kill(); await sleep(300);
rmSync(profile, { recursive: true, force: true });
if (errors.length) process.exit(1);
