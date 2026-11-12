// Download page: picks the visitor's OS, shows the matching commands, theme toggle, and language toggle.
import { initThemeToggle } from "./theme.js";
import { initLanguageToggle } from "./i18n.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const nav = $("#nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
initThemeToggle();
initLanguageToggle();

const revealer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), revealer.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" });
$$("[data-reveal]").forEach((el) => revealer.observe(el));

const OS = {
  mac: {
    note: "With Homebrew, or the installer from <a href=\"https://nodejs.org/en/download\">nodejs.org</a>.",
    noteAr: "عبر Homebrew، أو المثبّت الرسمي من <a href=\"https://nodejs.org/en/download\">nodejs.org</a>.",
    cmd: ["brew install node", "node --version   # v24 or newer"],
    cmdAr: ["brew install node", "node --version   # الإصدار 24 أو أحدث"],
    ps: "$ ",
    home: "~/.wikae/wikae.db",
    env: "~/.wikae/.env",
  },
  windows: {
    note: "In PowerShell with winget, or the installer from <a href=\"https://nodejs.org/en/download\">nodejs.org</a>. You'll also want <a href=\"https://git-scm.com/download/win\">Git</a>.",
    noteAr: "في PowerShell عبر winget، أو المثبّت من <a href=\"https://nodejs.org/en/download\">nodejs.org</a>، مع تثبيت <a href=\"https://git-scm.com/download/win\">Git</a>.",
    cmd: ["winget install OpenJS.NodeJS Git.Git", "node --version   # v24 or newer"],
    cmdAr: ["winget install OpenJS.NodeJS Git.Git", "node --version   # الإصدار 24 أو أحدث"],
    ps: "> ",
    home: "%USERPROFILE%\\.wikae\\wikae.db",
    env: "%USERPROFILE%\\.wikae\\.env",
  },
  linux: {
    note: "With your package manager, or a version manager like <a href=\"https://mise.jdx.dev\">mise</a> or <a href=\"https://github.com/nvm-sh/nvm\">nvm</a> if your distribution ships an older Node.",
    noteAr: "عبر مدير الحزم في توزيعتك، أو مدير إصدارات مثل <a href=\"https://mise.jdx.dev\">mise</a> أو <a href=\"https://github.com/nvm-sh/nvm\">nvm</a>.",
    cmd: ["mise use -g node@24", "node --version   # v24 or newer"],
    cmdAr: ["mise use -g node@24", "node --version   # الإصدار 24 أو أحدث"],
    ps: "$ ",
    home: "~/.wikae/wikae.db",
    env: "~/.wikae/.env",
  },
};

function detect() {
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  if (p.includes("win")) return "windows";
  if (p.includes("linux") || p.includes("x11") || p.includes("cros")) return "linux";
  return "mac";
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
let currentOs = "mac";
function show(os) {
  currentOs = os;
  const o = OS[os];
  const isAr = document.documentElement.getAttribute("lang") === "ar";
  $$("[data-os]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.os === os)));
  const noteEl = $("[data-node-note]");
  if (noteEl) noteEl.innerHTML = isAr ? o.noteAr : o.note;
  const pre = $("[data-node-cmd]");
  if (pre) {
    const cmds = isAr ? o.cmdAr : o.cmd;
    pre.innerHTML = cmds.map((c) => {
      const [cmd, comment] = c.split(/(?=\s+#)/);
      return `<span class="ps">${o.ps}</span>${esc(cmd)}${comment ? `<span class="c">${esc(comment)}</span>` : ""}`;
    }).join("\n");
    if (pre.nextElementSibling) pre.nextElementSibling.dataset.copyText = o.cmd[0];
  }
  $$("[data-ps]").forEach((s) => (s.textContent = o.ps));
  const homeEl = $("[data-home]");
  if (homeEl) homeEl.textContent = o.home;
  const envEl = $("[data-env]");
  if (envEl) envEl.textContent = o.env;
  const panel = $("[data-panel]");
  if (panel) {
    panel.dataset.show = os;
    panel.classList.remove("os-panel"); void panel.offsetWidth; panel.classList.add("os-panel");
  }
  history.replaceState(null, "", `#${os}`);
}
$$("[data-os]").forEach((b) => b.addEventListener("click", () => show(b.dataset.os)));
window.addEventListener("wikae-lang-change", () => show(currentOs));

// The terminal steps open on request.
$$("[data-term-toggle]").forEach((b) =>
  b.addEventListener("click", () => {
    const open = $("[data-panel]").classList.toggle("show-term");
    $$("[data-term-toggle]").forEach((t) => t.setAttribute("aria-expanded", String(open)));
  }),
);

// Mac: Intel Macs get the Intel build as the main button when the browser can tell.
async function macChip() {
  if (!/Macintosh|Mac OS X/.test(navigator.userAgent)) return "arm";
  try {
    const h = await navigator.userAgentData?.getHighEntropyValues?.(["architecture"]);
    if (h?.architecture) return h.architecture === "x86" ? "intel" : "arm";
  } catch {}
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
    if (/apple m\d|apple gpu/i.test(r)) return "arm";
    if (/intel|amd|radeon|nvidia/i.test(r)) return "intel";
  } catch {}
  return "arm";
}
macChip().then((chip) => {
  if (chip !== "intel") return;
  const main = $("[data-mac-main]"), alt = $("[data-mac-alt]");
  if (!main || !alt) return;
  [main.href, alt.href] = [alt.href, main.href];
  const mainAr = main.querySelector('[data-lang="ar"]');
  const mainEn = main.querySelector('[data-lang="en"]');
  if (mainAr) mainAr.textContent = "تحميل لأجهزة Mac بمعالج Intel";
  if (mainEn) mainEn.textContent = "Download for Intel Mac";
  const altAr = alt.querySelector('[data-lang="ar"]');
  const altEn = alt.querySelector('[data-lang="en"]');
  if (altAr) altAr.textContent = "جهاز Mac بمعالج Apple Silicon (M1 أو أحدث)؟ اضغط هنا";
  if (altEn) altEn.textContent = "Mac with Apple Silicon (M1 or newer)?";
});
show(OS[location.hash.slice(1)] ? location.hash.slice(1) : detect());

if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  const mb = $("[data-mobile-banner]");
  if (mb) mb.hidden = false;
}

// Every command block gets a copy button.
const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
for (const c of $$(".cmd")) {
  if (c.querySelector(".copy-btn")) continue;
  const pre = c.querySelector("pre");
  c.insertAdjacentHTML("beforeend", `<button class="copy-btn" type="button" aria-label="Copy">${COPY_ICON}</button>`);
  const out = pre.querySelector(".out");
  if (out) c.lastElementChild.dataset.copyText = pre.textContent.replace(out.textContent, "").replace(/^[>$] /gm, "").trim();
}
for (const b of $$(".cmd .copy-btn")) {
  b.addEventListener("click", async () => {
    const text = b.dataset.copyText ?? b.previousElementSibling.textContent.replace(/^[>$] /gm, "");
    try { await navigator.clipboard.writeText(text); } catch { return; }
    b.classList.add("done");
    setTimeout(() => b.classList.remove("done"), 1400);
  });
}
