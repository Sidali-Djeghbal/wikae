import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Etude } from "../src/core/engine.ts";
import { buildIndex, buildSubmission, checkEntry, entryJson, entryPath, fetchCover, fetchIndex, fetchMarketMedia, forgetInstall, installEntry, installFile, installState, installedEntries, mediaBatchStatus, publishFile, syncMediaBatches, MARKET_REPO, type MarketFile } from "../src/core/market.ts";
import { createApp } from "../src/server/app.ts";

const dir = () => mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "etude-market-"));
const SHOWCASE = JSON.parse(readFileSync(new URL("../examples/showcase.pack.json", import.meta.url), "utf8"));

async function source() {
  const e = await Etude.open(":memory:");
  e.saveTheme({ id: "sea", name: "Sea", scheme: "dark", vars: { "--highlight": "oklch(0.7 0.13 200)" } });
  e.importPack(SHOWCASE);
  return e;
}

/** Writes entries into a market folder and indexes it, like the repository's CI. */
async function market(files: MarketFile[]) {
  const root = dir();
  for (const f of files) {
    mkdirSync(join(root, "entries", `${f.kind}s`), { recursive: true });
    writeFileSync(join(root, entryPath(f.kind, f.id)), entryJson(f));
  }
  const { index, problems } = await buildIndex(root, { dryRunInto: () => Etude.open(":memory:") });
  assert.deepEqual(problems, []);
  writeFileSync(join(root, "index.json"), JSON.stringify(index));
  return root;
}

test("submissions: themes, decks and types become valid entries", async () => {
  const e = await source();
  const theme = buildSubmission(e, { kind: "theme", ref: "sea", author: "ana", tags: ["Dark"] });
  assert.equal(theme.id, "sea");
  assert.deepEqual(theme.tags, ["dark"]);
  assert.deepEqual(checkEntry(theme), []);

  const deck = buildSubmission(e, { kind: "deck", ref: "Wikae Showcase", author: "ana" });
  assert.equal(deck.content.etude, "pack/1");
  assert.equal(deck.content.items.length, SHOWCASE.items.length);
  assert.ok(deck.content.types.length > 0, "custom types the deck uses come along");
  assert.equal(JSON.stringify(deck).includes('"reviews"'), false);

  const type = buildSubmission(e, { kind: "type", ref: "chess", author: "ana", examples: 1 });
  assert.equal(type.content.types[0].id, "chess");
  assert.equal(type.content.items.length, 1);
  assert.equal(type.content.types[0].updated, undefined);

  assert.throws(() => buildSubmission(e, { kind: "theme", ref: "midnight" }), /ships with Wikae/);
  assert.throws(() => buildSubmission(e, { kind: "type", ref: "numeric" }), /ships with Wikae/);
});

test("submissions: item media travels inside the entry and installs into media", async () => {
  const e = await Etude.open(":memory:");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const m = e.storeMedia("dot.png", png);
  e.upsertItem({ id: "anat.1", type: "basic", deck: "Anatomy", fields: { front: "Dot", back: "A dot", image: m.url } });
  const deck = buildSubmission(e, { kind: "deck", ref: "Anatomy", author: "ana" });
  const item = deck.content.items.find((i: any) => i.id === "anat.1");
  assert.match(item.fields.image, /^data:image\/png;base64,/);
  assert.ok(!JSON.stringify(deck).includes("/media/"), "no collection-local paths leak into the entry");

  const b = await Etude.open(":memory:");
  installFile(b, deck);
  const image = b.item("anat.1").fields.image as string;
  assert.match(image, /^\/media\/files\/[a-f0-9]+\.png$/);
  assert.ok(existsSync(join(b.mediaDir, image.slice("/media/".length))), "the picture is in the new collection");
});

test("checkEntry rejects bad files", () => {
  assert.match(checkEntry({}).join(), /etudeMarket/);
  const bad = { etudeMarket: 1, kind: "deck", id: "X Y", name: "", author: "a", content: { etude: "pack/1", items: [] } };
  const errs = checkEntry(bad).join("; ");
  assert.match(errs, /id must be/);
  assert.match(errs, /name is required/);
  assert.match(errs, /at least one item/);
  const remote = { etudeMarket: 1, kind: "theme", id: "t", name: "T", author: "a", content: { id: "t", name: "T", vars: {}, css: "@import url(https://evil.example/x.css);" } };
  assert.match(checkEntry(remote).join(), /remote references/);
});

test("install from a market folder, reinstall, update detection", async () => {
  const src = await source();
  const theme = buildSubmission(src, { kind: "theme", ref: "sea", author: "ana" });
  const deck = buildSubmission(src, { kind: "deck", ref: "Wikae Showcase", id: "showcase", author: "ana" });
  const type = buildSubmission(src, { kind: "type", ref: "chess", id: "chess-move", author: "ana" });
  const url = await market([theme, deck, type]);
  const index = await fetchIndex(url, { refresh: true });
  assert.equal(index.entries.length, 3);

  const e = await Etude.open(":memory:");
  // A theme with the same id already exists here: the installed one gets a fresh id.
  e.saveTheme({ id: "sea", name: "My own sea", scheme: "light", vars: {} });
  const t = await installEntry(e, "sea", { url });
  assert.equal(t.result, "created");
  assert.equal(t.ids[0], "sea-2");
  assert.equal(e.theme("sea").name, "My own sea");
  const t2 = await installEntry(e, "sea", { url });
  assert.equal(t2.result, "unchanged");
  assert.equal(t2.ids[0], "sea-2", "an update keeps the id it got the first time");

  const dry = await installEntry(e, "showcase", { url, dryRun: true });
  assert.equal((dry.report as any).items.created, SHOWCASE.items.length);
  assert.ok(!e.deckTree().some((d) => d.name === "Wikae Showcase"), "dry run writes nothing");
  assert.equal(installedEntries(e)["deck:showcase"], undefined);

  const d = await installEntry(e, "showcase", { url });
  assert.equal(d.result, "created");
  assert.deepEqual(d.ids, ["Wikae Showcase"]);
  assert.equal(e.watchList({ deck: "Wikae Showcase" }).length, SHOWCASE.items.length);
  const again = await installEntry(e, "showcase", { url });
  assert.equal(again.result, "unchanged");
  assert.equal((again.report as any).items.unchanged, SHOWCASE.items.length);

  await installEntry(e, "chess-move", { url });
  assert.equal(e.type("chess").name, type.content.types[0].name);

  const entry = index.entries.find((x) => x.id === "showcase")!;
  assert.equal(installState(e, entry), "installed");
  assert.equal(installState(e, { ...entry, version: "2" }), "update");
});

test("installFile refuses invalid entries and the index flags them", async () => {
  const e = await Etude.open(":memory:");
  assert.throws(() => installFile(e, { etudeMarket: 1, kind: "type", id: "zz", name: "Z", author: "a", content: { etude: "pack/1", types: [{ id: "BAD" }] } } as any), /invalid market entry/);
  const root = dir();
  mkdirSync(join(root, "entries", "decks"), { recursive: true });
  writeFileSync(join(root, "entries", "decks", "wrong-name.json"), JSON.stringify({ etudeMarket: 1, kind: "deck", id: "other", name: "D", author: "a", content: { etude: "pack/1", items: [{ id: "x", type: "nope", deck: "D", fields: {} }] } }));
  const { problems } = await buildIndex(root, { dryRunInto: () => Etude.open(":memory:") });
  const errs = problems[0].errors.join("; ");
  assert.match(errs, /named other\.json/);
});

test("publish opens a pull request through a fork when you can't push", async () => {
  const src = await source();
  const file = buildSubmission(src, { kind: "theme", ref: "sea", author: "ana" });
  const calls: { args: string[]; input?: any }[] = [];
  const [marketOwner, marketName] = MARKET_REPO.split("/");
  const gh = (args: string[], input?: any) => {
    calls.push({ args, input });
    const path = args.find((a) => a.startsWith("repos/") || a === "user") ?? "";
    if (path === "user") return { login: "ana" };
    if (path === `repos/${MARKET_REPO}`) return { default_branch: "main", permissions: { push: false } };
    if (path.endsWith("/git/ref/heads/main")) return { object: { sha: "abc123" } };
    if (path.includes("/contents/") && !args.includes("PUT")) throw new Error("404");
    if (path.endsWith("/pulls")) return { html_url: `https://github.com/${MARKET_REPO}/pull/7`, number: 7 };
    return {};
  };
  const r = await publishFile(file, { gh });
  assert.equal(r.number, 7);
  assert.equal(r.fork, `ana/${marketName}`);
  const put = calls.find((c) => c.args.includes("PUT"))!;
  assert.ok(put.args.includes(`repos/ana/${marketName}/contents/entries/themes/sea.json`));
  assert.deepEqual(JSON.parse(Buffer.from(put.input.content, "base64").toString()), JSON.parse(entryJson(file)));
  const pr = calls.find((c) => c.args.at(-2) === `repos/${MARKET_REPO}/pulls` || c.args.includes(`repos/${MARKET_REPO}/pulls`))!;
  assert.match(pr.input.head, /^ana:theme-sea-/);
  assert.equal(pr.input.base, "main");
});

test("index records sha256 and install rejects a tampered entry", async () => {
  const src = await source();
  const url = await market([buildSubmission(src, { kind: "theme", ref: "sea", author: "ana" })]);
  const entry = (await fetchIndex(url, { refresh: true })).entries[0];
  assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  assert.equal(entry.sha256, createHash("sha256").update(readFileSync(join(url, entry.path))).digest("hex"));

  // Same length, so the byte count still matches and only the hash catches it.
  const file = JSON.parse(readFileSync(join(url, entry.path), "utf8"));
  file.author = "anb";
  writeFileSync(join(url, entry.path), entryJson(file));

  const e = await Etude.open(":memory:");
  await assert.rejects(() => installEntry(e, "sea", { url }), /doesn't match the index/);
});

test("installs are tracked by kind and id, so a deck and a type with the same id don't collide", async () => {
  const src = await source();
  const deck = buildSubmission(src, { kind: "deck", ref: "Wikae Showcase", id: "shared", author: "ana" });
  const type = buildSubmission(src, { kind: "type", ref: "chess", id: "shared", author: "ana", examples: 0 });
  const e = await Etude.open(":memory:");
  installFile(e, deck);
  installFile(e, type);
  assert.equal(installedEntries(e)["deck:shared"].kind, "deck");
  assert.equal(installedEntries(e)["type:shared"].kind, "type");
  assert.equal(installState(e, deck), "installed");
  assert.equal(installState(e, type), "installed");
  assert.equal(forgetInstall(e, "shared"), true);
  assert.equal(installState(e, deck), null);
  assert.equal(installState(e, type), "installed");

  // Collections saved before installs were namespaced still read.
  e.db.setSetting("market", { installed: { shared: { kind: "deck", name: deck.name, version: deck.version, updated: deck.updated, at: "", ids: [] } } });
  assert.equal(installState(e, deck), "installed");
});

test("publishing inlines /media/ embeds inside Markdown and HTML fields", async () => {
  const e = await Etude.open(":memory:");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const m = e.storeMedia("dot.png", png);
  e.upsertItem({ id: "embed", type: "basic", deck: "Embed Deck", fields: { front: `![dot](${m.url}) and <img src="${m.url}">`, back: "x" } });
  const deck = buildSubmission(e, { kind: "deck", ref: "Embed Deck", author: "ana" });
  const front = deck.content.items[0].fields.front;
  assert.match(front, /^!\[dot\]\(data:image\/png;base64,/);
  assert.match(front, /<img src="data:image\/png;base64,/);
  assert.ok(!front.includes("/media/"));
});

test("progressive offline media batches download batch 1 on install and prefetch batch 2 on heavy usage", async () => {
  const root = dir();
  const makeAudio = (tag: string) => {
    const data = Buffer.from(`ID3-audio-${tag}-clip`);
    const hash = createHash("sha256").update(data).digest("hex");
    return { name: `${tag}.mp3`, data, hash, url: `/media/files/${hash}.mp3` };
  };
  const b1Clips = [1, 2, 3, 4].map((n) => makeAudio(`b1-${n}`));
  const b2Clips = [5, 6, 7, 8].map((n) => makeAudio(`b2-${n}`));
  const writeBundle = (id: string, clips: ReturnType<typeof makeAudio>[]) => {
    const rel = `bundles/decks/tajweed-demo/${id}.json`;
    const body = JSON.stringify({
      etudeBatch: 1,
      id,
      files: clips.map((c) => ({
        name: c.name,
        url: c.url,
        sha256: c.hash,
        data: `data:audio/mpeg;base64,${c.data.toString("base64")}`,
      })),
    });
    mkdirSync(join(root, "bundles/decks/tajweed-demo"), { recursive: true });
    writeFileSync(join(root, rel), body);
    const buf = Buffer.from(body);
    return {
      id,
      order: id === "batch-01" ? 1 : 2,
      path: rel,
      sha256: createHash("sha256").update(buf).digest("hex"),
      bytes: buf.length,
      itemIds: clips.map((_, i) => `taj.${id}.${i + 1}`),
      media: clips.map((c) => c.url),
    };
  };
  const batch1 = writeBundle("batch-01", b1Clips);
  const batch2 = writeBundle("batch-02", b2Clips);

  const deckEntry: MarketFile = {
    etudeMarket: 1,
    kind: "deck",
    id: "tajweed-demo",
    name: "Tajweed Demo",
    description: "Batched audio clips",
    author: "ana",
    tags: ["tajweed"],
    version: "1.0.0",
    updated: "2026-11-24",
    content: {
      etude: "pack/1",
      name: "Tajweed Demo",
      decks: [{ name: "Tajweed Demo" }],
      mediaBatches: [batch1, batch2],
      items: [
        ...b1Clips.map((c, i) => ({
          id: `taj.batch-01.${i + 1}`,
          type: "basic",
          deck: "Tajweed Demo",
          fields: { front: `Listen ${i + 1}: ${c.url}`, back: "Izhar" },
        })),
        ...b2Clips.map((c, i) => ({
          id: `taj.batch-02.${i + 1}`,
          type: "basic",
          deck: "Tajweed Demo",
          fields: { front: `Listen ${i + 5}: ${c.url}`, back: "Idgham" },
        })),
      ],
    },
  };
  mkdirSync(join(root, "entries/decks"), { recursive: true });
  writeFileSync(join(root, "entries/decks/tajweed-demo.json"), entryJson(deckEntry));
  const { index, problems } = await buildIndex(root, { dryRunInto: () => Etude.open(":memory:") });
  assert.deepEqual(problems, []);
  writeFileSync(join(root, "index.json"), JSON.stringify(index));

  const e = await Etude.open(join(dir(), "etude.db"));
  const installed = await installEntry(e, "tajweed-demo", { url: root });
  assert.equal(installed.result, "created");
  // Only batch 1 files exist locally right after install.
  for (const c of b1Clips) assert.ok(existsSync(join(e.mediaDir, c.url.slice("/media/".length))));
  for (const c of b2Clips) assert.ok(!existsSync(join(e.mediaDir, c.url.slice("/media/".length))));
  // Study queue only serves the 4 ready offline cards, never the undownloaded batch 2 cards.
  assert.equal(e.counts({ deck: "Tajweed Demo" }).new, 4);

  let st = mediaBatchStatus(e, { deck: "Tajweed Demo" })[0];
  assert.equal(st.downloadedBatches, 1);
  assert.equal(st.pendingBatches, 1);
  assert.equal(st.shouldPrefetch, false);

  // Study 2 of 4 cards (<75%): should not prefetch batch 2 yet.
  for (let i = 0; i < 2; i++) {
    const n = e.next({ deck: "Tajweed Demo" }).card!;
    assert.ok(n.itemId.startsWith("taj.batch-01."));
    e.rate(n.cardId, 3);
  }
  const early = await syncMediaBatches(e, { deck: "Tajweed Demo" });
  assert.equal(early.downloaded.length, 0);
  assert.equal(mediaBatchStatus(e, { deck: "Tajweed Demo" })[0].downloadedBatches, 1);

  // Study 3rd card (75% practiced, 1 remaining): auto-prefetch threshold triggers batch 2.
  const third = e.next({ deck: "Tajweed Demo" }).card!;
  e.rate(third.cardId, 3);
  st = mediaBatchStatus(e, { deck: "Tajweed Demo" })[0];
  assert.equal(st.shouldPrefetch, true);

  const app = createApp(e);
  const res = await app.request("/api/market/batches/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deck: "Tajweed Demo" }),
  });
  assert.equal(res.status, 200);
  const synced = await res.json();
  assert.equal(synced.downloaded.length, 1);
  assert.equal(synced.downloaded[0].batchId, "batch-02");
  for (const c of b2Clips) assert.ok(existsSync(join(e.mediaDir, c.url.slice("/media/".length))));
  // Batch 2 cards are now unlocked in the offline study queue!
  assert.equal(e.counts({ deck: "Tajweed Demo" }).new, 5); // 1 remaining from batch 1 + 4 from batch 2
  // All batch media files are referenced in item fields so unusedMedia keeps them.
  assert.equal(e.unusedMedia().length, 0);
});

test("covers and media serve from local market and fall back when remote is unreachable", async (t) => {
  const root = dir();
  const webp = Buffer.from("RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00\x30\x01\x00\x9d\x01\x2a\x01\x00\x01\x00\x02\x00", "binary");
  mkdirSync(join(root, "covers/decks"), { recursive: true });
  mkdirSync(join(root, "media/decks/demo"), { recursive: true });
  writeFileSync(join(root, "covers/decks/demo.webp"), webp);
  writeFileSync(join(root, "media/decks/demo/01.webp"), webp);

  const cov = await fetchCover(root, "covers/decks/demo.webp");
  assert.equal(cov.type, "image/webp");
  assert.deepEqual(cov.body, webp);

  const med = await fetchMarketMedia(root, "media/decks/demo/01.webp");
  assert.equal(med.type, "image/webp");
  assert.deepEqual(med.body, webp);

  // Stub fetch so remote errors don't open sockets and trigger deterministic HTTP/network paths.
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  await assert.rejects(() => fetchCover("http://127.0.0.1:4611", "covers/decks/missing-test-only.webp"), /answered 503/);
  await assert.rejects(() => fetchMarketMedia("http://127.0.0.1:4611", "media/decks/missing-test-only/01.webp"), /answered 503/);

  if (existsSync(new URL("../../wikae-market/covers/decks/quran-tajweed-audio.webp", import.meta.url))) {
    const fbCover = await fetchCover("http://127.0.0.1:4611", "covers/decks/quran-tajweed-audio.webp");
    assert.equal(fbCover.type, "image/webp");
    assert.ok(fbCover.body.length > 0);
    const fbMedia = await fetchMarketMedia("http://127.0.0.1:4611", "media/decks/quran-tajweed-audio/01-title.webp");
    assert.equal(fbMedia.type, "image/webp");
    assert.ok(fbMedia.body.length > 0);
  }
});
