// Static link check for the built site: local targets, anchors and release assets.
//   node site/tools/check-links.mjs [dist-dir]
// Local problems fail the check. Missing release binaries are reported as a CI warning: the
// download buttons only work after desktop.yml has attached installers to the release.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.argv[2] ?? join(here, "..", "dist"));
const BASE = "https://sidali-djeghbal.github.io/wikae/";
const problems = [];

function htmlFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    // Card frames resolve their paths through <base href> in the card runtime, not this folder.
    if (entry.isDirectory() && relative(dist, p) !== "frames") htmlFiles(p, out);
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}
const pages = htmlFiles(dist);
const ids = new Map();
const contents = new Map();
for (const file of pages) {
  const html = readFileSync(file, "utf8");
  contents.set(file, html);
  const found = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dup = found.filter((id, i) => found.indexOf(id) !== i);
  if (dup.length) problems.push(`${relative(dist, file)}: duplicate ids ${[...new Set(dup)].join(", ")}`);
  ids.set(file, new Set(found));
}

for (const file of pages) {
  const html = contents.get(file);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let ref = m[1];
    if (!ref || ref.startsWith("#") || /^(?:https?:)?\/\//.test(ref) || /^(?:mailto:|tel:|data:|javascript:)/.test(ref) || ref.includes("{{")) continue;
    // Canonical and hreflang links are absolute; map the site's own host back to dist.
    if (ref.startsWith(BASE)) ref = ref.slice(BASE.length);
    const [path, hash] = ref.split("#");
    let target = resolve(dirname(file), decodeURIComponent(path || "."));
    if (!target.startsWith(dist)) { problems.push(`${relative(dist, file)}: outside dist: ${ref}`); continue; }
    if (!existsSync(target) && existsSync(target + ".html")) target += ".html";
    if (!existsSync(target) && existsSync(join(target, "index.html"))) target = join(target, "index.html");
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
    if (!existsSync(target)) { problems.push(`${relative(dist, file)}: missing ${ref}`); continue; }
    if (hash && target.endsWith(".html") && !ids.get(target)?.has(decodeURIComponent(hash))) {
      problems.push(`${relative(dist, file)}: no anchor #${hash} in ${relative(dist, target)}`);
    }
  }
}

const expected = [
  "Wikae-mac-apple-silicon.dmg", "Wikae-mac-intel.dmg", "Wikae-windows-setup.exe",
  "Wikae-linux-amd64.deb", "Wikae-linux-x86_64.rpm", "Wikae-linux-x86_64.AppImage",
];
try {
  const r = await fetch("https://api.github.com/repos/Sidali-Djeghbal/wikae/releases/latest", { headers: { "User-Agent": "wikae-site-check" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const release = await r.json();
  const names = new Set((release.assets ?? []).map((a) => a.name));
  const missing = expected.filter((name) => !names.has(name));
  if (missing.length) console.log(`::warning::Latest release ${release.tag_name} has no installers: ${missing.join(", ")}. Download buttons will 404 until desktop.yml attaches them.`);
} catch (e) {
  console.log(`::warning::Could not check release assets: ${e.message}`);
}

console.log(JSON.stringify({ pages: pages.length, problems }, null, 1));
if (problems.length) process.exitCode = 1;
