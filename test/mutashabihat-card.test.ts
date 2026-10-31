import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { Etude } from "../src/core/engine.ts";
import { VERIFIED_SEED_CLUSTERS, generateEtudeItemsFromCluster } from "../src/core/mutashabihat.ts";

const template = readFileSync(new URL("../types/quran-mutashabihat/template.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../types/quran-mutashabihat/card.js", import.meta.url), "utf8");

function escapeHtml(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function mount(view: Record<string, unknown>, key: Record<string, unknown>, mode = "answer") {  const dom = new JSDOM(`<!doctype html><html><body>${template}</body></html>`, {
    runScripts: "outside-only",
    url: "http://localhost/",
  });
  const { window } = dom;
  const submitted: Record<string, unknown>[] = [];
  const ready: boolean[] = [];
  const messages: Record<string, unknown>[] = [];
  const results: ((r: { grade: unknown; key: unknown; answer: unknown }) => void)[] = [];

  window.postMessage = ((msg: Record<string, unknown>) => messages.push(msg)) as typeof window.postMessage;

  const etude = {
    view,
    mode,
    $: (sel: string) => window.document.querySelector(sel),
    $$: (sel: string) => [...window.document.querySelectorAll(sel)],
    escape: escapeHtml,
    md: (s: unknown) => `<p>${escapeHtml(s)}</p>`,
    submit: (answer: Record<string, unknown>) => submitted.push(answer),
    setReady: (v: boolean) => ready.push(v),
    getAnswer: () => {},
    onResult: (fn: (r: { grade: unknown; key: unknown; answer: unknown }) => void) => results.push(fn),
  };

  (window as unknown as { etude: typeof etude }).etude = etude;
  window.eval(script);
  return { window, etude, submitted, ready, messages, results };
}

async function prepare(mode: "pivotal_completion" | "surah_identification") {
  const e = await Etude.open(":memory:");
  const items = generateEtudeItemsFromCluster(VERIFIED_SEED_CLUSTERS[0], "Deck");
  for (const it of items) e.upsertItem(it);
  const item = items.find((i) => i.fields.mode === mode)!;
  const prep = e.prepare(item.id, "main", 5);
  const cardId = e.db.get<{ id: number }>("SELECT id FROM cards WHERE item_id = ?", item.id)!.id;
  return { e, prep, cardId };
}

test("card: pivotal mode masks the answer and submits an opaque option id", async () => {
  const { e, prep } = await prepare("pivotal_completion");
  const m = mount(prep.view, prep.key);
  const doc = m.window.document;

  const verse = doc.querySelector("#verse-display")!.textContent ?? "";
  assert.match(verse, /وَإِذْ قَالَ إِبْرَٰهِـۧمُ/);
  assert.doesNotMatch(verse, /بَلَدًا ءَامِنًا/, "the answer must stay masked");
  assert.match(verse, /\.\.\./);

  const options = [...doc.querySelectorAll(".mutashabih-option")];
  assert.ok(options.length >= 2 && options.length <= 4);
  assert.equal(doc.querySelectorAll(".mutashabih-option [data-target]").length, 0);

  assert.match(doc.querySelector("#badge-surah-title")!.textContent ?? "", /البقرة/);
  assert.match(doc.querySelector("#badge-surah-title")!.textContent ?? "", /١٢٦/);
  assert.ok(doc.querySelector('.mode-btn[data-mode="surah_identification"]')!.classList.contains("hidden"));

  (options[0] as HTMLElement).click();
  assert.equal(m.submitted.length, 1);
  assert.equal(m.submitted[0].mode, "pivotal_completion");
  assert.equal(m.submitted[0].submode, "choice");
  assert.match(String(m.submitted[0].chosenOptionId), /^p\d+$/);
  e.close();
});

test("card: surah mode hides the Surah name and shows Arabic-Indic labels", async () => {
  const { e, prep } = await prepare("surah_identification");
  const m = mount(prep.view, prep.key);
  const doc = m.window.document;

  assert.ok(!doc.querySelector("#surah-question-banner")!.classList.contains("hidden"));
  const header = doc.querySelector("#badge-surah-title")!.textContent ?? "";
  assert.doesNotMatch(header, /البقرة|إبراهيم/);
  assert.match(doc.querySelector("#verse-display")!.textContent ?? "", /بَلَدًا ءَامِنًا/);

  const options = [...doc.querySelectorAll(".mutashabih-option")];
  assert.ok(options.length >= 2 && options.length <= 4);
  assert.ok(options.some((o) => /١٢٦/.test(o.textContent ?? "")));
  assert.ok(doc.querySelector('.mode-btn[data-mode="pivotal_completion"]')!.classList.contains("hidden"));
  e.close();
});

test("card: typing mode submits the typed text", async () => {
  const { e, prep } = await prepare("pivotal_completion");
  const m = mount(prep.view, prep.key);
  const doc = m.window.document;

  (doc.querySelector('.mode-btn[data-submode="typing"]') as HTMLElement).click();
  assert.ok(!doc.querySelector("#typing-group")!.classList.contains("hidden"));

  const input = doc.querySelector("#arabic-typing-input") as HTMLInputElement;
  input.value = "بلدا آمنا";
  input.dispatchEvent(new m.window.Event("input", { bubbles: true }));
  (doc.querySelector("#submit-typing-btn") as HTMLElement).click();

  assert.equal(m.submitted.length, 1);
  assert.equal(m.submitted[0].submode, "typing");
  assert.equal(m.submitted[0].typedText, "بلدا آمنا");
  e.close();
});

test("card: result shows the comparison matrix, mnemonic and forwards FSRS ratings", async () => {
  const { e, prep, cardId } = await prepare("pivotal_completion");
  const answer = {
    mode: "pivotal_completion",
    submode: "choice",
    chosenOptionId: prep.key.correctOptionId,
    timeMs: 3200,
    usedHint: false,
  };
  const graded = await e.grade(cardId, 5, answer);
  const m = mount(prep.view, prep.key);
  m.etude.mode = "result";
  m.results[0]({ grade: graded.grade, key: prep.key, answer });
  const doc = m.window.document;

  assert.ok(doc.querySelector("#verdict-banner")!.classList.contains("is-correct"));
  assert.match(doc.querySelector("#verdict-status")!.textContent ?? "", /أحسنت/);
  assert.equal(doc.querySelectorAll(".sibling-item").length, 2);
  assert.equal(doc.querySelectorAll(".pivotal-mark").length, 2);
  assert.ok(!doc.querySelector("#mnemonic-container")!.classList.contains("hidden"));
  assert.match(doc.querySelector("#fsrs-recommended-name")!.textContent ?? "", /جيد/);

  (doc.querySelector('.fsrs-btn[data-rating="3"]') as HTMLElement).click();
  const message = m.messages.at(-1)!;
  assert.equal(message.etude, 1);
  assert.equal(message.type, "key");
  assert.equal(message.key, "3");
  e.close();
});

test("card: a wrong answer is marked wrong and suggests Again", async () => {
  const { e, prep, cardId } = await prepare("pivotal_completion");
  const options = prep.view.pivotalOptions as { id: string }[];
  const wrongId = options.find((o) => o.id !== prep.key.correctOptionId)!.id;
  const answer = { mode: "pivotal_completion", submode: "choice", chosenOptionId: wrongId, timeMs: 2500, usedHint: false };
  const graded = await e.grade(cardId, 5, answer);
  const m = mount(prep.view, prep.key);
  m.etude.mode = "result";
  m.results[0]({ grade: graded.grade, key: prep.key, answer });
  const doc = m.window.document;

  assert.ok(doc.querySelector("#verdict-banner")!.classList.contains("is-wrong"));
  assert.match(doc.querySelector("#verdict-status")!.textContent ?? "", /الصواب/);
  assert.match(doc.querySelector("#fsrs-recommended-name")!.textContent ?? "", /أعد/);
  e.close();
});
