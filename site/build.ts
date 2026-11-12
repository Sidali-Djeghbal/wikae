// Builds the static website into site/dist.
//   node site/build.ts            (run `npm run build` first: the card runtime needs web/dist/kit)
//
// The landing page runs real Etude card types with no server: the card frames, runtime and
// vendor files are copied here, and each demo's prepare and grade scripts run in the page with
// the same helpers (`std`, `rng`) the server's sandbox gives them.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cardFrame } from "../src/server/frame.ts";
import { fieldDefaults, loadTypeDir } from "../src/core/types.ts";
import { checkPublicContent } from "./public-content.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(here, "dist");
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const quick = process.argv.includes("--quick") && existsSync(join(out, "live/stats.js"));
checkPublicContent(here);
if (!existsSync(join(root, "web/dist/kit/kit.js"))) throw new Error("web/dist/kit is missing: run `npm run build` first");
if (!quick) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Pages and assets. {{VERSION}} is filled in from package.json.
cpSync(join(here, "src"), out, { recursive: true });
if (existsSync(join(root, "web/public/fonts"))) {
  cpSync(join(root, "web/public/fonts"), join(out, "fonts"), { recursive: true });
}
cpSync(join(root, "web/public/logo.svg"), join(out, "assets/logo.svg"));
cpSync(join(root, "web/public/logo.svg"), join(out, "logo.svg"));
cpSync(join(here, "src/assets/logo_black.svg"), join(out, "assets/logo_black.svg"));
cpSync(join(here, "src/assets/logo_white.svg"), join(out, "assets/logo_white.svg"));
cpSync(join(here, "src/assets/logo_black.svg"), join(out, "logo_black.svg"));
cpSync(join(here, "src/assets/logo_white.svg"), join(out, "logo_white.svg"));
cpSync(join(here, "src/assets/logo_black_en.svg"), join(out, "assets/logo_black_en.svg"));
cpSync(join(here, "src/assets/logo_white_en.svg"), join(out, "assets/logo_white_en.svg"));
cpSync(join(here, "src/assets/logo_black_en.svg"), join(out, "logo_black_en.svg"));
cpSync(join(here, "src/assets/logo_white_en.svg"), join(out, "logo_white_en.svg"));
for (const page of ["index.html", "download.html", "404.html"]) {
  const p = join(out, page);
  if (existsSync(p)) writeFileSync(p, readFileSync(p, "utf8").replaceAll("{{VERSION}}", pkg.version));
}

// The text pages: /sync and /support from site/pages/*.html, /terms and /privacy from the
// Markdown in site/legal/, all in one layout with the shared footer. GitHub Pages serves
// sync.html at /sync. The footer replaces the one in index.html and download.html,
// so every page links to Support and the legal pages.
{
  const { Marked } = await import("marked");
  const layout = readFileSync(join(here, "pages/layout.html"), "utf8");
  const footer = readFileSync(join(here, "pages/footer.html"), "utf8").trim();
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const page = (slug: string, title: string, description: string, body: string) =>
    layout
      .replaceAll("{{TITLE}}", attr(title))
      .replaceAll("{{DESCRIPTION}}", attr(description))
      .replaceAll("{{SLUG}}", slug)
      .replace("{{NAV_SYNC}}", slug === "sync" ? ' aria-current="page"' : "")
      .replace("{{NAV_SUPPORT}}", slug === "support" ? ' aria-current="page"' : "")
      .replace("{{BODY}}", body.trim())
      .replace("{{FOOTER}}", footer);
  const frontMatter = (src: string) => {
    const m = /^(?:---\n([\s\S]*?)\n---|<!--\n([\s\S]*?)\n-->)\n/.exec(src);
    if (!m) throw new Error("page is missing its front matter");
    const meta = Object.fromEntries((m[1] ?? m[2]).split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
    if (!meta.title || !meta.description) throw new Error("front matter needs title and description");
    return { meta, rest: src.slice(m[0].length) };
  };
  for (const slug of ["sync", "support"]) {
    const { meta, rest } = frontMatter(readFileSync(join(here, "pages", `${slug}.html`), "utf8"));
    writeFileSync(join(out, `${slug}.html`), page(slug, meta.title, meta.description, rest));
  }
  const LEGAL = [["terms", "Terms"], ["privacy", "Privacy"]] as const;
  const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const md = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return depth === 2 ? `<h2 id="${slugify(text)}">${text}</h2>\n` : `<h${depth}>${text}</h${depth}>\n`;
      },
      table(t) {
        const head = t.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
        const labels = t.header.map((c) => attr(c.text.replace(/[*_`]/g, "")));
        const rows = t.rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${labels[i]}">${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("\n");
        return `<div class="table-scroll"><table class="booktabs"><thead><tr>${head}</tr></thead><tbody>\n${rows}\n</tbody></table></div>\n`;
      },
    },
  });
  const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  for (const [slug] of LEGAL) {
    const { meta, rest } = frontMatter(readFileSync(join(here, "legal", `${slug}.md`), "utf8"));
    const html = (md.parse(rest) as string).replaceAll('<a href="http', '<a rel="noopener" href="http');
    const nav = LEGAL.map(([s, label]) => `<a href="${s}"${s === slug ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    const body = `<article class="legal" dir="ltr" lang="en"><div class="wrap">
<p class="opus">Legal <span>${attr(meta.title.toLowerCase())}</span></p>
<nav class="legal-nav" aria-label="Legal pages">${nav}</nav>
<div class="doc">
${html}</div>
<p class="legal-meta">Last updated ${date(meta["last-updated"])}. Questions: <a href="mailto:contact@djeghbal.me">contact@djeghbal.me</a>.</p>
</div></article>`;
    writeFileSync(join(out, `${slug}.html`), page(slug, meta.title, meta.description, body));
  }
  for (const f of ["index.html", "download.html"]) {
    const p = join(out, f);
    const s = readFileSync(p, "utf8");
    if (!/<footer class="footer">[\s\S]*?<\/footer>/.test(s)) throw new Error(`${f}: no footer to replace`);
    writeFileSync(p, s.replace(/<footer class="footer">[\s\S]*?<\/footer>/, () => footer));
  }
}

// The card runtime, exactly as the app serves it.
const rt = join(out, "runtime");
mkdirSync(join(rt, "vendor"), { recursive: true });
for (const f of ["runtime.js", "card.css", "code.css", "mathexpr.js"]) cpSync(join(root, "runtime", f), join(rt, f));
const katexDist = join(dirname(require.resolve("katex/package.json")), "dist");
cpSync(join(katexDist, "katex.mjs"), join(rt, "vendor/katex.js"));
cpSync(join(katexDist, "katex.min.css"), join(rt, "vendor/katex.css"));
cpSync(join(katexDist, "fonts"), join(rt, "vendor/fonts"), { recursive: true });
cpSync(join(dirname(require.resolve("marked/package.json")), "lib/marked.esm.js"), join(rt, "vendor/marked.js"));
cpSync(join(root, "web/dist/kit"), join(rt, "kit"), { recursive: true });
// The real scheduler, for the deadline chart.
mkdirSync(join(out, "vendor"), { recursive: true });
cpSync(join(root, "node_modules/ts-fsrs/dist/index.mjs"), join(out, "vendor/ts-fsrs.js"));

// The sandbox prelude (`std` and the seeded `rng`), taken from the engine so the two can't drift.
const sandbox = readFileSync(join(root, "src/core/sandbox.ts"), "utf8");
const prelude = /const PRELUDE = String\.raw`([\s\S]*?)\n`;/.exec(sandbox)?.[1];
if (!prelude) throw new Error("couldn't find PRELUDE in src/core/sandbox.ts");

// Demo cards and repertoire items.
const pack = JSON.parse(readFileSync(join(root, "examples/showcase.pack.json"), "utf8"));
const typeDir = (id: string) => [join(root, "examples/showcase/types", id), join(root, "types", id)].find((d) => existsSync(join(d, "type.json")))!;
const fontFace = `<style>@font-face{font-family:"Inter";src:url("assets/fonts/inter.woff2") format("woff2");font-weight:100 900;font-display:swap}@font-face{font-family:"JetBrains Mono";src:url("assets/fonts/jetbrains-mono.woff2") format("woff2");font-weight:100 800;font-display:swap}@font-face{font-family:"Cairo";src:url("assets/fonts/cairo-400-700-arabic.woff2") format("woff2");font-weight:400 700;font-display:swap}@font-face{font-family:"Amiri Quran";src:url("assets/fonts/amiri-quran.woff2") format("woff2");font-weight:400;font-display:swap}</style>`;
const demos: never[] = [];
// The repertoire: every card type in the box, live, for the visitor's own hands. Items come from
// the showcase pack (one per type) plus site/variants.json, more items of the same types that the
// repertoire rotates through but the tour in the app doesn't need.
const variants: { id: string; type: string; fields: Record<string, unknown> }[] = JSON.parse(readFileSync(join(here, "variants.json"), "utf8"));
const itemById = (id: string) => pack.items.find((i: { id: string }) => i.id === id) ?? variants.find((i) => i.id === id);
const REPERTOIRE: [string, [string, string, string, string[]][]][] = [
  ["Recall", [
    ["quran-mutashabihat", "Quranic Mutashabihat", "Complete the pivotal wording and distinguish similar verses.", [
      "showcase.quran.baqarah",
      "showcase.quran.baqarah_araf",
      "showcase.quran.qul_qulu",
      "showcase.quran.shafaa_adl",
      "showcase.quran.sariou_sabiqu",
    ]],
    ["basic", "Flip a card", "The classic: think of the answer, turn the card over, and be honest with yourself.", ["wikae.basic.tuhfah", "wikae.basic.jazariyyah", "wikae.basic.nawawi1"]],
    ["typed", "Type the answer", "A short answer typed from memory, checked against the accepted spellings.", ["wikae.typed.iqlab", "wikae.typed.madd", "wikae.typed.suwar"]],
    ["mcq", "Pick the answer", "Options shuffled every time, so you remember the answer, not its position.", ["wikae.mcq.qalqalah", "wikae.mcq.makki", "wikae.mcq.maddtabii"]],
    ["cloze", "Fill the blanks", "A verse or a hadith with holes in it. Each blank is checked on its own.", ["wikae.cloze.nawawi1", "wikae.cloze.tuhfah", "wikae.cloze.jazariyyah"]],
    ["match", "Match the pairs", "Wire each item to its partner. The right side comes shuffled.", [
      "showcase.match.quran",
      "showcase.match.naba",
      "showcase.match.tariq",
      "showcase.match.fajr",
      "showcase.match.takwir",
      "showcase.match.qariah",
    ]],
  ]],
  ["Calculate", [
    ["numeric", "Compute, with units", "Figures from fiqh and from your own hifz plan, with a tolerance on the answer.", ["wikae.numeric.zakat", "wikae.numeric.salat", "wikae.numeric.hifz"]],
    ["estimate", "Estimate it", "Slide to your best guess. Close is full credit, near is partial.", ["wikae.estimate.baqarah", "wikae.estimate.ayat"]],
  ]],
  ["Arrange", [
    ["order", "Put them in order", "Drag the blocks, or move them with the keyboard. Partial credit for what's already in order.", [
      "showcase.order.quran",
      "showcase.order.fatiha",
      "showcase.order.duha",
      "showcase.order.sharh",
      "showcase.order.naba",
      "showcase.order.tin",
    ]],
    ["timeline", "Place it in time", "Drag each event to its year. Graded on order and on how many years off.", ["wikae.timeline.seerah"]],
  ]],
];
// The new Market decks (site/tools/new-decks.mjs copies their types and a few real items into
// site/decks/). They live in the Market, not in examples/, so they're loaded from there.
type DeckFile = { type: any; items: { id: string; type: string; deck: string; fields: Record<string, unknown> }[]; assets: string[]; deck: { name: string; cards: number; decks: number } };
const deckFiles = new Map<string, DeckFile>(
  readdirSync(join(here, "decks")).filter((f) => f.endsWith(".json")).map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(here, "decks", f), "utf8"))]),
);
const deckItem = (id: string) => [...deckFiles.values()].flatMap((d) => d.items).find((i) => i.id === id);
// A type from the examples folder or from site/decks/, with the asset hashes its frame needs.
function loadSiteType(type: string): { def: any; assets?: { type: string; files: { name: string; hash: string }[] } } {
  const d = deckFiles.get(type);
  if (!d) return { def: loadTypeDir(typeDir(type), { assets: false }) };
  const files = d.assets.map((name) => ({ name, hash: createHash("sha256").update(readFileSync(join(here, "src/type-assets", type, name))).digest("hex") }));
  return { def: d.type, assets: { type, files } };
}
// The country map has two faces (name it / find it); the site picks one per item.
const FACE: Record<string, string> = { "geo.country.jpn": "locate", "geo.country.egy": "locate", "geo.country.mng": "locate" };

const GROUP_AR: Record<string, string> = {
  "Recall": "الاستحضار والتسميع",
  "Calculate": "الحساب والمعادلات",
  "Arrange": "الترتيب والتسلسل",
  "Explore": "الاستكشاف والخرائط",
  "Code": "البرمجة والخوارزميات",
  "Play & listen": "التدريب التفاعلي والسمعي",
  "Draw & write": "الكتابة الحرة والرسم",
};
const REP_AR: Record<string, [string, string]> = {
  "quran-mutashabihat": ["متشابهات القرآن", "أكمل الموضع المحوري في الآية الكريمة وميّز بين السور المتشابهة."],
  "basic": ["بطاقة وجه وقفا", "البطاقة الكلاسيكية: استحضر الجواب في ذهنك، ثم اقلب البطاقة وقيّم نفسك بأمانة."],
  "typed": ["كتابة الإجابة", "اكتب الإجابة المختصرة من ذاكرتك ليتم التحقق منها حرفياً مع قبول الصيغ المعتمدة."],
  "mcq": ["اختيار من متعدد", "خيارات تُرتب عشوائياً في كل مراجعة حتى تتذكر المعلومة لا موقع الخيار."],
  "cloze": ["ملء الفراغات", "نص يحتوي على فراغات مخفية، ويُصحّح كل فراغ على حدة بدقة."],
  "match": ["توصيل المفردات", "صِل كل مفردة قرآنية أو علمية ببيانها الصحيح بعد خلط العمود المقابل."],
  "numeric": ["حساب رقمي بالوحدات", "أرقام متجددة في كل مراجعة، مع قبول الوحدات وهامش التسامح المسموح."],
  "math": ["كتابة صيغة رياضية", "اكتب المعادلة بأي صيغة مكافئة رياضياً مع عرض تنسيقها الفوري أثناء الكتابة."],
  "estimate": ["تقدير القيمة", "حرّك المؤشر نحو أقرب تقدير؛ الدقة الكاملة تمنحك العلامة التامة والقريبة جزئية."],
  "balance": ["موازنة المعادلة", "عدّل المعاملات حتى تتوازن الذرات على الطرفين مع تحديث فوري للحساب."],
  "unit-circle": ["تحديد الزاوية", "حدد موضع الزاوية على دائرة الوحدة بالدرجات أو الراديان."],
  "plot": ["تحديد النقاط البيانية", "انقر على النقاط المطلوبة على الشبكة البيانية: الجذور أو الرؤوس أو التقاطعات."],
  "order": ["ترتيب الآيات والعناصر", "رتّب الآيات أو العناصر بالسحب والإفلات أو لوحة المفاتيح مع تقييم جزئي للتسلسل."],
  "timeline": ["الخط الزمني", "ضع كل حدث في سنته الصحيحة على الخط الزمني مع حساب دقة الترتيب والسنوات."],
  "graph-walk": ["تتبع المخطط البياني", "انقر على العقد بالترتيب الذي تسلكه الخوارزمية على مخطط متجدد."],
  "country-map": ["تحديد الموقع على الخريطة", "سمِّ الدولة المظللة أو حدد موقعها على خريطة تفاعلية قابلة للتكبير."],
  "element": ["الجدول الدوري", "حدد العنصر على جدول دوري فارغ أو اذكر مجموعته وتوزيعه الإلكتروني."],
  "code": ["كتابة دالة برمجية", "محرر شيفرات حقيقي ينفّذ إجابتك ضد اختبارات مخفية داخل بيئة معزولة."],
  "regex": ["التعابير النمطية (Regex)", "تضيء الاختبارات الظاهرة أثناء كتابتك بينما تحسم الاختبارات المخفية النتيجة."],
  "bug-hunt": ["اكتشاف الخطأ البرمجي", "أشر إلى السطر الذي يحوي العلة البرمجية ليظهر لك التصحيح بعدها."],
  "bits": ["التمثيل الثنائي (Bits)", "بدّل الخانات الثنائية حتى تطابق الرقم المطلوب."],
  "chess": ["كش مات في نقلة", "اعثر على نقلة الحسم على رقعة الشطرنج بالسحب أو النقر."],
  "chord": ["تركيب التآلف الصوتي", "اعزف النغمات المطلوبة على لوحة المفاتيح الصوتية."],
  "staff": ["قراءة المدرج الموسيقي", "اقرأ النغمة من المدرج واعزفها مباشرة."],
  "interval": ["تمييز المسافات الصوتية", "تدريب سمعي لتمييز المسافة بين نغمتين متتاليتين."],
  "color": ["مزج الألوان", "ركّب اللون المطابق لرمز Hex عبر التحكم في التدرج والتشبع والإضاءة."],
  "sprint": ["سباق الحساب الذهني", "ثلاثون ثانية من الحساب الذهني السريع تُرسل نتيجتها تلقائياً عند انتهاء الوقت."],
  "typing": ["سرعة الطباعة", "اختبار سرعة ودقة الكتابة يبدأ مع أول ضغطة مفتاح ويحسب عدد الكلمات في الدقيقة."],
  "flippy": ["تحويل الأرقام الست عشرية", "تمرين سريع لتحويل الأرقام الست عشرية إلى ثنائية."],
  "free": ["البرهان والكتابة الحرة", "اكتب البرهان أو الإجابة التفصيلية بأسلوبك مع دعم الرموز الرياضية."],
  "draw": ["الرسم والكتابة اليدوية", "ارسم أو اكتب بخط يدك بالماوس أو اللمس ليقرأه نموذج الرؤية."],
};

// In the repertoire the card has most of the content width, so only the tallest pieces are capped.
const galleryFit = `<style>.ch-board svg{max-width:21rem}.uc-stage{max-width:300px}.gw-svg{max-width:340px}.pl-stage{max-width:330px}.st-staff svg{max-width:20rem}body[data-mode=result] .ch-board svg{max-width:15rem}</style>`;
// A card focuses its first input when it mounts. Down here that would pull the keyboard (and on a
// phone, the on-screen keyboard) into a card the visitor only scrolled past, so focus waits until
// the page says they picked it.
const holdFocus = `<script>(() => { let ok = false; const f = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function (o) { if (ok) return f.call(this, { ...(o ?? {}), preventScroll: true }); }; addEventListener("message", (e) => { if (e.source === parent && e.data?.etude === 1 && e.data.type === "rep-focus") ok = true; }); })();</script>`;
mkdirSync(join(out, "frames/gallery"), { recursive: true });
const gallery = REPERTOIRE.flatMap(([group, entries]) => entries.map(([type, label, desc, ids]) => {
  const { def, assets } = loadSiteType(type);
  const html = cardFrame(def, "__BASE__", assets)
    .replace('<base href="__BASE__">', `<base href="../../">${fontFace}`)
    .replace("</head>", `${galleryFit}\n<script src="assets/demo-driver.js"></script>\n${holdFocus}\n</head>`)
    .replaceAll("__BASE__", "./");
  writeFileSync(join(out, "frames/gallery", `${def.id}.html`), html);
  const items = ids.map((id) => {
    const item = itemById(id) ?? deckItem(id);
    if (!item) throw new Error(`repertoire: no item ${id}`);
    if (item.type !== type) throw new Error(`repertoire: ${id} is a ${item.type} item, not ${type}`);
    // Watch-mode example answers stay in the app.
    const { demo: _d, demoGrade: _g, ...own } = item.fields as Record<string, unknown>;
    return { id, fields: { ...fieldDefaults(def), ...own }, ...(FACE[id] ? { face: FACE[id] } : {}) };
  });
  const g = def.grader as { kind: string; code?: string };
  const prep = def.prepare ?? "";
  const ar = REP_AR[type];
  return {
    group,
    groupAr: GROUP_AR[group] ?? group,
    label,
    labelAr: ar?.[0] ?? label,
    type: def.id,
    name: def.name,
    desc,
    descAr: ar?.[1] ?? desc,
    // script, hybrid (a script that may hand the answer to AI), ai or self
    grader: g.kind,
    // A type that hides its verdict (a drill like Flippy Bit) reports its numbers instead.
    quiet: def.showVerdict === false,
    metrics: def.metrics ?? null,
    // Ends itself (game over): no Check button while it runs.
    auto: type === "flippy",
    grade: g.code ?? null,
    prepare: def.prepare ?? null,
    private: def.fields.filter((f: { private?: boolean }) => f.private).map((f: { name: string }) => f.name),
    // What another go gives you: a new variant (a generator, random picks or another item), the
    // same card reshuffled, or the same card again.
    again: items.length > 1 || items.some((i) => typeof i.fields.generator === "string") || /\brng\.(int|float|pick|bool|next)\b/.test(prep) ? "variant" : /\brng\.shuffle\b/.test(prep) ? "shuffle" : "reset",
    items,
  };
}));

// Highlighted source for the "card types are code" section and the generator example, using the
// same highlighter classes (tok-*) as the app, styled by runtime/code.css.
const { highlightCode, classHighlighter } = await import("@lezer/highlight");
const { javascriptLanguage } = await import("@codemirror/lang-javascript");
const { jsonLanguage } = await import("@codemirror/lang-json");
const { htmlLanguage } = await import("@codemirror/lang-html");
const { cssLanguage } = await import("@codemirror/lang-css");
const LANGS = { js: javascriptLanguage, json: jsonLanguage, html: htmlLanguage, css: cssLanguage } as const;
const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
function highlight(code: string, lang: keyof typeof LANGS): string {
  let html = "";
  highlightCode(code, LANGS[lang].parser.parse(code), classHighlighter, (text, cls) => {
    html += cls ? `<span class="${cls}">${escapeHtml(text)}</span>` : escapeHtml(text);
  }, () => (html += "\n"));
  return html;
}
const showType = join(root, "types/quran-mutashabihat");
const FILES = [
  ["type.json", "json", "The fields an item fills in, which of them stay private, and the grader.", "الحقول التي تملؤها البطاقة، وأيها يبقى سرياً على الخادم، وإعدادات المصحح."],
  ["template.html", "html", "What the card shows. Blocks inside <template data-on=\"result\"> appear after grading.", "واجهة العرض للبطاقة؛ والأقسام داخل <template data-on=\"result\"> تظهر بعد التصحيح."],
  ["style.css", "css", "Styles for this card only, built on the theme's variables.", "تنسيقات CSS الخاصة بهذا النوع فقط، مبنية على متغيرات المظهر العام."],
  ["prepare.js", "js", "Runs on the server: prepares the verse prompt and keeps the answer out of the frame.", "يعمل قبل العرض: يجهز موضع السؤال في الآية ويبقي الإجابة الصحيحة خارج الإطار."],
  ["card.js", "js", "Runs in the card's sandboxed frame: the interactive verse prompt and answer reporting.", "يعمل داخل إطار البطاقة المعزول: يدير التفاعل مع الآية وإرسال إجابة المتعلم."],
  ["grade.js", "js", "Runs on the server: normalizes Arabic tashkeel and grades the verse completion.", "يعمل عند التقييم: يطبّع الحركات والرسم ويتحقق من دقة إكمال الآية وتمييز السورة."],
] as const;
const files = FILES.map(([name, lang, note, noteAr]) => {
  const src = readFileSync(join(showType, name), "utf8");
  return { name, note, noteAr, lines: src.split("\n").length, html: highlight(src.replace(/\n$/, ""), lang) };
});
// The schedulers that ship with Wikae, run in the Tempo section exactly as the engine runs them,
// plus the example a user writes in docs/schedulers.md.
const schedDoc = readFileSync(join(root, "docs/schedulers.md"), "utf8");
const SCHEDULERS = {
  drill: readFileSync(join(root, "schedulers/drill/schedule.js"), "utf8"),
  leitner: readFileSync(join(root, "schedulers/leitner/schedule.js"), "utf8"),
  monday: /```js\n(\/\/ Next Monday[\s\S]*?)```/.exec(schedDoc)?.[1] ?? "",
};
if (!SCHEDULERS.monday) throw new Error("couldn't find the every-monday example in docs/schedulers.md");
const derivative = itemById("showcase.math.derivative")!;
const generator = { code: derivative.fields.generator as string, html: highlight(derivative.fields.generator, "js") };

writeFileSync(
  join(out, "data.js"),
  `// Generated by site/build.ts.\nexport const PRELUDE = ${JSON.stringify(prelude)};\nexport const DEMOS = ${JSON.stringify(demos)};\nexport const TYPE_FILES = ${JSON.stringify(files)};\nexport const GENERATOR = ${JSON.stringify(generator)};\nexport const GALLERY = ${JSON.stringify(gallery)};\nexport const SCHEDULERS = ${JSON.stringify(SCHEDULERS)};\n`,
);

// The live Stats panels: the app's own React components with the demo snapshots, into dist/live/.
if (!quick) {
  execFileSync(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "build", "--config", join(here, "stats-embed/vite.config.ts")], { cwd: root, stdio: "inherit" });
}

const BASE_URL = "https://sidali-djeghbal.github.io/wikae";
const sitemapPages = ["", "download.html", "sync.html", "support.html", "terms.html", "privacy.html"];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapPages.map((p) => `  <url>
    <loc>${BASE_URL}/${p}</loc>
    <xhtml:link rel="alternate" hreflang="ar" href="${BASE_URL}/${p}?lang=ar"/>
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/${p}?lang=en"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/${p}"/>
  </url>`).join("\n")}
</urlset>\n`;
writeFileSync(join(out, "sitemap.xml"), sitemapXml);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);

console.log(JSON.stringify({ out, version: pkg.version, demos: demos.length, gallery: gallery.length }));
