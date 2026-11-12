// The Wikae website. Everything that looks live is: the hero runs real card types with the app's
// card runtime and grades them with the types' own scripts; the deadline chart runs ts-fsrs.
import katex from "../runtime/vendor/katex.js";
import math from "../runtime/mathexpr.js";
import { PRELUDE, TYPE_FILES, GENERATOR, GALLERY, SCHEDULERS } from "../data.js";
import { initThemeToggle } from "./theme.js";
import { initLanguageToggle, getCurrentLang } from "./i18n.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const tex = (s, display = false) => katex.renderToString(s, { throwOnError: false, displayMode: display, output: "html" });
/** Inline markdown that's enough for prompts and feedback: $math$, $$display$$, **bold**, *italic*, `code`. */
function md(s) {
  return String(s ?? "")
    .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\n\n)/)
    .map((p) => {
      if (p.startsWith("$$")) return tex(p.slice(2, -2), true);
      if (p.startsWith("$") && p.length > 2) return tex(p.slice(1, -1));
      if (p.startsWith("**")) return `<strong>${esc(p.slice(2, -2))}</strong>`;
      if (p.startsWith("*") && p.length > 2) return `<em>${esc(p.slice(1, -1))}</em>`;
      if (p.startsWith("`")) return `<code>${esc(p.slice(1, -1))}</code>`;
      if (p === "\n\n") return "<br>";
      return esc(p);
    })
    .join("");
}
/** Runs `fn` once when `el` first scrolls into view. */
function whenVisible(el, fn, margin = "0px 0px -15% 0px") {
  if (!el) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (io.disconnect(), fn())), { rootMargin: margin });
  io.observe(el);
}
/** Tracks whether `el` is on screen, for loops that should pause off screen. */
function visibility(el) {
  const state = { on: false };
  new IntersectionObserver((es) => es.forEach((e) => (state.on = e.isIntersecting)), { threshold: 0.2 }).observe(el);
  return state;
}

/**
 * Card frames load without a blank flash: the card on screen stays (and stops taking input) while
 * the next one loads out of sight, and the skeleton only shows when loading takes long enough to
 * notice, as it does on a first visit or a slow connection. Switching between cached cards is a
 * crossfade.
 */
function frameSwapper(body, loader) {
  let timer = null, shown = null;
  return {
    add(frame) {
      clearTimeout(timer);
      for (const f of $$("iframe", body)) if (f !== shown) f.remove();
      if (shown) {
        // Lift the old card out of the flow where it is, so the new one can take its place.
        const { offsetTop: top, offsetLeft: left, offsetWidth: width } = shown;
        Object.assign(shown.style, { position: "absolute", top: `${top}px`, left: `${left}px`, width: `${width}px` });
        shown.classList.add("leaving");
      }
      body.appendChild(frame);
      const slow = () => { shown?.classList.add("gone"); loader.classList.remove("hide"); };
      if (shown) timer = setTimeout(slow, 220); else slow();
    },
    mounted(frame) {
      clearTimeout(timer);
      if (shown && shown !== frame) shown.remove();
      shown = frame;
      frame.classList.remove("loading");
      frame.classList.add("enter");
      loader.classList.add("hide");
    },
  };
}
// Card frames on this site are same-origin (allow-same-origin): every card here is one of
// Wikae's own types, and a same-origin frame shares the page's HTTP cache, so KaTeX, the runtime
// and the fonts download once instead of once per card. The app keeps its frames opaque-origin,
// because there a card can come from anyone.
const SANDBOX = "allow-scripts allow-same-origin";

// ------------------------------------------------------------------ page chrome
const nav = $("#nav");
let lastY = Math.max(0, scrollY);
const onScroll = () => {
  const y = Math.max(0, scrollY);
  nav.classList.toggle("scrolled", y > 8);
  if (y <= 80) {
    nav.classList.remove("nav-hidden");
    lastY = y;
  } else if (y > lastY + 12) {
    nav.classList.add("nav-hidden");
    lastY = y;
  } else if (y < lastY - 2) {
    nav.classList.remove("nav-hidden");
    lastY = y;
  }

  // Hero parallax: gentle depth shift on the hero's pseudo glow layer
  if (!reduced) {
    const hero = $(".hero");
    if (hero && y < innerHeight * 1.5) {
      hero.style.setProperty("--hero-parallax", `${y * 0.18}px`);
    }
  }
};
addEventListener("scroll", onScroll, { passive: true });
nav.addEventListener("focusin", () => nav.classList.remove("nav-hidden"));
onScroll();
initThemeToggle();
initLanguageToggle();

// Scroll-reveal: handles both [data-reveal] and [data-stagger] containers.
// Elements with [data-stagger] animate their children in sequence.
const revealer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      revealer.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px" }
);
$$("[data-reveal]").forEach((el) => revealer.observe(el));
$$("[data-stagger]").forEach((el) => {
  [...el.children].forEach((child, i) => child.style.setProperty("--i", i));
  revealer.observe(el);
});

for (const b of $$("[data-copy]")) {
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch { return; }
    b.classList.add("done");
    setTimeout(() => b.classList.remove("done"), 1400);
  });
}

fetch("https://api.github.com/repos/Sidali-Djeghbal/wikae")
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    const n = d?.stargazers_count;
    const el = $("[data-stars]");
    if (el && n > 0) { el.textContent = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); el.hidden = false; }
  })
  .catch(() => {});

// ------------------------------------------------- the card engine, in the page
// Same helpers as the server's QuickJS sandbox (src/core/sandbox.ts), same seeding as the engine.
function runScript(body, params, args, seed) {
  const bindings = params.map((p) => (p === "rng" ? `__makeRng(${seed >>> 0})` : `__args[${JSON.stringify(p)}]`)).join(", ");
  const src = `${PRELUDE}\nstd.math = __math;\nconst __fn = function (${params.join(", ")}) {\n${body}\n};\nreturn JSON.stringify(__fn(${bindings}) ?? null);`;
  return JSON.parse(new Function("__args", "__math", src)(args, math));
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function prepare(demo, seed, face = "main") {
  let fields = { ...demo.fields };
  if (typeof fields.generator === "string") {
    fields = { ...fields, ...runScript(fields.generator, ["rng"], {}, seed) };
    delete fields.generator;
  }
  if (demo.prepare) {
    const out = runScript(demo.prepare, ["fields", "face", "rng"], { fields, face }, hashString(`${seed}:${demo.id}:${face}`));
    return { view: out?.view ?? {}, key: out?.key ?? {}, fields };
  }
  const view = {}, key = {};
  for (const [k, v] of Object.entries(fields)) (demo.private.includes(k) ? key : view)[k] = v;
  return { view, key, fields };
}
const verdictOf = (s) => (s == null ? "ungraded" : s >= 0.999 ? "correct" : s <= 0.001 ? "incorrect" : "partial");
const suggest = (s) => (s == null ? null : s >= 0.95 ? 3 : s >= 0.5 ? 2 : 1);
function grade(demo, prep, answer) {
  const t0 = performance.now();
  const out = runScript(demo.grade, ["answer", "view", "key", "fields"], { answer, view: prep.view, key: prep.key, fields: prep.fields }) ?? {};
  const score = out.score == null ? null : Math.max(0, Math.min(1, Number(out.score)));
  return { score, verdict: verdictOf(score), feedback: out.feedback, details: out.details, suggested: suggest(score), grader: { kind: "script", ms: Math.max(1, Math.round(performance.now() - t0)) } };
}

const THEME_VARS = ["--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground", "--muted", "--muted-foreground", "--secondary", "--secondary-foreground", "--border", "--input", "--primary", "--primary-foreground", "--accent", "--accent-foreground", "--ring", "--destructive", "--success", "--warning", "--danger", "--highlight", "--again", "--hard", "--good", "--easy", "--new", "--learn", "--review", "--radius", "--font-sans", "--font-mono"];
function theme() {
  const cs = getComputedStyle(document.documentElement);
  const vars = {};
  for (const v of THEME_VARS) { const val = cs.getPropertyValue(v).trim(); if (val) vars[v] = val; }
  const scheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const lang = getCurrentLang();
  const dir = lang === "ar" ? "rtl" : "ltr";
  return { scheme, vars, lang, dir };
}
function cardTheme(view) {
  const t = theme();
  if (/[\u0600-\u06FF]/.test(JSON.stringify(view ?? ""))) t.dir = "rtl";
  return t;
}

function humanInterval(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 30) return `${d < 10 ? Math.round(d * 10) / 10 : Math.round(d)}d`.replace(".0d", "d");
  const mo = d / 30.4;
  if (mo < 12) return `${Math.round(mo * 10) / 10}mo`.replace(".0mo", "mo");
  return `${Math.round((d / 365) * 10) / 10}y`.replace(".0y", "y");
}
const RATING = {
  ar: { 1: "مجدداً", 2: "صعب", 3: "جيد", 4: "سهل" },
  en: { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" }
};
const VERDICT = {
  ar: { correct: "صحيح", partial: "صحيح جزئياً", incorrect: "غير دقيق" },
  en: { correct: "Correct", partial: "Partly right", incorrect: "Not quite" }
};
const getRating = (r) => (RATING[getCurrentLang()] || RATING.ar)[r];
const getVerdict = (v) => (VERDICT[getCurrentLang()] || VERDICT.ar)[v];
/** A drill's numbers, the way the app shows them after a run: "5 invaders · 0.74 s per invader". */
const metricLine = (metrics, details) => metrics
  .map((m) => { const v = details?.[m.key]; return v == null ? null : `<b class="tabular">${Number(v).toFixed(m.digits ?? 0)}${m.unit === "%" ? "%" : m.unit ? ` ${m.unit}` : ""}</b> ${esc(m.label.toLowerCase().replace(m.unit === "s" ? /^seconds\s+/ : /^$/, ""))}`; })
  .filter(Boolean).join(" · ");

let fsrsMod = null;
const loadFsrs = () => (fsrsMod ??= import("../vendor/ts-fsrs.js"));

// ------------------------------------------- the self-grading Quranic Mutashabihat mini card
const mini = $("#mini");
if (mini) {
  const vis = visibility(mini);
  const qEl = $("[data-q]", mini), typed = $("[data-typed]", mini), vEl = $("[data-v]", mini);
  const VARIANTS = {
    ar: [
      {
        q: "﴿رَبِّ اجْعَلْ هَٰذَا بَلَدًا آمِنًا﴾ في أي سورة وردت ﴿بَلَدًا﴾ نكرة؟",
        a: "سورة البقرة (١٢٦)",
        feedback: "البقرة: ﴿بَلَدًا﴾ نكرة قبل عمارة مكة، وفي إبراهيم: ﴿الْبَلَدَ﴾ معرفة"
      },
      {
        q: "﴿وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ﴾ في أي سورة وردت بالواو؟",
        a: "سورة آل عمران (١٣٣)",
        feedback: "آل عمران: بالواو ﴿وَسَارِعُوا﴾، وفي الحديد: ﴿سَابِقُوا﴾ بدون واو"
      },
      {
        q: "ما اللفظ التالي في البقرة: ﴿فَكُلُوا مِنْهَا حَيْثُ شِئْتُمْ رَغَدًا...﴾؟",
        a: "وَادْخُلُوا الْبَابَ سُجَّدًا وَقُولُوا حِطَّةٌ",
        feedback: "البقرة ٥٨: قُدّم السجود على القول، عكس الأعراف ١٦١"
      },
      {
        q: "﴿يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ...﴾ ما ختام الآية؟",
        a: "لَعَلَّكُمْ تَتَّقُونَ",
        feedback: "البقرة ١٨٣: ﴿لَعَلَّكُمْ تَتَّقُونَ﴾، عكس آية الاعتكاف ١٨٧: ﴿لَعَلَّهُمْ يَتَّقُونَ﴾"
      },
      {
        q: "﴿قُولُوا آمَنَّا بِاللَّهِ وَمَا أُنزِلَ...﴾ في سورة البقرة ما صلة الموصول؟",
        a: "إِلَيْنَا",
        feedback: "البقرة: ﴿إِلَيْنَا﴾ لخطاب الأمة، وآل عمران: ﴿عَلَيْنَا﴾ لخطاب النبي ﷺ"
      }
    ],
    en: [
      {
        q: "﴿رَبِّ اجْعَلْ هَٰذَا بَلَدًا آمِنًا﴾ In which Surah is ﴿بَلَدًا﴾ indefinite?",
        a: "Surah Al-Baqarah (126)",
        feedback: "Al-Baqarah: indefinite ﴿بَلَدًا﴾ (before settlement); Ibrahim: definite ﴿الْبَلَدَ﴾"
      },
      {
        q: "﴿وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ﴾ Which Surah opens with Waw?",
        a: "Surah Al Imran (133)",
        feedback: "Al Imran: ﴿وَسَارِعُوا﴾ with Waw; Al-Hadid 21: ﴿سَابِقُوا﴾ without Waw"
      },
      {
        q: "Next in Al-Baqarah: ﴿فَكُلُوا مِنْهَا حَيْثُ شِئْتُمْ رَغَدًا...﴾?",
        a: "وَادْخُلُوا الْبَابَ سُجَّدًا وَقُولُوا حِطَّةٌ",
        feedback: "Al-Baqarah 58: prostration before speech; Al-A'raf 161: speech first"
      },
      {
        q: "﴿يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ...﴾ Verse ending?",
        a: "لَعَلَّكُمْ تَتَّقُونَ",
        feedback: "Al-Baqarah 183: ﴿لَعَلَّكُمْ تَتَّقُونَ﴾; verse 187: ﴿لَعَلَّهُمْ يَتَّقُونَ﴾"
      },
      {
        q: "﴿قُولُوا آمَنَّا بِاللَّهِ وَمَا أُنزِلَ...﴾ In Al-Baqarah: إِلَيْنَا or عَلَيْنَا?",
        a: "إِلَيْنَا",
        feedback: "Al-Baqarah: ﴿إِلَيْنَا﴾ for plural; Al Imran: ﴿عَلَيْنَا﴾ for the Prophet ﷺ"
      }
    ]
  };
  let k = 0;
  (async function loop() {
    for (;;) {
      if (!vis.on) { await sleep(400); continue; }
      const lang = getCurrentLang();
      const list = VARIANTS[lang] || VARIANTS.ar;
      const item = list[k % list.length];
      k++;
      qEl.innerHTML = item.q;
      typed.textContent = "";
      vEl.innerHTML = "";
      await sleep(700);
      for (const ch of item.a) { typed.textContent += ch; await sleep(reduced ? 0 : 70); }
      await sleep(450);
      const isAr = lang === "ar";
      vEl.innerHTML = `<span class="v" style="color:var(--good)">${isAr ? "صحيح" : "Correct"}</span><span style="color:var(--muted-foreground);font-size:.82rem">${item.feedback}</span>`;
      await sleep(2800);
    }
  })();
}

// ----------------------------------------------------------- the AI grading sample
const ai = $("#ai-demo");
if (ai) {
  fetch("assets/ai-sample.json").then((r) => r.json()).then((sampleData) => {
    let animGen = 0;
    const getSample = () => {
      const lang = getCurrentLang();
      return { s: sampleData[lang] || sampleData.ar || sampleData, isAr: lang === "ar" };
    };

    const populate = () => {
      const { s, isAr } = getSample();
      const promptEl = $("[data-prompt]", ai);
      const answerEl = $("[data-answer]", ai);
      const modelEl = $("[data-model]", ai);
      const noteEl = $("[data-hw-note]", ai);

      if (promptEl) promptEl.innerHTML = md(s.prompt);
      if (answerEl) answerEl.innerHTML = md(s.answer);
      if (noteEl) noteEl.textContent = s.note || (isAr ? "أين المقارنة في سياق الرزق؟" : "where is the comparison of provisions?");

      const modelName = esc(s.model.split("/").pop());
      if (modelEl) {
        if (isAr) {
          modelEl.innerHTML = `تقييم حقيقي مسجل في وِكَاء: حُكم النموذج الذكي <code class="nowrap">${modelName}</code> في ${s.ms} ملي ثانية، مع ملاحظات توجيهية وفق معايير تصحيح البطاقة.`;
        } else {
          modelEl.innerHTML = `A real grade, recorded in Wikae: verdict by <code class="nowrap">${modelName}</code> in ${s.ms} ms, feedback from the card's rubric.`;
        }
      }
    };

    const runAnimation = async () => {
      const curGen = ++animGen;
      const { s, isAr } = getSample();
      populate();

      const verdictEl = $("[data-verdict]", ai);
      const scoreEl = $("[data-score]", ai);
      const meter = $("[data-meter]", ai);
      const fb = $("[data-feedback]", ai);

      if (verdictEl) {
        verdictEl.textContent = getVerdict(s.verdict) || (isAr ? "صحيح جزئياً" : "Partly right");
        verdictEl.classList.add("on");
      }
      if (scoreEl) scoreEl.textContent = `${Math.round(s.score * 100)}%`;
      if (meter) meter.style.width = `${Math.round(s.score * 100)}%`;

      if (fb) {
        fb.innerHTML = "";
        await sleep(350);
        if (curGen !== animGen) return;
        const parts = s.feedback.replace(/"([^"]+)"/g, "$1").split(/(\$[^$\n]+?\$|\*\*[^*]+\*\*|﴿[^﴾]+?﴾)/).filter(Boolean);
        fb.classList.add("caret");
        for (const p of parts) {
          if (curGen !== animGen) return;
          if (p.startsWith("$") || p.startsWith("**") || p.startsWith("﴿")) {
            fb.insertAdjacentHTML("beforeend", p.startsWith("﴿") ? `<span class="quran-w">${esc(p)}</span>` : md(p));
            await sleep(reduced ? 0 : 40);
            continue;
          }
          const node = document.createTextNode("");
          fb.appendChild(node);
          for (const ch of p) {
            if (curGen !== animGen) return;
            node.data += ch;
            if (!reduced) await sleep(ch === " " ? 10 : 8);
          }
        }
        await sleep(1000);
        if (curGen === animGen) fb.classList.remove("caret");
      }
    };

    populate();
    whenVisible(ai, runAnimation, "0px 0px 30% 0px");
    window.addEventListener("wikae-lang-change", () => {
      populate();
      runAnimation();
    });
  });
}

// ----------------------------------------------------------------- exam deadlines
const exam = $("#exam");
if (exam) {
  whenVisible(exam, async () => {
    const { fsrs, generatorParameters, createEmptyCard, Rating } = await loadFsrs();
    const f = fsrs(generatorParameters({ enable_fuzz: false, learning_steps: ["1m", "10m"], relearning_steps: ["10m"], request_retention: 0.9 }));
    const DAY = 864e5, H = 36e5;
    // Etude's rule (src/core/scheduler.ts capToDeadline), with the default 12-hour margin.
    const cap = (due, now, deadline) => {
      const latest = new Date(deadline - 12 * H);
      if (due <= latest) return due;
      const half = new Date(now.getTime() + (deadline - now.getTime()) / 2);
      return latest > now ? (half < latest ? half : latest) : half;
    };
    const t0 = Date.UTC(2026, 10, 2, 17); // day 0, 5 pm
    // One study session a day at 5 pm; the exam is at 9 am on day D. Learning steps finish in the session.
    function study(D, withDeadline, startDay) {
      const examAt = t0 + D * DAY - 8 * H;
      let now = new Date(t0 + startDay * DAY), card = createEmptyCard(now);
      const reviews = [];
      for (let g = 0; g < 80; g++) {
        card = f.next(card, now, Rating.Good).card;
        reviews.push({ t: now.getTime(), card: { ...card } });
        if (withDeadline) card.due = cap(card.due, now, examAt);
        let next = card.due.getTime();
        if (next - now.getTime() >= H) next = t0 + Math.ceil((next - t0) / DAY - 1e-9) * DAY;
        if (next >= examAt) break;
        now = new Date(next);
      }
      return { reviews, examAt, recall: f.get_retrievability(card, new Date(examAt), false) };
    }
    const slider = $("#days", exam), chart = $("[data-chart]", exam);
    const R = (card, t) => Number(f.get_retrievability(card, new Date(t), false));
    const pct = (r) => `${(Math.floor(Math.min(r, 0.999) * 1000) / 10).toFixed(1)}%`;
    // One chart, both schedules. It's drawn at the chart's real pixel width so the labels stay readable.
    function draw(D, off, on) {
      const W = Math.max(300, Math.round(chart.clientWidth || 800)), small = W < 560;
      const H = small ? 230 : 300, L = small ? 38 : 48, Rt = small ? 10 : 16, T = 22, B = 40;
      const span = D * DAY;
      // The y range follows the curves, so the dips are visible instead of a flat line near the top.
      let lo = 1;
      for (const run of [off, on]) for (let i = 0; i <= 120; i++) { const t = run.reviews[0].t + ((run.examAt - run.reviews[0].t) * i) / 120; lo = Math.min(lo, R(run.reviews.findLast((r) => r.t <= t).card, t)); }
      const ystep = lo > 0.85 ? 0.02 : lo > 0.7 ? 0.05 : 0.1, ymin = Math.max(0, Math.floor((lo - 0.01) / ystep) * ystep);
      const x = (t) => L + ((t - t0) / span) * (W - L - Rt);
      const y = (r) => T + (1 - (Math.max(ymin, r) - ymin) / (1 - ymin)) * (H - T - B);
      const curve = (run) => {
        let d = "";
        for (let i = 0; i <= 360; i++) {
          const t = run.reviews[0].t + ((run.examAt - run.reviews[0].t) * i) / 360;
          const last = run.reviews.findLast((r) => r.t <= t);
          d += `${d ? "L" : "M"}${x(t).toFixed(1)},${y(R(last.card, t)).toFixed(1)}`;
        }
        return d;
      };
      const dots = (run, cls) => {
        const days = new Map();
        for (const r of run.reviews) days.set(Math.round((r.t - t0) / DAY), r);
        return [...days.values()].map((r) => `<circle class="${cls}" cx="${x(r.t).toFixed(1)}" cy="${y(R(r.card, r.t + 1000)).toFixed(1)}" r="${cls === "d-on" ? 4 : 3.6}"/>`).join("");
      };
      let g = "";
      const isAr = getCurrentLang() === "ar";
      for (let r = ymin; r <= 1.0001; r += ystep) g += `<line class="grid" x1="${L}" x2="${W - Rt}" y1="${y(r)}" y2="${y(r)}"/><text x="${L - 8}" y="${y(r) + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`;
      const step = D <= 14 ? 2 : D <= 30 ? 5 : 10;
      const ex = x(on.examAt);
      for (let d = 0; d < D; d += step) if (ex - x(t0 + d * DAY) > 34) g += `<text x="${x(t0 + d * DAY)}" y="${H - 8}" text-anchor="middle">${d === 0 ? (isAr ? "اليوم 0" : "day 0") : d}</text>`;
      g += `<line class="examline" x1="${ex}" x2="${ex}" y1="${T}" y2="${H - B}"/><text class="serif" x="${ex}" y="${H - 8}" text-anchor="${small ? "end" : "middle"}" style="fill:var(--foreground)">${isAr ? "الختمة" : "exam"}</text>`;
      // The recall the deadline buys back, shaded between the two curves' final values.
      g += `<path class="c-on" d="${curve(on)}"/><path class="c-off" d="${curve(off)}"/>` + dots(on, "d-on") + dots(off, "d-off");
      const aria = isAr ? "منحنى التذكر المتوقع عبر الزمن مع تحديد موعد الختمة وبدونه" : "Predicted recall over time, with and without a deadline";
      chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" dir="ltr" direction="ltr" role="img" aria-label="${aria}">${g}</svg>`;
    }
    let last = null;
    function render() {
      const D = Number(slider.value);
      slider.style.setProperty("--p", `${((D - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100}%`);
      $("[data-days]", exam).textContent = String(D);
      const off = study(D, false, 0), on = study(D, true, 0);
      last = [D, off, on];
      draw(D, off, on);
      const count = (run) => new Set(run.reviews.map((r) => Math.round((r.t - t0) / DAY))).size;
      const nextDay = Math.ceil((off.reviews.at(-1).card.due.getTime() - t0) / DAY);
      const lastOn = Math.max(...on.reviews.map((r) => Math.round((r.t - t0) / DAY)));
      const isAr = getCurrentLang() === "ar";
      if (isAr) {
        $("[data-last-off]", exam).innerHTML = `${count(off)} مراجعات، والمراجعة التالية في اليوم ${nextDay}${nextDay > D ? `، <span class="after">بعد موعد الختمة</span>` : ""}.`;
        $("[data-last-on]", exam).innerHTML = `${count(on)} مراجعات، وآخرها في اليوم ${lastOn}، ليكون المحفوظ حاضراً في اليوم المحدد.`;
      } else {
        $("[data-last-off]", exam).innerHTML = `${count(off)} reviews, then the next is due on day ${nextDay}${nextDay > D ? `, <span class="after">after the exam</span>` : ""}.`;
        $("[data-last-on]", exam).innerHTML = `${count(on)} reviews, the last on day ${lastOn}, so it's fresh on the day.`;
      }
      // A deck: 40 cards learned over the first 60% of the time, all answered Good.
      let rOff = 0, rOn = 0;
      for (let i = 0; i < 40; i++) {
        const s = Math.floor((i * D * 0.6) / 40);
        rOff += study(D, false, s).recall;
        rOn += study(D, true, s).recall;
      }
      $("[data-recall-off]", exam).textContent = pct(rOff / 40);
      $("[data-recall-on]", exam).textContent = pct(rOn / 40);
    }
    new ResizeObserver(() => last && draw(...last)).observe(chart);
    slider.addEventListener("input", render);
    window.addEventListener("wikae-lang-change", render);
    render();
  });
}

// --------------------------------------------------------------------- terminal
const term = $("#term");
if (term) {
  const out = $("[data-term]", term);
  const vis = visibility(term);
  const colorJson = (s) =>
    esc(s).replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([{}[\],])/g, (m, str, colon, lit, num, p) => {
      if (str) return colon ? `<span class="j-k">${str}</span>${colon}` : `<span class="j-s">${str}</span>`;
      if (lit) return `<span class="j-n">${lit}</span>`;
      if (num) return `<span class="j-n">${num}</span>`;
      if (p) return `<span class="j-p">${p}</span>`;
      return m;
    });
  fetch("assets/terminal.json").then((r) => r.json()).then(async ({ steps }) => {
    await new Promise((r) => whenVisible(term, r, "0px"));
    for (;;) {
      const isAr = getCurrentLang() === "ar";
      out.innerHTML = `<span class="dim">${isAr ? "# وكيل ذكي يستورد حزمة المتشابهات ويختبر حفظك عبر سطر الأوامر" : "# an agent imports your Mutashabihat pack and quizzes you via CLI"}</span>\n`;
      for (const s of steps) {
        while (!vis.on) await sleep(300);
        const line = document.createElement("span");
        line.className = "t-line";
        line.innerHTML = `<span class="ps">$</span><span class="t-cmd"></span>`;
        out.appendChild(line);
        const cmd = $(".t-cmd", line);
        const body = out.parentElement;
        for (const ch of s.cmd) { cmd.textContent += ch; body.scrollTop = body.scrollHeight; await sleep(reduced ? 0 : 16); }
        await sleep(420);
        out.insertAdjacentHTML("beforeend", `\n${colorJson(s.out)}\n\n`);
        body.scrollTo({ top: body.scrollHeight, behavior: reduced ? "auto" : "smooth" });
        await sleep(1500);
      }
      await sleep(7000);
    }
  });
}

// -------------------------------------------------------------------- app shots
const CAPTIONS = {
  ar: {
    decks: "<b>شجرة الحزم</b>: توضح البطاقات الجديدة، وقيد التعلم، والمستحقة اليوم، مع وراثة الإعدادات ومواعيد الختمة.",
    study: "<b>جلسة المراجعة</b>: تركيز كامل على بطاقة واحدة. تحقق بـ <kbd>Ctrl</kbd> <kbd>Enter</kbd>، وقيّم من <kbd>1</kbd> إلى <kbd>4</kbd>، وتراجع بـ <kbd>Ctrl</kbd> <kbd>Z</kbd>.",
    browse: "<b>البحث والتصفح</b>: فلترة متقدمة للبطاقات، مع محرر مباشر يدعم التنسيق والرموز الرياضية.",
    types: "<b>محرر أنواع البطاقات</b>: أنشئ وعدّل القوالب البرمجية ومصادر التحقق مع معاينة فورية.",
    stats: "<b>لوحة الإحصائيات</b>: قياس دقيق لنسبة الاستحضار، ومنحنى النسيان، والجدولة حتى موعد الختمة."
  },
  en: {
    decks: "<b>Decks</b> in a tree, with what's new, learning and due today. Settings and exam deadlines inherit down the tree.",
    study: "<b>Study</b> one card at a time. Check with <kbd>Ctrl</kbd> <kbd>Enter</kbd>, rate with <kbd>1</kbd> to <kbd>4</kbd>, undo with <kbd>Ctrl</kbd> <kbd>Z</kbd>.",
    browse: "<b>Browse</b> with the search language, preview any card and edit its fields with live Markdown and math.",
    types: "<b>Card types</b> are edited in the app too, with a live preview of the card you're writing.",
    stats: "<b>Stats</b>: true retention, predicted recall, your streak, a review heatmap and the forecast up to a deadline."
  }
};
const shotTabs = $("[data-shot-tabs]");
if (shotTabs) {
  const cap = $("[data-shot-caption]");
  let auto = true, i = 0;
  const names = $$("[data-shot]", shotTabs).map((b) => b.dataset.shot);
  const imgs = $$("[data-shot-img]");
  const img = (name) => imgs.find((el) => el.dataset.shotImg === name);
  // Load a screenshot ahead of time, so the crossfade never fades into an empty frame.
  const warm = (name) => { const el = img(name); if (!el) return Promise.resolve(); el.loading = "eager"; return el.decode().catch(() => {}); };
  let showing = 0;
  const show = async (name) => {
    const t = ++showing;
    i = names.indexOf(name);
    $$("[data-shot]", shotTabs).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.shot === name)));
    const lang = getCurrentLang();
    cap.innerHTML = (CAPTIONS[lang] || CAPTIONS.ar)[name];
    await warm(name);
    if (t !== showing) return;
    imgs.forEach((el) => el.classList.toggle("on", el.dataset.shotImg === name));
    warm(names[(i + 1) % names.length]);
  };
  shotTabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-shot]");
    if (b) { auto = false; show(b.dataset.shot); }
  });
  window.addEventListener("wikae-lang-change", () => show(names[i]));
  show("decks");
  const vis = visibility(shotTabs.parentElement);
  setInterval(() => auto && vis.on && !reduced && show(names[(i + 1) % names.length]), 5200);
}

// ------------------------------------------------------------- card type files
const codeTabs = $("[data-code-tabs]");
if (codeTabs) {
  const code = $("[data-code]"), note = $("[data-code-note]"), tree = $("[data-tree]");
  let activeIdx = 4;
  const renderTree = () => {
    const isAr = getCurrentLang() === "ar";
    tree.innerHTML =
      `<div><span class="dir">quran-mutashabihat/</span><span>${isAr ? "نوع بطاقة متشابهات القرآن" : "the Quranic Mutashabihat card type"}</span></div>` +
      TYPE_FILES.map((f, i) => `<div class="ind${i === activeIdx ? " on" : ""}" data-f="${i}">${esc(f.name)}<span>${isAr ? `${f.lines} سطراً` : `${f.lines} lines`}</span></div>`).join("");
  };
  codeTabs.innerHTML = TYPE_FILES.map((f, i) => `<button role="tab" type="button" aria-selected="${i === 0}" data-f="${i}">${esc(f.name)}</button>`).join("");
  const show = (i) => {
    activeIdx = i;
    const isAr = getCurrentLang() === "ar";
    code.innerHTML = TYPE_FILES[i].html;
    note.textContent = (isAr && TYPE_FILES[i].noteAr) ? TYPE_FILES[i].noteAr : TYPE_FILES[i].note;
    $$("[data-f]", codeTabs).forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.f) === i)));
    $$("[data-f]", tree).forEach((b) => b.classList.toggle("on", Number(b.dataset.f) === i));
    code.parentElement.scrollTop = 0;
  };
  const pick = (e) => { const b = e.target.closest("[data-f]"); if (b) show(Number(b.dataset.f)); };
  codeTabs.addEventListener("click", pick);
  tree.addEventListener("click", pick);
  window.addEventListener("wikae-lang-change", () => { renderTree(); show(activeIdx); });
  renderTree();
  show(4);
}

// ---------------------------------------------------------------- the repertoire
// Every included type, live and for the visitor's own hands: no autoplay here. Script-graded cards
// are graded in the page by the type's own grade script; AI-graded ones show their reference.
const rep = $("[data-rep]");
if (rep && GALLERY?.length) {
  const list = $("[data-rep-list]", rep), card = $("[data-rep-card]", rep), body = $(".rep-body", card), loader = $(".rep-loader", card);
  const checkBtn = $("[data-rep-check]", rep), againBtn = $("[data-rep-variant]", rep), verdictEl = $(".rep-verdict", rep);
  const groupEl = $("[data-rep-group]", rep), nameEl = $("[data-rep-name]", rep), descEl = $("[data-rep-desc]", rep), graderEl = $("[data-rep-grader]", rep);
  const coarse = matchMedia("(pointer: coarse)").matches;
  const AGAIN = {
    ar: { variant: "تمرين آخر", shuffle: "إعادة الخلط", reset: "البدء من جديد" },
    en: { variant: "New variant", shuffle: "Shuffle again", reset: "Start over" }
  };
  const GRADER = {
    ar: {
      script: "تصحيح برمجي فوري ينفذه المتصفح مباشرة.",
      hybrid: "تصحيح باختبارات برمجية معزولة؛ وتُحال الحالات الخاصة للذكاء الاصطناعي.",
      self: "تقييم ذاتي: راجع الإجابة ثم اختر مستوى إتقانك لها.",
      ai: "تصحيح بالذكاء الاصطناعي في التطبيق. يُعرض هنا الجواب المرجعي النموذجي."
    },
    en: {
      script: "Graded by the card's own script, right here in your browser.",
      hybrid: "Graded by running hidden tests in a sandbox; code with no tests goes to AI.",
      self: "You grade yourself: see the answer, then rate how well you knew it.",
      ai: "Graded by AI in the app. Here, Check shows the reference it compares against."
    }
  };
  const CHECK = {
    ar: { self: "إظهار الإجابة", ai: "إظهار المرجع النموذجي", default: "تحقق" },
    en: { self: "Show answer", ai: "Show the reference", default: "Check" }
  };

  let items = [];
  let cur = null; // { entry, i, k, seed, prep, frame, phase }
  function buildRepList() {
    const isAr = getCurrentLang() === "ar";
    let n = 0, html = "";
    for (const group of [...new Set(GALLERY.map((e) => e.group))]) {
      const firstInGroup = GALLERY.find((e) => e.group === group);
      const gTitle = isAr ? (firstInGroup?.groupAr ?? group) : group;
      html += `<div class="rep-group"><p class="rep-group-h">${esc(gTitle)}</p><ol>`;
      GALLERY.forEach((e, i) => {
        if (e.group !== group) return;
        const lbl = isAr ? (e.labelAr ?? e.label) : e.label;
        const current = cur?.i === i ? "true" : "false";
        html += `<li><button type="button" class="rep-item" data-i="${i}" data-type="${esc(e.type)}" aria-controls="rep-panel" aria-current="${current}" tabindex="${cur?.i === i ? 0 : -1}"><span class="rep-n tabular">${++n}</span><span class="rep-l">${esc(lbl)}</span>${e.grader === "ai" ? `<span class="rep-dag" aria-label="${isAr ? "مصحح بالذكاء الاصطناعي" : "graded by AI"}">✦</span>` : ""}</button></li>`;
      });
      html += `</ol></div>`;
    }
    const footText = isAr ? "مصحح بالذكاء الاصطناعي في التطبيق" : "graded by AI in the app";
    list.innerHTML = html + `<p class="rep-foot-note"><span aria-hidden="true">✦</span> ${footText}</p>`;
    items = $$(".rep-item", list);
  }
  buildRepList();

  const variant = new Map(); // which item of an entry was shown last
  const swap = frameSwapper(body, loader);
  const post = (msg) => cur?.frame.contentWindow?.postMessage({ etude: 1, ...msg }, "*");

  function syncRepLabels() {
    if (!cur) return;
    const entry = cur.entry;
    const lang = getCurrentLang();
    const isAr = lang === "ar";
    groupEl.textContent = isAr ? (entry.groupAr ?? entry.group) : entry.group;
    nameEl.textContent = isAr ? (entry.labelAr ?? entry.label) : entry.label;
    descEl.textContent = isAr ? (entry.descAr ?? entry.desc) : entry.desc;
    graderEl.textContent = (GRADER[lang] || GRADER.ar)[entry.grader] ?? "";
    checkBtn.firstChild.textContent = `${(CHECK[lang] || CHECK.ar)[entry.grader] ?? (CHECK[lang] || CHECK.ar).default} `;
    againBtn.innerHTML = `${(AGAIN[lang] || AGAIN.ar)[entry.again] || (isAr ? "تمرين آخر" : "New variant")} <span aria-hidden="true">↻</span>`;
  }
  window.addEventListener("wikae-lang-change", () => {
    buildRepList();
    syncRepLabels();
    if (cur) post({ type: "theme", theme: cardTheme(cur.prep.view) });
  });

  function open(i, { fresh = false, focus = false } = {}) {
    const entry = GALLERY[i];
    let k = variant.get(i) ?? 0;
    if (fresh && entry.items.length > 1) k = (k + 1) % entry.items.length;
    variant.set(i, k);
    const item = entry.items[k];
    const seed = (Math.random() * 2 ** 32) >>> 0;
    items.forEach((b, j) => { b.setAttribute("aria-current", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    // Keep the chosen type in view in the phone's horizontal strip, without scrolling the page.
    const b = items[i];
    if (b && list.scrollWidth > list.clientWidth + 2) list.scrollTo({ left: b.offsetLeft - list.clientWidth / 2 + b.offsetWidth / 2, behavior: reduced ? "auto" : "smooth" });
    verdictEl.innerHTML = "";
    checkBtn.hidden = false;
    checkBtn.disabled = true;
    againBtn.classList.remove("btn-primary");
    againBtn.classList.add("btn-ghost");
    let prep;
    try { prep = prepare({ id: item.id, fields: item.fields, prepare: entry.prepare, private: entry.private }, seed, item.face ?? "main"); }
    catch (e) { verdictEl.textContent = `Couldn't prepare the card: ${e.message}`; return; }
    const old = cur?.frame;
    const frame = document.createElement("iframe");
    frame.title = `${entry.name} card`;
    frame.setAttribute("sandbox", SANDBOX);
    frame.className = "loading";
    frame.style.height = old ? old.style.height : "420px";
    frame.src = `frames/gallery/${entry.type}.html`;
    cur = { entry, i, k, item, seed, prep, frame, phase: "loading", ready: true, focus };
    syncRepLabels();
    swap.add(frame);
  }

  addEventListener("message", (e) => {
    if (!cur || e.source !== cur.frame.contentWindow) return;
    const msg = e.data;
    if (!msg || msg.etude !== 1) return;
    switch (msg.type) {
      case "loaded":
        // The visitor chose this card with a pointer: let it take the keyboard, as it would in the app.
        if (cur.focus && !coarse) post({ type: "rep-focus" });
        post({ type: "init", view: cur.prep.view, mode: "answer", answer: null, result: null, theme: cardTheme(cur.prep.view) });
        break;
      case "mounted":
        cur.phase = "answer";
        swap.mounted(cur.frame);
        checkBtn.disabled = !cur.ready;
        break;
      case "size":
        if (typeof msg.height === "number") cur.frame.style.height = `${Math.max(140, Math.min(msg.height + 4, 2400))}px`;
        break;
      case "ready-state":
        cur.ready = !!msg.ready;
        if (cur.phase === "answer") checkBtn.disabled = !cur.ready;
        break;
      case "submit":
        onSubmit(msg.answer);
        break;
      case "key":
        if (msg.key === "Mod+Enter" && cur.phase === "answer") post({ type: "collect" });
        else if (msg.key === "Mod+Enter" && cur.phase === "result") again();
        break;
      case "error":
        verdictEl.textContent = `Card error: ${msg.message}`;
        break;
    }
  });

  function onSubmit(answer) {
    if (cur.phase !== "answer") return;
    cur.phase = "grading";
    checkBtn.disabled = true;
    const { entry, prep } = cur;
    let g = { score: null, verdict: "ungraded", grader: { kind: entry.grader } }, line;
    if (entry.grade) {
      const t0 = performance.now();
      try {
        const out = runScript(entry.grade, ["answer", "view", "key", "fields"], { answer, view: prep.view, key: prep.key, fields: prep.fields }) ?? {};
        const ms = Math.max(1, Math.round(performance.now() - t0));
        const isAr = getCurrentLang() === "ar";
        if (out.defer) line = isAr ? `<span class="v">لم يُصحح هنا</span><span class="m">· لعدم وجود اختبارات، يُحال هذا للذكاء الاصطناعي</span>` : `<span class="v">Not graded here</span><span class="m">· with no tests, the app hands this to AI</span>`;
        else if (entry.quiet && entry.metrics) {
          // A drill (Flippy Bit) hides its verdict in the app and shows what it measured instead.
          g = { score: out.score ?? null, verdict: verdictOf(out.score), details: out.details, grader: { kind: "script", ms } };
          line = isAr ? `<span class="v">انتهى التمرين</span><span class="m">${metricLine(entry.metrics, out.details)}</span>` : `<span class="v">Run over</span><span class="m">${metricLine(entry.metrics, out.details)}</span>`;
        }
        else {
          const score = out.score == null ? null : Math.max(0, Math.min(1, Number(out.score)));
          g = { score, verdict: verdictOf(score), feedback: out.feedback, details: out.details, suggested: suggest(score), grader: { kind: "script", ms } };
          const pct = g.verdict === "partial" ? `<span class="m tabular">${Math.round(score * 100)}%</span>` : "";
          const vLabel = getVerdict(g.verdict) ?? (isAr ? "تم التقييم" : "Graded");
          const byScriptMsg = isAr ? `· تم التحقق برمجياً في ${ms} م ث` : `· by the card's script in ${ms} ms`;
          line = `<span class="v ${g.verdict}">${vLabel}</span>${pct}<span class="m">${byScriptMsg}</span>`;
        }
      } catch (err) {
        const isAr = getCurrentLang() === "ar";
        line = `<span class="v incorrect">${isAr ? "خطأ في المصحح" : "Grader error"}</span><span class="m">${esc(err.message)}</span>`;
      }
    } else if (entry.grader === "ai") {
      const isAr = getCurrentLang() === "ar";
      line = isAr ? `<span class="v">يُصحح بالذكاء الاصطناعي في التطبيق</span><span class="m">· الإجابة المرجعية النموذجية موضحة أدناه</span>` : `<span class="v">Graded by AI in the app</span><span class="m">· the reference is below</span>`;
    } else {
      const isAr = getCurrentLang() === "ar";
      line = isAr ? `<span class="v">ما مدى استحضارك للإجابة؟</span><span class="m">· في التطبيق تقيّم نفسك: مجدداً، صعب، جيد، سهل</span>` : `<span class="v">How well did you know it?</span><span class="m">· in the app you'd rate it Again, Hard, Good or Easy</span>`;
    }
    cur.phase = "result";
    post({ type: "result", result: { grade: g, key: prep.key, answer } });
    verdictEl.innerHTML = line;
    verdictEl.classList.remove("pop"); void verdictEl.offsetWidth; verdictEl.classList.add("pop");
    checkBtn.hidden = true;
    againBtn.classList.replace("btn-ghost", "btn-primary");
  }
  const again = () => open(cur.i, { fresh: true, focus: true });

  checkBtn.addEventListener("click", () => cur?.phase === "answer" && post({ type: "collect" }));
  againBtn.addEventListener("click", () => cur && again());
  rep.addEventListener("keydown", (e) => {
    if (!cur || !(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
    e.preventDefault();
    if (cur.phase === "answer") post({ type: "collect" });
    else if (cur.phase === "result") again();
  });

  // Pick a type with a click, or move through the programme with the arrow keys (one tab stop).
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) open(Number(b.dataset.i), { focus: e.detail > 0 });
  });
  let keyTimer = null;
  list.addEventListener("keydown", (e) => {
    const at = items.indexOf(document.activeElement);
    if (at < 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const row = getComputedStyle(list).flexDirection === "row" || list.scrollWidth > list.clientWidth + 2;
    const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let to = next ? Math.max(0, Math.min(items.length - 1, at + next)) : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (to < 0) return;
    if (!row && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    e.preventDefault();
    items[to].focus({ preventScroll: true });
    items[to].scrollIntoView({ block: "nearest", inline: "nearest" });
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => open(to), 160);
  });

  // For site/tools/repertoire.mjs: the prepared card, as the server would hold it.
  window.__rep = () => cur && { type: cur.entry.type, view: cur.prep.view, key: cur.prep.key, fields: cur.prep.fields, phase: cur.phase };
  whenVisible(rep, () => open(0), "0px 0px 40% 0px");
}

// --------------------------------------------------------------- tempo: schedulers
// One card over six weeks under four schedulers. FSRS runs through ts-fsrs; drill, Leitner and
// the docs' every-Monday example are the real schedule.js scripts, called with the same
// (card, attempt, options, ctx) the engine gives them.
{
  const box = $("[data-tempo]");
  if (box) {
    const chart = $("[data-tempo-chart]", box), missBox = $("[data-tempo-miss]", box), missNote = $("[data-tempo-miss-note]", box);
    const DAY = 864e5, SPAN = 42;
    // Day 0 is a Monday, so the weeks on the chart are real weeks; everyone studies at 7 pm.
    const day0 = new Date(2026, 10, 2);
    const dayStart = (n) => new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + n);
    const at = (n) => new Date(dayStart(n).getTime() + 19 * 36e5);
    const dayOf = (iso) => Math.round((new Date(iso).setHours(0, 0, 0, 0) - day0.getTime()) / DAY);
    function script(body, options, miss) {
      const out = [];
      let card = { state: null, reps: 0, due: null, lastReview: null, created: at(0).toISOString() }, d = 0;
      const history = [];
      for (let k = 0; d < SPAN && k < 200; k++) {
        const now = at(d), bad = miss && out.length === 2;
        const attempt = { rating: bad ? 1 : 3, score: bad ? 0 : 1, verdict: bad ? "incorrect" : "correct", details: {}, ms: 8000, at: now.toISOString() };
        const ctx = { now: now.toISOString(), day: Array.from({ length: 400 }, (_, i) => dayStart(d + i).toISOString()), doneToday: out.filter((o) => o.d === d).length, history: history.slice(-50) };
        const r = runScript(body, ["card", "attempt", "options", "ctx"], { card, attempt, options, ctx });
        out.push({ d, bad, state: r.state });
        history.push({ at: now.toISOString(), rating: attempt.rating, score: attempt.score });
        card = { ...card, state: r.state, reps: card.reps + 1, due: r.due, lastReview: now.toISOString() };
        d = Math.max(d + (dayOf(r.due) > d ? 0 : 1), dayOf(r.due));
      }
      out.next = d;
      return out;
    }
    async function fsrsRow(miss) {
      const { fsrs, generatorParameters, createEmptyCard, Rating } = await loadFsrs();
      const f = fsrs(generatorParameters({ enable_fuzz: false, learning_steps: ["1m", "10m"], relearning_steps: ["10m"], request_retention: 0.9 }));
      let now = at(0), card = createEmptyCard(now);
      const out = [];
      while (out.length < 60) {
        const d = Math.round((new Date(now).setHours(0, 0, 0, 0) - day0.getTime()) / DAY);
        if (d >= SPAN) break;
        const days = new Set(out.map((o) => o.d));
        const bad = miss && days.size === 2 && !days.has(d);
        card = f.next(card, now, bad ? Rating.Again : Rating.Good).card;
        if (!out.some((o) => o.d === d)) out.push({ d, bad, state: null });
        const o = out[out.length - 1];
        o.state = { ivl: Math.max(0, Math.round((new Date(card.due).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY)) };
        // Learning steps finish in the same sitting.
        now = card.due - now < 36e5 ? card.due : at(Math.round((new Date(card.due).setHours(0, 0, 0, 0) - day0.getTime()) / DAY));
      }
      out.next = Math.round((new Date(card.due).setHours(0, 0, 0, 0) - day0.getTime()) / DAY);
      return out;
    }
    const ROWS = [
      { id: "fsrs", name: "FSRS-6", nameAr: "FSRS-6", note: "right before you'd forget it", noteAr: "قبيل لحظة النسيان تماماً", run: fsrsRow, tag: (o) => (o.state?.ivl ? `+${o.state.ivl}d` : null) },
      { id: "drill", name: "Drill", nameAr: "التكرار اليومي", note: "every day, nothing to rate", noteAr: "مراجعة يومية للورد الثابت", run: (m) => script(SCHEDULERS.drill, { perDay: 1, everyDays: 1 }, m) },
      { id: "leitner", name: "Leitner", nameAr: "صناديق لايتنر", note: "up a box if right, box 1 if wrong", noteAr: "ترقية عند الإصابة والأول عند الخطأ", run: (m) => script(SCHEDULERS.leitner, { boxes: "1, 2, 4, 8, 16, 32" }, m), tag: (o) => o.state?.box },
      { id: "monday", name: "Your own", nameAr: "جدولك المخصص", note: "a few lines of JS: Mondays", noteAr: "بضعة أسطر برمجية: كل يوم إثنين", run: (m) => script(SCHEDULERS.monday, { weeks: 1 }, m) },
    ];
    async function draw() {
      const miss = missBox.checked;
      missNote.hidden = !miss;
      const isAr = getCurrentLang() === "ar";
      const rows = [];
      for (const r of ROWS) rows.push({ ...r, pts: await r.run(miss) });
      const W = Math.max(300, Math.round(chart.clientWidth || 900)), small = W < 640;
      const L = small ? 8 : 230, R = small ? 8 : 64, rowH = small ? 74 : 62, top = 8, H = top + rows.length * rowH + 30;
      const x = (d) => L + ((W - L - R) * (d + 0.5)) / SPAN;
      const aria = isAr ? "مواعيد عودة البطاقة للمراجعة تحت كل خوارزمية جدولة" : "When the card comes back under each scheduler";
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" dir="ltr" direction="ltr" role="img" aria-label="${aria}">`;
      // weeks
      const rowY = (i) => top + i * rowH + (small ? 46 : rowH / 2);
      for (let w = 0; w <= 6; w++) {
        const gx = L + ((W - L - R) * w * 7) / SPAN;
        // On a phone the row names sit above the dots, so the week lines only cross the dot rows.
        if (small) rows.forEach((_, i) => (s += `<line class="grid" x1="${gx}" x2="${gx}" y1="${rowY(i) - 9}" y2="${rowY(i) + 9}"/>`));
        else s += `<line class="grid" x1="${gx}" x2="${gx}" y1="${top}" y2="${H - 26}"/>`;
        if (w < 6) s += `<text x="${gx + 4}" y="${H - 8}">${small ? (isAr ? `أ${w + 1}` : `w${w + 1}`) : (isAr ? `أسبوع ${w + 1}` : `week ${w + 1}`)}</text>`;
      }
      rows.forEach((r, i) => {
        const y = rowY(i);
        const rName = isAr ? r.nameAr : r.name;
        const rNote = isAr ? r.noteAr : r.note;
        if (small) s += `<text class="serif" x="${L}" y="${y - 24}">${rName} <tspan class="dim">· ${esc(rNote)}</tspan></text>`;
        else s += `<text class="serif" x="0" y="${y - 2}">${rName}</text><text class="dim small" x="0" y="${y + 15}">${esc(rNote)}</text>`;
        s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
        const pts = r.pts.filter((p) => p.d < SPAN);
        for (const p of pts) {
          s += `<circle class="${p.bad ? "miss" : i === 1 ? "run" : "rev"}" cx="${x(p.d).toFixed(1)}" cy="${y}" r="${small ? 2.7 : 4.6}"/>`;
          const t = r.tag?.(p);
          if (t && !small) s += `<text class="tag" x="${x(p.d).toFixed(1)}" y="${y - 10}" text-anchor="middle">${t}</text>`;
        }
        // A long gap at the end is the point, not missing data: say when the card comes back.
        const last = pts[pts.length - 1]?.d ?? 0;
        if (r.pts.next >= SPAN && SPAN - last > 6) s += `<text class="next" x="${W - R - 4}" y="${y + (small ? 19 : -9)}" text-anchor="end">${isAr ? `التالي: يوم ${r.pts.next}` : `next: day ${r.pts.next} →`}</text>`;
        if (!small) s += `<text class="count" x="${W - R + 14}" y="${y + 5}">${pts.length}×</text>`;
      });
      chart.innerHTML = s + "</svg>";
      window.__tempo = rows.map((r) => ({ id: r.id, days: r.pts.map((p) => p.d) }));
    }
    missBox.addEventListener("change", draw);
    window.addEventListener("wikae-lang-change", draw);
    let w = 0;
    new ResizeObserver(() => { const n = chart.clientWidth; if (Math.abs(n - w) > 4) { w = n; draw(); } }).observe(chart);
    whenVisible(box, draw, "0px 0px 30% 0px");
  }
}

// ------------------------------------------------------------- suite: new decks
// The new Market decks, live. Same frames and scripts as the repertoire, one deck per tab.
{
  const box = $("[data-suite]");
  const entries = Object.fromEntries((GALLERY ?? []).filter((e) => ["quran-mutashabihat", "order", "match"].includes(e.type)).map((e) => [e.type, e]));
  if (box && Object.keys(entries).length) {
    const tabs = $$("[data-suite-type]", box), body = $(".suite-body", box), loader = $(".suite-loader", box);
    const checkBtn = $("[data-suite-check]", box), nextBtn = $("[data-suite-next]", box), verdictEl = $(".suite-verdict", box), noteEl = $("[data-suite-note]", box);
    const coarse = matchMedia("(pointer: coarse)").matches;
    const NOTES = {
      ar: {
        "quran-mutashabihat": "مصحف مجمع الملك فهد بالرسم العثماني المعتمد. تدريب استحضار اللفظ القرآني وضبط المتشابهات بين السور.",
        order: "رتّب آيات السورة الكريمة بالسحب والإفلات أو أزرار الأسهم. تقييم دقيق للتسلسل القرآني المحفوظ.",
        match: "صِل المفردة القرآنية الكريمة ببيانها وتفسيرها الصحيح من أمهات كتب التفسير وغريب القرآن.",
      },
      en: {
        "quran-mutashabihat": "King Fahd Complex Uthmani script with active recall to distinguish subtle differences across Surahs.",
        order: "Arrange Quranic verses in sequential order using drag-and-drop or arrow keys with partial credit grading.",
        match: "Connect Quranic vocabulary with precise interpretations and lexical Tafsir meanings.",
      }
    };
    // The heading follows the deck you pick.
    const head = box.closest("section")?.querySelector(".head h2");
    const HEADS = {
      ar: {
        "quran-mutashabihat": "تتدرب على المتشابهات؟ أكمل الموضع المحوري في الآية الكريمة.",
        order: "ترسّخ تسلسل السورة؟ رتّب الآيات الكريمة بترتيبها القرآني.",
        match: "تتدبّر غريب القرآن؟ صِل كل مفردة بمعناها وتفسيرها.",
      },
      en: {
        "quran-mutashabihat": "Practicing Mutashabihat? Complete the pivotal wording in the verse.",
        order: "Anchoring Surah sequence? Arrange the verses in their correct order.",
        match: "Exploring Quranic vocabulary? Match each word to its Tafsir meaning.",
      }
    };
    const setHead = (type) => {
      const lang = getCurrentLang();
      const heads = HEADS[lang] || HEADS.ar;
      if (!head || !heads[type]) return;
      head.dataset.type = type;
      head.classList.remove("swap"); void head.offsetWidth;
      head.innerHTML = heads[type];
      head.classList.add("swap");
    };
    const swap = frameSwapper(body, loader);
    const k = {};
    let cur = null;
    const post = (msg) => cur?.frame.contentWindow?.postMessage({ etude: 1, ...msg }, "*");
    function open(type, { next = false, focus = false } = {}) {
      const entry = entries[type];
      if (!entry) return;
      k[type] = next ? ((k[type] ?? 0) + 1) % entry.items.length : (k[type] ?? 0);
      const item = entry.items[k[type]];
      tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.suiteType === type)));
      setHead(type);
      const lang = getCurrentLang();
      const isAr = lang === "ar";

      // Dynamically update active tab button's title and metadata to reflect the active card
      const tabBtn = Array.from(tabs).find((b) => b.dataset.suiteType === type);
      if (tabBtn && item?.fields) {
        const titleAr = item.fields.cardTitleAr;
        const metaAr = item.fields.cardMetaAr;
        const titleEn = item.fields.cardTitleEn;
        const metaEn = item.fields.cardMetaEn;
        const elArTitle = tabBtn.querySelector('[data-lang="ar"] .suite-title');
        const elArMeta = tabBtn.querySelector('[data-lang="ar"] .suite-meta');
        const elEnTitle = tabBtn.querySelector('[data-lang="en"] .suite-title');
        const elEnMeta = tabBtn.querySelector('[data-lang="en"] .suite-meta');
        if (titleAr && elArTitle) elArTitle.textContent = titleAr;
        if (metaAr && elArMeta) elArMeta.textContent = metaAr;
        if (titleEn && elEnTitle) elEnTitle.textContent = titleEn;
        if (metaEn && elEnMeta) elEnMeta.textContent = metaEn;
      }

      const notes = NOTES[lang] || NOTES.ar;
      if (isAr && item?.fields?.mnemonicRuleAr) {
        noteEl.innerHTML = `<span style="color:var(--highlight);font-weight:600">قاعدة الضبط:</span> ${esc(item.fields.mnemonicRuleAr)}`;
      } else if (isAr && item?.fields?.explanation) {
        noteEl.innerHTML = `<span style="color:var(--highlight);font-weight:600">بيان وتفسير:</span> ${esc(item.fields.explanation)}`;
      } else {
        noteEl.textContent = notes[type] ?? "";
      }
      verdictEl.innerHTML = "";
      checkBtn.hidden = !!entry.auto;
      checkBtn.disabled = true;
      const lbl = entry.auto ? (isAr ? "إعادة التجربة" : "Play again") : (isAr ? "بطاقة أخرى" : "Another card");
      nextBtn.innerHTML = `<span>${lbl}</span> <span aria-hidden="true">↻</span>`;
      nextBtn.classList.replace("btn-primary", "btn-ghost");
      const seed = (Math.random() * 2 ** 32) >>> 0;
      let prep;
      try { prep = prepare({ id: item.id, fields: item.fields, prepare: entry.prepare, private: entry.private }, seed, item.face ?? "main"); }
      catch (e) { verdictEl.textContent = `Couldn't prepare the card: ${e.message}`; return; }
      const old = cur?.frame;
      const frame = document.createElement("iframe");
      frame.title = `${entry.name} card`;
      frame.setAttribute("sandbox", SANDBOX);
      frame.className = "loading";
      frame.style.height = old ? old.style.height : "480px";
      frame.src = `frames/gallery/${type}.html`;
      cur = { type, entry, item, prep, frame, phase: "loading", ready: true, focus };
      swap.add(frame);
    }
    addEventListener("message", (e) => {
      if (!cur || e.source !== cur.frame.contentWindow) return;
      const msg = e.data;
      if (!msg || msg.etude !== 1) return;
      if (msg.type === "loaded") {
        if (cur.focus && !coarse) post({ type: "rep-focus" });
        post({ type: "init", view: cur.prep.view, mode: "answer", answer: null, result: null, theme: cardTheme(cur.prep.view) });
      } else if (msg.type === "mounted") { cur.phase = "answer"; swap.mounted(cur.frame); checkBtn.disabled = !cur.ready; }
      else if (msg.type === "size" && typeof msg.height === "number") cur.frame.style.height = `${Math.max(160, Math.min(msg.height + 4, 2400))}px`;
      else if (msg.type === "ready-state") { cur.ready = !!msg.ready; if (cur.phase === "answer") checkBtn.disabled = !cur.ready; }
      else if (msg.type === "submit") onSubmit(msg.answer);
      else if (msg.type === "key" && msg.key === "Mod+Enter") cur.phase === "answer" ? post({ type: "collect" }) : cur.phase === "result" && open(cur.type, { next: !cur.entry.auto, focus: true });
      else if (msg.type === "error") verdictEl.textContent = `Card error: ${msg.message}`;
    });
    function onSubmit(answer) {
      if (cur.phase !== "answer") return;
      cur.phase = "result";
      const { entry, prep } = cur;
      let g, line;
      const t0 = performance.now();
      try {
        const out = runScript(entry.grade, ["answer", "view", "key", "fields"], { answer, view: prep.view, key: prep.key, fields: prep.fields }) ?? {};
        const ms = Math.max(1, Math.round(performance.now() - t0));
        const score = out.score == null ? null : Math.max(0, Math.min(1, Number(out.score)));
        g = { score, verdict: verdictOf(score), feedback: out.feedback, details: out.details, suggested: suggest(score), grader: { kind: "script", ms } };
        if (entry.quiet && entry.metrics) {
          // A drill shows what it measured, as the app does.
          line = `<span class="v">Run over</span><span class="m">${metricLine(entry.metrics, out.details)}</span>`;
        } else {
          const isAr = getCurrentLang() === "ar";
          const vWord = getVerdict(g.verdict) ?? (isAr ? "تم التقييم" : "Graded");
          const timing = isAr ? `· عبر خوارزمية البطاقة في ${ms} مل ث` : `· by the card's script in ${ms} ms`;
          const pct = g.verdict === "partial" ? `<span class="m tabular">${Math.round(score * 100)}%</span>` : "";
          line = `<span class="v ${g.verdict}">${vWord}</span>${pct}<span class="m">${timing}</span>`;
        }
      } catch (err) {
        const isAr = getCurrentLang() === "ar";
        g = { score: null, verdict: "ungraded", grader: { kind: "script" } };
        line = `<span class="v incorrect">${isAr ? "خطأ في التقييم" : "Grader error"}</span><span class="m">${esc(err.message)}</span>`;
      }
      post({ type: "result", result: { grade: g, key: prep.key, answer } });
      verdictEl.innerHTML = line;
      verdictEl.classList.remove("pop"); void verdictEl.offsetWidth; verdictEl.classList.add("pop");
      checkBtn.hidden = true;
      nextBtn.classList.replace("btn-ghost", "btn-primary");
      cur.grade = g;
    }
    checkBtn.addEventListener("click", () => cur?.phase === "answer" && post({ type: "collect" }));
    nextBtn.addEventListener("click", () => cur && open(cur.type, { next: !cur.entry.auto || cur.phase !== "result" ? true : false, focus: true }));
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-suite-type]"); if (b && b.dataset.suiteType !== cur?.type) open(b.dataset.suiteType, { focus: e.detail > 0 }); });
    window.__suiteCount = (t) => entries[t]?.items.length;
    window.__suite = () => cur && { type: cur.type, item: cur.item.id, face: cur.item.face ?? "main", view: cur.prep.view, key: cur.prep.key, phase: cur.phase, grade: cur.grade ?? null };
    window.addEventListener("wikae-lang-change", () => {
      if (cur) {
        setHead(cur.type);
        const lang = getCurrentLang();
        const isAr = lang === "ar";
        const tabBtn = Array.from(tabs).find((b) => b.dataset.suiteType === cur.type);
        if (tabBtn && cur.item?.fields) {
          const titleAr = cur.item.fields.cardTitleAr;
          const metaAr = cur.item.fields.cardMetaAr;
          const titleEn = cur.item.fields.cardTitleEn;
          const metaEn = cur.item.fields.cardMetaEn;
          const elArTitle = tabBtn.querySelector('[data-lang="ar"] .suite-title');
          const elArMeta = tabBtn.querySelector('[data-lang="ar"] .suite-meta');
          const elEnTitle = tabBtn.querySelector('[data-lang="en"] .suite-title');
          const elEnMeta = tabBtn.querySelector('[data-lang="en"] .suite-meta');
          if (titleAr && elArTitle) elArTitle.textContent = titleAr;
          if (metaAr && elArMeta) elArMeta.textContent = metaAr;
          if (titleEn && elEnTitle) elEnTitle.textContent = titleEn;
          if (metaEn && elEnMeta) elEnMeta.textContent = metaEn;
        }
        const notes = NOTES[lang] || NOTES.ar;
        if (isAr && cur.item?.fields?.mnemonicRuleAr) {
          noteEl.innerHTML = `<span style="color:var(--highlight);font-weight:600">قاعدة الضبط:</span> ${esc(cur.item.fields.mnemonicRuleAr)}`;
        } else if (isAr && cur.item?.fields?.explanation) {
          noteEl.innerHTML = `<span style="color:var(--highlight);font-weight:600">بيان وتفسير:</span> ${esc(cur.item.fields.explanation)}`;
        } else {
          noteEl.textContent = notes[cur.type] ?? "";
        }
        const lbl = cur.entry.auto ? (isAr ? "إعادة التجربة" : "Play again") : (isAr ? "بطاقة أخرى" : "Another card");
        nextBtn.innerHTML = `<span>${lbl}</span> <span aria-hidden="true">↻</span>`;
        post({ type: "theme", theme: cardTheme(cur.prep.view) });
      }
    });
    whenVisible(box, () => open("quran-mutashabihat"), "0px 0px 40% 0px");
  }
}

// ------------------------------------------------------- hero interactive mutashabihat preview
{
  $$("[data-hero-answer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ok = btn.dataset.heroAnswer === "correct";
      $$("[data-hero-answer]").forEach((b) => b.classList.remove("is-correct", "is-wrong"));
      btn.classList.add(ok ? "is-correct" : "is-wrong");
      const fbCorrect = $("#hero-proof-feedback-correct");
      const fbWrong = $("#hero-proof-feedback-wrong");
      if (fbCorrect) fbCorrect.hidden = !ok;
      if (fbWrong) fbWrong.hidden = ok;
    });
  });
}

// ------------------------------------------------------------- the film
{
  const v = $("#film-video"), wrap = v?.closest(".film-frame"), play = $(".film-play");
  if (v && play) {
    play.addEventListener("click", () => { v.preload = "auto"; v.controls = true; v.play().catch(() => {}); });
    v.addEventListener("play", () => { v.controls = true; wrap.classList.add("playing"); });
    v.addEventListener("ended", () => wrap.classList.remove("playing"));
    // A film playing off screen keeps talking: pause it when it scrolls away.
    new IntersectionObserver((es) => es.forEach((e) => !e.isIntersecting && !v.paused && v.pause()), { threshold: 0.15 }).observe(v);
  }
}

// ----------------------------------------------------------------- stats
{
  let statsLoaded = false;
  const loadLiveStats = () => {
    if (statsLoaded) return;
    statsLoaded = true;
    import("../live/stats.js").catch(() => {});
  };
  whenVisible($("#tempo"), loadLiveStats, "600px 0px");
  whenVisible($("#stats"), loadLiveStats, "600px 0px");

  const box = $("[data-plates]");
  if (box) {
    const btns = $$("[data-plate]", box), panes = $$("[data-plate-pane]", box);
    const list = $(".plate-list", box), view = $("[data-plate-view]", box);
    let auto = true, i = 0, hold = 0;
    // The panes share one grid cell, so the tallest sets the height; on wide screens it's at least the
    // tab list's, so switching tabs never moves the page.
    const fit = () => {
      const wide = matchMedia("(min-width: 1000px)").matches;
      view.style.setProperty("--plate-h", wide ? `${Math.ceil(list.offsetHeight)}px` : "0px");
    };
    new ResizeObserver(fit).observe(list);
    const show = (name) => {
      i = btns.findIndex((b) => b.dataset.plate === name);
      btns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.plate === name)));
      panes.forEach((p) => p.classList.toggle("on", p.dataset.platePane === name));
      const b = btns[i];
      if (list.scrollWidth > list.clientWidth + 2) list.scrollTo({ left: b.offsetLeft - 16, behavior: reduced ? "auto" : "smooth" });
    };
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-plate]"); if (b) { auto = false; show(b.dataset.plate); } });
    // someone using a panel shouldn't have it switch under them
    view.addEventListener("pointerdown", () => (auto = false));
    view.addEventListener("pointermove", () => (hold = Date.now()));
    const vis = visibility(box);
    setInterval(() => auto && vis.on && !reduced && Date.now() - hold > 6000 && show(btns[(i + 1) % btns.length].dataset.plate), 4800);
  }
}

// ---------------------------------------------------------------- market
// The section is filled from our curated snapshot of Islamic decks, card types, and themes.
{
  const box = $("[data-market]");
  if (box) {
    const grid = $("[data-market-grid]", box), count = $("[data-market-count]", box), tabs = $$("[data-kind]", box);
    let entries = [], generated = "", kind = "deck";
    const v = (t, k, d) => t?.vars?.[k] ?? d;
    const themeTile = (t) => {
      const isAr = getCurrentLang() === "ar";
      const s = [["--t-bg", v(t, "--background", "#111")], ["--t-side", v(t, "--sidebar", v(t, "--background"))], ["--t-card", v(t, "--card", "#222")], ["--t-fg", v(t, "--foreground", "#eee")],
        ["--t-muted", v(t, "--muted-foreground", "#999")], ["--t-hl", v(t, "--highlight", v(t, "--primary", "#10b981"))], ["--t-border", v(t, "--border", "#ffffff22")]]
        .map(([k, val]) => `${k}:${val}`).join(";");
      const rate = ["--again", "--hard", "--good", "--easy"].map((k) => `<i style="background:${v(t, k, "#888")}"></i>`).join("");
      const chips = ["--highlight", "--chart-2", "--chart-3", "--chart-4"].map((k) => `<i style="background:${v(t, k, v(t, "--highlight", "#10b981"))}"></i>`).join("");
      const t1 = isAr ? "<b>وِ</b>كَاء" : "<b>W</b>ikae";
      const t2 = isAr ? "رِباط <b>المحفوظ</b>" : "Spaced <b>Practice</b>";
      return `<div class="mk-theme" style="${esc(s)}" aria-hidden="true"><div class="rail"><i></i><i></i><i></i><i></i></div><div class="pane"><div class="t1">${t1}</div><div class="t2">${t2}</div><div class="chips">${chips}</div><div class="rates">${rate}</div></div></div>`;
    };
    const tile = (e, n) => {
      const isAr = getCurrentLang() === "ar";
      const name = (isAr ? e.nameAr : e.nameEn) || e.name;
      const desc = (isAr ? e.descriptionAr : e.descriptionEn) || e.description;
      const tags = (isAr ? e.tagsAr : e.tagsEn) || e.tags;
      return `<article class="mk" style="--i:${n}">${e.kind === "theme" ? themeTile(e.theme) : e.cover ? `<div class="mk-cover"><img src="${esc(e.cover)}" alt="" loading="lazy"></div>` : ""}<div class="mk-body"><h3 class="mk-name">${esc(name)}</h3><p class="mk-desc">${esc(desc)}</p>${tags?.length ? `<div class="mk-tags">${tags.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}</div></article>`;
    };
    const render = () => {
      const isAr = getCurrentLang() === "ar";
      const shown = entries.filter((e) => e.kind === kind);
      grid.innerHTML = shown.map(tile).join("");
      const c = (x) => entries.filter((e) => e.kind === x).length;
      const dateStr = generated ? generated.slice(0, 10) : "";
      if (isAr) {
        count.textContent = `${c("deck")} حزم قرآنية، و ${c("type")} أنواع بطاقات، و ${c("theme")} مظاهر حتى الآن${dateStr ? ` · آخر تحديث ${dateStr}` : ""}.`;
      } else {
        const k = { type: ["card type", "card types"], deck: ["deck", "decks"], theme: ["theme", "themes"] };
        count.textContent = `${c("deck")} ${k.deck[+(c("deck") !== 1)]}, ${c("type")} ${k.type[+(c("type") !== 1)]}, and ${c("theme")} ${k.theme[+(c("theme") !== 1)]} so far${dateStr ? ` · snapshot ${dateStr}` : ""}.`;
      }
      tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.kind === kind)));
    };
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (b) { kind = b.dataset.kind; render(); } });
    window.addEventListener("wikae-lang-change", render);
    whenVisible(box, async () => {
      try {
        const snap = await (await fetch("assets/market/market.json")).json();
        entries = snap.entries ?? [];
        generated = snap.generated ?? "";
        render();
      } catch {}
    }, "0px 0px 30% 0px");
  }
}

// ------------------------------------------------------------- the phone edition
// Below 640px (site.css "Score"): a dock that names the movement you're in and opens the programme,
// rails with a position meter, and the long material folded behind a tap. Nothing here runs wider.
{
  const phone = matchMedia("(max-width: 640px)");
  const dock = $("[data-dock]"), dn = $("[data-dock-n]"), dt = $("[data-dock-t]");
  const back = $("[data-programme]"), list = $("[data-programme-list]");
  let cur = -1;
  const getMovements = () => {
    const lang = getCurrentLang();
    return $$("main > section .head .opus, main > section > .wrap > .opus, main > section .film .opus").filter((o) => {
      const p = o.closest("[data-lang]");
      return !p || p.getAttribute("data-lang") === lang;
    }).map((o) => {
      const sec = o.closest("section");
      const n = [...o.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").replace(/\s+/g, " ").trim();
      return { sec, n, t: $("span", o)?.textContent.trim() ?? "" };
    }).filter((m) => m.sec?.id);
  };
  let movements = getMovements();
  if (dock) {
    const buildList = () => {
      movements = getMovements();
      if (!movements.length) return;
      const isAr = getCurrentLang() === "ar";
      const hEm = isAr ? $("#programme-h [data-lang='ar'] em") : $("#programme-h [data-lang='en'] em");
      if (hEm) {
        const arNums = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر"];
        hEm.textContent = isAr ? (arNums[movements.length] ?? String(movements.length)) : (["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen"][movements.length] ?? String(movements.length));
      }
      list.innerHTML = movements.map((m, i) => `<li><a href="#${m.sec.id}" data-i="${i}"><span class="pn">${esc(m.n)}</span><span class="pt">${esc(m.t)}</span></a></li>`).join("");
      if (cur >= 0 && cur < movements.length) {
        dn.textContent = movements[cur].n;
        dt.textContent = movements[cur].t;
      }
    };
    buildList();
    window.addEventListener("wikae-lang-change", buildList);
    const set = (i) => {
      if (i === cur) return;
      cur = i;
      const m = movements[i];
      if (!m) return;
      for (const el of [dn, dt]) { el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }
      dn.textContent = m.n; dt.textContent = m.t;
      $$("a", list).forEach((a) => a.toggleAttribute("aria-current", Number(a.dataset.i) === i));
    };
    // the dock comes up once the hero's buttons have scrolled away, and steps aside for the closing CTA
    const hero = $(".hero"), cta = $(".cta");
    let pastHero = false, atEnd = false;
    const show = () => dock.classList.toggle("show", phone.matches && pastHero && !atEnd);
    if (hero) new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; show(); }).observe(hero);
    if (cta) new IntersectionObserver(([e]) => { atEnd = e.isIntersecting; show(); }, { rootMargin: "0px 0px -20% 0px" }).observe(cta);
    const track = () => {
      if (!phone.matches) return;
      const y = innerHeight * 0.5;
      let i = 0;
      movements.forEach((m, k) => { if (m.sec.getBoundingClientRect().top < y) i = k; });
      set(i);
    };
    let ticking = false;
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; track(); }); } }, { passive: true });
    phone.addEventListener("change", () => { show(); track(); });
    track();

    const open = () => {
      back.hidden = false;
      $("[data-programme-open]").setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("sheet-open");
      requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add("open")));
      $("a[aria-current]", list)?.scrollIntoView({ block: "center" });
      $("[data-programme-close]", back).focus({ preventScroll: true });
    };
    const close = (then) => {
      back.classList.remove("open");
      $("[data-programme-open]").setAttribute("aria-expanded", "false");
      $("[data-programme-open]").focus({ preventScroll: true });
      document.documentElement.classList.remove("sheet-open");
      setTimeout(() => { back.hidden = true; then?.(); }, reduced ? 0 : 380);
    };
    $("[data-programme-open]").addEventListener("click", open);
    back.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='#']");
      if (a) { e.preventDefault(); const t = $(a.getAttribute("href")); close(() => t?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })); return; }
      if (e.target === back || e.target.closest("[data-programme-close]")) close();
    });
    addEventListener("keydown", (e) => {
      if (back.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const links = $$("button, a[href]", back), first = links[0], last = links.at(-1);
        if (!first) return;
        if (!back.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // swipe the sheet down to close it
    const sheet = $(".programme", back);
    let y0 = null;
    sheet.addEventListener("touchstart", (e) => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    sheet.addEventListener("touchmove", (e) => { if (y0 == null) return; const d = Math.max(0, e.touches[0].clientY - y0); sheet.style.transition = "none"; sheet.style.translate = `0 ${d}px`; }, { passive: true });
    sheet.addEventListener("touchend", (e) => {
      if (y0 == null) return;
      const d = e.changedTouches[0].clientY - y0; y0 = null;
      sheet.style.transition = sheet.style.translate = "";
      if (d > 90) close();
    });
  }

  // folded material: the button folds whatever its data-expand selector names (within its section)
  for (const b of $$("[data-expand]")) {
    const sec = b.closest("section") ?? document;
    const targets = $$(b.dataset.expand, sec);
    if (!targets.length) continue;
    const arSpan = b.querySelector('[data-lang="ar"]');
    const enSpan = b.querySelector('[data-lang="en"]');
    const moreAr = arSpan?.textContent ?? "قراءة المزيد";
    const moreEn = enSpan?.textContent ?? "Read more";
    const lessAr = b.dataset.less ?? "طي النص";
    const lessEn = b.dataset.lessEn ?? "Show less";
    const isLetter = targets[0].classList.contains("letter");
    const fold = (open) => {
      b.setAttribute("aria-expanded", String(open));
      if (arSpan) arSpan.textContent = open ? lessAr : moreAr;
      if (enSpan) enSpan.textContent = open ? lessEn : moreEn;
      for (const target of targets) {
        if (isLetter) target.classList.toggle("folded", !open && phone.matches);
        else { target.classList.add("folds"); target.classList.toggle("open", open); }
      }
    };
    // the letter lives inside .letter, so put its button after it, where the fade ends
    if (isLetter) targets[0].after(b);
    b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      fold(open);
      if (!open) b.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
    fold(false);
    phone.addEventListener("change", () => fold(b.getAttribute("aria-expanded") === "true"));
  }

  // rails: a meter under each says how far along you are, and how many there are
  for (const rail of $$("[data-rail]")) {
    const meter = document.createElement("div");
    meter.className = "rail-meter ph-only";
    meter.setAttribute("aria-hidden", "true");
    const isArInit = getCurrentLang() === "ar";
    meter.innerHTML = `<span class="tabular" data-pos></span><span class="bar"><i></i></span><span class="hint">${isArInit ? "اسحب للتصفح" : "swipe"}</span>`;
    rail.after(meter);
    const pos = $("[data-pos]", meter), bar = $(".bar i", meter), hintEl = $(".hint", meter);
    const update = () => {
      const items = [...rail.children].filter((c) => c.offsetWidth);
      const n = items.length;
      if (!n || rail.scrollWidth <= rail.clientWidth + 4) { meter.style.visibility = "hidden"; return; }
      meter.style.visibility = "";
      const max = rail.scrollWidth - rail.clientWidth;
      const f = max > 0 ? Math.min(1, Math.abs(rail.scrollLeft) / max) : 0;
      const shown = Math.max(1, Math.round(rail.clientWidth / (items[0].offsetWidth + 14)));
      const first = Math.min(n - shown, Math.round(f * (n - shown))) + 1;
      const isAr = getCurrentLang() === "ar";
      pos.textContent = isAr
        ? `${first}${shown > 1 ? `–${Math.min(n, first + shown - 1)}` : ""} من ${n}`
        : `${first}${shown > 1 ? `–${Math.min(n, first + shown - 1)}` : ""} of ${n}`;
      if (hintEl) hintEl.textContent = isAr ? "اسحب للتصفح" : "swipe";
      const w = Math.max(0.08, rail.clientWidth / rail.scrollWidth);
      bar.style.width = `${w * 100}%`;
      bar.style.setProperty("inset-inline-start", `${f * (1 - w) * 100}%`);
      bar.style.removeProperty("left");
      if (Math.abs(rail.scrollLeft) > 8 && hintEl) hintEl.hidden = true;
    };
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("wikae-lang-change", update);
    new ResizeObserver(update).observe(rail);
    new MutationObserver(update).observe(rail, { childList: true });
    update();
  }

  // no. 9: on a phone each part opens on tap
  for (const dt of $$(".feats dt")) {
    dt.setAttribute("role", "button");
    dt.tabIndex = 0;
    const toggle = () => phone.matches && dt.parentElement.classList.toggle("open");
    dt.addEventListener("click", toggle);
    dt.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle()));
  }

  // the hero's film button: go to the film and play it
  $("[data-play-film]")?.addEventListener("click", () => {
    const film = $("#film");
    film.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    $(".film-play")?.click();
  });
}
