// The market: themes, decks and card types people share. It's a public GitHub repository (or any
// folder or URL with the same layout): one JSON file per entry under entries/, plus an index.json
// that CI regenerates. Reading needs no account; publishing opens a pull request with `gh`.
//
//   index.json                         { etude: "market/1", generated, repo, entries: [IndexEntry] }
//   entries/themes/<id>.json           { etudeMarket: 1, kind: "theme", id, name, ..., content: Theme }
//   entries/decks/<id>.json            { ..., kind: "deck", content: pack/1 }
//   entries/types/<id>.json            { ..., kind: "type", content: pack/1 with types (+ example items) }
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { EtudeError, plainLabel, type Etude } from "./engine.ts";
import { mediaType } from "./media.ts";
import { BUILTIN_THEMES, THEME_ID, ThemeError, freeThemeId, normalizeTheme, type Theme } from "./themes.ts";
import { validateType } from "./types.ts";
import type { CardTypeDef } from "./model.ts";
import { appEnv } from "./util.ts";

export const MARKET_REPO = "Sidali-Djeghbal/wikae-market";
export const DEFAULT_MARKET = { url: `https://raw.githubusercontent.com/${MARKET_REPO}/main`, repo: MARKET_REPO };
export const MARKET_KINDS = ["theme", "deck", "type"] as const;
export type MarketKind = (typeof MARKET_KINDS)[number];
/** Largest entry file the app will download or publish. */
export const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const ENTRY_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;

export interface MarketSettings {
  /** Where the index and entries are read from: a URL or a local folder. */
  url: string;
  /** GitHub repository pull requests go to. */
  repo: string;
}

export interface MarketMeta {
  id: string;
  kind: MarketKind;
  name: string;
  description: string;
  author: string;
  tags: string[];
  version: string;
  updated: string;
}

export interface MarketFile extends MarketMeta {
  etudeMarket: 1;
  content: any;
}

export interface MediaBatchSpec {
  id: string;
  order: number;
  title?: string;
  path: string;
  sha256: string;
  bytes: number;
  itemIds: string[];
  media: string[];
}

export interface MediaBatchRecord extends MediaBatchSpec {
  downloaded: boolean;
  downloadedAt?: string;
}

export interface EntryMediaBatches {
  entryId: string;
  kind: MarketKind;
  url: string;
  decks: string[];
  batches: MediaBatchRecord[];
  lastError?: string;
  lastAttemptAt?: string;
}

export interface MediaBatchStatus {
  entryId: string;
  kind: MarketKind;
  decks: string[];
  totalBatches: number;
  downloadedBatches: number;
  pendingBatches: number;
  totalItems: number;
  downloadedItems: number;
  practicedItems: number;
  remainingUnpracticed: number;
  downloadedBytes: number;
  totalBytes: number;
  shouldPrefetch: boolean;
  lastError?: string;
  nextBatch: { id: string; order: number; title?: string; bytes: number; items: number } | null;
  batches: { id: string; order: number; title?: string; bytes: number; items: number; practiced: number; downloaded: boolean; downloadedAt?: string }[];
}

interface MarketBatchBundle {
  etudeBatch: 1;
  id: string;
  files: { name: string; url?: string; sha256?: string; data: string }[];
}

export type MarketSummary =
  | { theme: Theme }
  | { decks: string[]; items: number; cardTypes: Record<string, number>; types: { id: string; name: string }[]; watch: boolean; samples: string[] }
  | { types: { id: string; name: string; description: string; grader: string; fields: string[]; assets?: { files: number; bytes: number } }[]; items: number; samples: string[] };

/** A one-line label for an item, from its first text-like field. Media paths and data URLs are skipped. */
function sampleOf(item: any): string {
  const f = item?.fields ?? {};
  const text = (v: unknown): v is string => typeof v === "string" && !!v.trim() && !/^(?:data:|https?:\/\/|\/media\/)/i.test(v.trim());
  for (const k of ["prompt", "front", "question", "note", "text", "letter", "title"]) if (text(f[k])) return plainLabel(f[k]).slice(0, 90);
  const first = Object.values(f).find(text);
  return first ? plainLabel(first).slice(0, 90) : "";
}
/** How many asset files a type carries and their decoded size, for the index. */
function assetSummary(t: any): { assets?: { files: number; bytes: number } } {
  const a = t?.assets;
  if (!a || typeof a !== "object" || !Object.keys(a).length) return {};
  const vals = Object.values(a).filter((v): v is string => typeof v === "string");
  return { assets: { files: vals.length, bytes: vals.reduce((n, b) => n + Buffer.byteLength(b, "base64"), 0) } };
}
const samplesOf = (items: any[]) => [...new Set(items.map(sampleOf).filter(Boolean))].slice(0, 3);

export interface IndexEntry extends MarketMeta {
  path: string;
  bytes: number;
  /** SHA-256 (hex) of the entry file, checked when installing. */
  sha256: string;
  /** Optional picture of the entry in use, `covers/<kind>s/<id>.<webp|png|jpg>`. */
  cover?: string;
  /** Ordered screenshots and optional silent preview clips, discovered by market index. */
  media?: string[];
  summary: MarketSummary;
}

export interface MarketIndex {
  etude: "market/1";
  generated: string;
  repo: string;
  entries: IndexEntry[];
}

export class MarketError extends EtudeError {}

export const entryPath = (kind: MarketKind, id: string) => `entries/${kind}s/${id}.json`;

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const isRemote = (url: string) => /^https?:\/\//i.test(url);
const localDir = (url: string) => resolve(url.replace(/^file:\/\//, ""));

/**
 * raw.githubusercontent.com caches a branch for five minutes, whatever the query string. For a
 * refresh, ask the GitHub API which commit the branch is on and read that commit instead.
 */
async function pinnedUrl(url: string): Promise<string> {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([\w./-]+?)\/?$/.exec(url);
  if (!m) return url;
  try {
    const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/commits/${m[3]}`, { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/vnd.github.sha" } });
    const sha = res.ok ? (await res.text()).trim() : "";
    return /^[0-9a-f]{40}$/.test(sha) ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${sha}` : url;
  } catch {
    return url;
  }
}

/** Reads one file of the market, from a URL or a folder. */
function tryReadLocalFallback(path: string): { text: string; bytes: number; body: Buffer } | null {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "../../market", path),
    join(dirname(fileURLToPath(import.meta.url)), "../../wikae-market", path),
    join(process.env.HOME || "", "market", path),
    join(process.env.HOME || "", "wikae-market", path),
    join(process.env.HOME || "", "etude-market", path),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      const buf = readFileSync(c);
      return { text: buf.toString("utf8"), bytes: buf.length, body: buf };
    }
  }
  return null;
}

async function readMarketFile(url: string, path: string, opts: { fresh?: boolean } = {}): Promise<{ text: string; bytes: number; body: Buffer }> {
  if (!isRemote(url)) {
    const p = join(localDir(url), path);
    if (!existsSync(p)) throw new MarketError(`the market has no ${path}`, 404);
    const buf = readFileSync(p);
    if (buf.length > MAX_ENTRY_BYTES) throw new MarketError(`${path} is larger than ${MAX_ENTRY_BYTES} bytes`);
    return { text: buf.toString("utf8"), bytes: buf.length, body: buf };
  }
  const base = opts.fresh ? await pinnedUrl(url) : pinnedUrls.get(url) ?? url;
  if (opts.fresh) {
    if (base === url) pinnedUrls.delete(url);
    else pinnedUrls.set(url, base);
  }
  const full = `${base.replace(/\/+$/, "")}/${path}`;
  let res: Response;
  try {
    res = await fetch(full, { signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json, text/plain" } });
  } catch (e) {
    const local = tryReadLocalFallback(path);
    if (local) return local;
    throw new MarketError(`couldn't reach the market (${(e as Error).message})`, 502);
  }
  if (!res.ok) {
    const local = tryReadLocalFallback(path);
    if (local) return local;
    if (res.status === 404) throw new MarketError(`the market has no ${path}`, 404);
    throw new MarketError(`the market answered ${res.status} for ${path}`, 502);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ENTRY_BYTES) throw new MarketError(`${path} is larger than ${MAX_ENTRY_BYTES} bytes`);
  return { text: buf.toString("utf8"), bytes: buf.length, body: buf };
}

function parseJson(text: string, what: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new MarketError(`${what} isn't valid JSON: ${(e as Error).message}`);
  }
}

// ------------------------------------------------------------------ validation

/** Problems with an entry file's shape and content (empty when it's fine). Doesn't touch a database. */
export function checkEntry(file: any): string[] {
  const errors: string[] = [];
  if (!file || typeof file !== "object" || Array.isArray(file)) return ["an entry must be a JSON object"];
  if (file.etudeMarket !== 1) errors.push('expected "etudeMarket": 1');
  if (!MARKET_KINDS.includes(file.kind)) errors.push(`kind must be one of ${MARKET_KINDS.join(", ")}`);
  if (typeof file.id !== "string" || !ENTRY_ID.test(file.id)) errors.push("id must be a lowercase slug (a-z, 0-9, -), 2 to 64 characters");
  if (typeof file.name !== "string" || !file.name.trim()) errors.push("name is required");
  else if (file.name.length > 80) errors.push("name is longer than 80 characters");
  if (file.description !== undefined && typeof file.description !== "string") errors.push("description must be text");
  if (typeof file.description === "string" && file.description.length > 2000) errors.push("description is longer than 2000 characters");
  if (typeof file.author !== "string" || !file.author.trim()) errors.push("author is required");
  if (file.tags !== undefined && (!Array.isArray(file.tags) || file.tags.some((t: unknown) => typeof t !== "string" || t.length > 32) || file.tags.length > 12)) errors.push("tags must be a list of at most 12 short words");
  if (file.version !== undefined && typeof file.version !== "string") errors.push("version must be text");
  const c = file.content;
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    errors.push("content is required");
    return errors;
  }
  if (file.kind === "theme") {
    try {
      const { removed } = normalizeTheme(c);
      if (removed.length) errors.push(`theme CSS has remote references that would be removed: ${removed.join(", ")}`);
    } catch (e) {
      errors.push(`theme: ${e instanceof ThemeError ? e.message : String(e)}`);
    }
    if (BUILTIN_THEMES.some((t) => t.id === c.id)) errors.push(`theme id "${c.id}" is a built-in theme; pick another`);
  } else if (file.kind === "deck" || file.kind === "type") {
    if (c.etude !== "pack/1") errors.push('content must be a Wikae pack ("etude": "pack/1")');
    if (!Array.isArray(c.items ?? [])) errors.push("content.items must be a list");
    if (!Array.isArray(c.types ?? [])) errors.push("content.types must be a list");
    for (const t of c.types ?? []) {
      const te = validateType(t);
      if (te.length) errors.push(`type ${t?.id ?? "?"}: ${te.join("; ")}`);
    }
    if (file.kind === "deck" && !(c.items ?? []).length) errors.push("a deck needs at least one item");
    if (file.kind === "type" && !(c.types ?? []).length) errors.push("a card type entry needs at least one type in content.types");
    if (c.mediaBatches !== undefined) {
      if (!Array.isArray(c.mediaBatches)) errors.push("content.mediaBatches must be a list");
      else {
        const seenBatches = new Set<string>();
        for (const [i, b] of c.mediaBatches.entries()) {
          if (!b || typeof b !== "object" || Array.isArray(b)) {
            errors.push(`mediaBatches[${i}] must be an object`);
            continue;
          }
          if (typeof b.id !== "string" || !ENTRY_ID.test(b.id)) errors.push(`mediaBatches[${i}].id must be a lowercase slug`);
          else if (seenBatches.has(b.id)) errors.push(`duplicate media batch id "${b.id}"`);
          else seenBatches.add(b.id);
          if (!Number.isInteger(b.order) || b.order < 1) errors.push(`mediaBatches[${i}].order must be a positive integer`);
          if (typeof b.path !== "string" || !/^bundles\/(themes|decks|types)\/[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(b.path))
            errors.push(`mediaBatches[${i}].path must stay under bundles/<kind>s/<id>/<batch>.json`);
          if (typeof b.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(b.sha256)) errors.push(`mediaBatches[${i}].sha256 must be a sha256 hex digest`);
          if (!Number.isInteger(b.bytes) || b.bytes <= 0 || b.bytes > MAX_ENTRY_BYTES) errors.push(`mediaBatches[${i}].bytes must be a valid byte size`);
          if (!Array.isArray(b.itemIds) || !b.itemIds.length || b.itemIds.some((x: unknown) => typeof x !== "string" || !x))
            errors.push(`mediaBatches[${i}].itemIds must be a non-empty list of item ids`);
          if (!Array.isArray(b.media) || b.media.some((x: unknown) => typeof x !== "string" || !x.startsWith("/media/")))
            errors.push(`mediaBatches[${i}].media must be a list of /media/ paths`);
        }
      }
    }
  }
  return errors;
}

export function metaOf(file: MarketFile): MarketMeta {
  return {
    id: file.id,
    kind: file.kind,
    name: file.name.trim(),
    description: (file.description ?? "").trim(),
    author: file.author.trim(),
    tags: (file.tags ?? []).map((t) => t.trim()).filter(Boolean),
    version: file.version || "1",
    updated: file.updated || "",
  };
}

/** What the index says about an entry, so the app can show it without downloading it. */
export function summarize(file: MarketFile): MarketSummary {
  const c = file.content;
  if (file.kind === "theme") return { theme: normalizeTheme(c).theme };
  const items: any[] = c.items ?? [];
  const types: any[] = c.types ?? [];
  if (file.kind === "type") {
    return {
      types: types.map((t) => ({ id: t.id, name: t.name, description: t.description ?? "", grader: t.grader?.kind ?? "self", fields: (t.fields ?? []).map((f: any) => f.name), ...assetSummary(t) })),
      items: items.length,
      samples: samplesOf(items),
    };
  }
  const cardTypes: Record<string, number> = {};
  for (const it of items) cardTypes[it.type] = (cardTypes[it.type] ?? 0) + 1;
  const decks = [...new Set([...(c.decks ?? []).map((d: any) => d.name), ...items.map((i) => i.deck)])].filter(Boolean).sort();
  const watch = (c.presets ?? []).some((p: any) => p?.config?.mode === "watch") || (c.decks ?? []).some((d: any) => d?.config?.mode === "watch");
  return { decks, items: items.length, cardTypes, types: types.map((t) => ({ id: t.id, name: t.name })), watch, samples: samplesOf(items) };
}

// ------------------------------------------------------------------ reading

export function marketSettings(e: Etude): MarketSettings {
  const s = (e.settings() as any).market ?? {};
  return { url: s.url || DEFAULT_MARKET.url, repo: s.repo || DEFAULT_MARKET.repo };
}

const indexCache = new Map<string, { at: number; index: MarketIndex }>();
/** A refreshed index is pinned to a commit; entries must come from that same commit for sha256 to match. */
const pinnedUrls = new Map<string, string>();

const COVER_EXT = ["webp", "png", "jpg"] as const;
export const MAX_COVER_BYTES = 600 * 1024;
const COVER_TYPE: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/** Only catalog-owned image/video paths can be served. No external URLs or traversal. */
export const MARKET_MEDIA_PATH = /^media\/(themes|decks|types)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png|jpg|mp4|webm)$/;
export const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
export async function fetchMarketMedia(url: string, path: string): Promise<{ body: Buffer; type: string }> {
  const m = MARKET_MEDIA_PATH.exec(path);
  if (!m) throw new MarketError(`unexpected media path ${path}`);
  let body: Buffer;
  if (!isRemote(url)) {
    const p = join(localDir(url), path);
    if (!existsSync(p)) throw new MarketError(`the market has no ${path}`, 404);
    body = readFileSync(p);
  } else {
    const target = `${url.replace(/\/+$/, "")}/${path}`;
    const res = await fetch(target, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (res && res.ok) {
      if (Number(res.headers.get("content-length")) > MAX_MEDIA_BYTES) throw new MarketError("media is too large");
      body = Buffer.from(await res.arrayBuffer());
    } else {
      const local = tryReadLocalFallback(path);
      if (local) body = local.body;
      else if (!res) throw new MarketError(`couldn't reach the market for ${path}`, 502);
      else throw new MarketError(`the market answered ${res.status} for ${path}`, res.status === 404 ? 404 : 502);
    }
  }
  if (body.length > MAX_MEDIA_BYTES) throw new MarketError("media is too large");
  return { body, type: ({ ...COVER_TYPE, mp4: "video/mp4", webm: "video/webm" } as Record<string, string>)[m[2]] };
}

/** An entry's cover image, as bytes and a content type. */
export async function fetchCover(url: string, cover: string): Promise<{ body: Buffer; type: string }> {
  const m = /^covers\/(themes|decks|types)\/[a-z0-9-]+\.(webp|png|jpg)$/.exec(cover);
  if (!m) throw new MarketError(`unexpected cover path ${cover}`);
  let body: Buffer;
  if (!isRemote(url)) {
    const p = join(localDir(url), cover);
    if (!existsSync(p)) throw new MarketError(`the market has no ${cover}`, 404);
    body = readFileSync(p);
  } else {
    const target = `${url.replace(/\/+$/, "")}/${cover}`;
    let res: Response | null = null;
    let netErr: unknown = null;
    try {
      res = await fetch(target, { signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      netErr = e;
    }
    if (res && res.ok) {
      body = Buffer.from(await res.arrayBuffer());
    } else {
      const local = tryReadLocalFallback(cover);
      if (local) body = local.body;
      else if (netErr) throw new MarketError(`couldn't reach the market (${(netErr as Error).message})`, 502);
      else throw new MarketError(`the market answered ${res!.status} for ${cover}`, res!.status === 404 ? 404 : 502);
    }
  }
  if (body.length > MAX_COVER_BYTES) throw new MarketError(`${cover} is larger than ${MAX_COVER_BYTES} bytes`);
  return { body, type: COVER_TYPE[m[2]] };
}

export async function fetchIndex(url: string, opts: { refresh?: boolean } = {}): Promise<MarketIndex> {
  const hit = indexCache.get(url);
  if (hit && !opts.refresh && Date.now() - hit.at < 60_000) return hit.index;
  const { text } = await readMarketFile(url, "index.json", { fresh: opts.refresh });
  const index = parseJson(text, "index.json");
  if (index?.etude !== "market/1" || !Array.isArray(index.entries)) throw new MarketError("index.json isn't a Wikae market index");
  indexCache.set(url, { at: Date.now(), index });
  return index;
}

export async function fetchEntry(url: string, entry: Pick<IndexEntry, "kind" | "id" | "path"> & Partial<Pick<IndexEntry, "bytes" | "sha256">>): Promise<MarketFile> {
  const path = entry.path || entryPath(entry.kind, entry.id);
  if (!/^entries\/(themes|decks|types)\/[a-z0-9-]+\.json$/.test(path)) throw new MarketError(`unexpected entry path ${path}`);
  const { text, bytes, body } = await readMarketFile(url, path);
  if (typeof entry.bytes === "number" && entry.bytes !== bytes) throw new MarketError(`${path} is ${bytes} bytes; the index says ${entry.bytes}`);
  if (entry.sha256) {
    const digest = createHash("sha256").update(body).digest("hex");
    if (digest !== entry.sha256) throw new MarketError(`${path} doesn't match the index (sha256 ${digest}, expected ${entry.sha256})`);
  }
  const file = parseJson(text, path);
  const errors = checkEntry(file);
  if (errors.length) throw new MarketError(`${path} is invalid: ${errors.join("; ")}`);
  if (file.id !== entry.id || file.kind !== entry.kind) throw new MarketError(`${path} says it is ${file.kind} "${file.id}", the index says ${entry.kind} "${entry.id}"`);
  return file as MarketFile;
}

// ------------------------------------------------------------------ installed state

export interface InstalledEntry {
  kind: MarketKind;
  name: string;
  version: string;
  updated: string;
  at: string;
  /** What it put in the collection: theme id, top-level deck names, or type ids. */
  ids: string[];
}

export const installKey = (kind: MarketKind, id: string) => `${kind}:${id}`;
/** Entries saved before installs were namespaced are keyed by the bare id. */
export const installedRec = (map: Record<string, InstalledEntry>, kind: MarketKind, id: string) => {
  const rec = map[installKey(kind, id)] ?? map[id];
  return rec?.kind === kind ? rec : undefined;
};

export function installedEntries(e: Etude): Record<string, InstalledEntry> {
  return e.db.setting<{ installed?: Record<string, InstalledEntry> }>("market", {}).installed ?? {};
}

export function entryMediaBatches(e: Etude): Record<string, EntryMediaBatches> {
  return e.db.setting<{ batches?: Record<string, EntryMediaBatches> }>("market", {}).batches ?? {};
}

function saveEntryMediaBatches(e: Etude, key: string, rec: EntryMediaBatches | null) {
  const cur = e.db.setting<{ installed?: Record<string, InstalledEntry>; batches?: Record<string, EntryMediaBatches> }>("market", {});
  const batches = { ...(cur.batches ?? {}) };
  if (rec) batches[key] = rec;
  else delete batches[key];
  e.db.setSetting("market", { ...cur, batches });
}

function recordInstall(e: Etude, id: string, rec: InstalledEntry) {
  const cur = e.db.setting<{ installed?: Record<string, InstalledEntry>; batches?: Record<string, EntryMediaBatches> }>("market", {});
  e.db.setSetting("market", { ...cur, installed: { ...(cur.installed ?? {}), [installKey(rec.kind, id)]: rec } });
}

export function forgetInstall(e: Etude, id: string): boolean {
  const cur = e.db.setting<{ installed?: Record<string, InstalledEntry>; batches?: Record<string, EntryMediaBatches> }>("market", {});
  // Old collections hold bare ids; accept those too.
  const key = Object.keys(cur.installed ?? {}).find((k) => k === id || k.endsWith(`:${id}`));
  if (!key) return false;
  const { [key]: _gone, ...rest } = cur.installed!;
  const batches = { ...(cur.batches ?? {}) };
  delete batches[key];
  delete batches[id];
  e.db.setSetting("market", { ...cur, installed: rest, batches });
  return true;
}

/** "installed", "update" (the market has a newer version), or null. */
export function installState(e: Etude, entry: MarketMeta, installed = installedEntries(e)): "installed" | "update" | null {
  const rec = installedRec(installed, entry.kind, entry.id);
  if (!rec) return null;
  return rec.version !== entry.version || (entry.updated && rec.updated !== entry.updated) ? "update" : "installed";
}

// ------------------------------------------------------------------ media batches

const batchLocks = new Map<string, Promise<any>>();

function batchMediaExists(e: Etude, mediaPath: string): boolean {
  if (!mediaPath.startsWith("/media/")) return false;
  const rel = mediaPath.slice("/media/".length);
  if (!rel || rel.includes("..")) return false;
  return existsSync(join(e.mediaDir, rel));
}

function reconcileBatches(e: Etude, rec: EntryMediaBatches): { rec: EntryMediaBatches; changed: boolean } {
  let changed = false;
  const batches = rec.batches.map((b) => {
    const allPresent = b.media.length > 0 && b.media.every((m) => batchMediaExists(e, m));
    if (allPresent !== b.downloaded) {
      changed = true;
      return { ...b, downloaded: allPresent, ...(allPresent && !b.downloadedAt ? { downloadedAt: new Date().toISOString() } : {}) };
    }
    return b;
  });
  return { rec: changed ? { ...rec, batches } : rec, changed };
}

function deckMatchesEntry(deck: string | undefined, entryDecks: string[]): boolean {
  if (!deck) return true;
  const d = deck.toLowerCase();
  return entryDecks.some((root) => {
    const r = root.toLowerCase();
    return r === d || r.startsWith(d + "::") || d.startsWith(r + "::");
  });
}

function practicedItemIds(e: Etude, itemIds: string[]): Set<string> {
  if (!itemIds.length) return new Set();
  const marks = itemIds.map(() => "?").join(",");
  const rows = e.db.all<{ item_id: string }>(
    `SELECT DISTINCT c.item_id FROM cards c WHERE c.item_id IN (${marks}) AND (c.reps > 0 OR EXISTS (SELECT 1 FROM attempts a WHERE a.card_id = c.id))`,
    ...itemIds,
  );
  return new Set(rows.map((r) => r.item_id));
}

function summarizeBatchEntry(e: Etude, key: string, raw: EntryMediaBatches): MediaBatchStatus {
  const { rec, changed } = reconcileBatches(e, raw);
  if (changed) saveEntryMediaBatches(e, key, rec);
  const sorted = [...rec.batches].sort((a, b) => a.order - b.order);
  const allIds = [...new Set(sorted.flatMap((b) => b.itemIds))];
  const practiced = practicedItemIds(e, allIds);
  const batches = sorted.map((b) => ({
    id: b.id,
    order: b.order,
    ...(b.title ? { title: b.title } : {}),
    bytes: b.bytes,
    items: b.itemIds.length,
    practiced: b.itemIds.filter((id) => practiced.has(id)).length,
    downloaded: b.downloaded,
    ...(b.downloadedAt ? { downloadedAt: b.downloadedAt } : {}),
  }));
  const downloaded = batches.filter((b) => b.downloaded);
  const pending = batches.filter((b) => !b.downloaded);
  const downloadedItems = downloaded.reduce((n, b) => n + b.items, 0);
  const practicedItems = downloaded.reduce((n, b) => n + b.practiced, 0);
  const remainingUnpracticed = Math.max(0, downloadedItems - practicedItems);
  const latest = downloaded.at(-1);
  const latestRatio = latest && latest.items > 0 ? latest.practiced / latest.items : 0;
  const next = pending[0] ?? null;
  const thresholdRemaining = Math.min(4, Math.max(1, Math.floor((latest?.items ?? 0) * 0.25)));
  // Prefetch once the learner has practiced >=75% of the latest downloaded batch (or <=25%, max 4 clips remain).
  const shouldPrefetch =
    !!next &&
    (downloaded.length === 0 ||
      (practicedItems > 0 && (remainingUnpracticed <= thresholdRemaining || latestRatio >= 0.75)));
  return {
    entryId: rec.entryId,
    kind: rec.kind,
    decks: rec.decks,
    totalBatches: batches.length,
    downloadedBatches: downloaded.length,
    pendingBatches: pending.length,
    totalItems: batches.reduce((n, b) => n + b.items, 0),
    downloadedItems,
    practicedItems,
    remainingUnpracticed,
    downloadedBytes: downloaded.reduce((n, b) => n + b.bytes, 0),
    totalBytes: batches.reduce((n, b) => n + b.bytes, 0),
    shouldPrefetch,
    ...(rec.lastError ? { lastError: rec.lastError } : {}),
    nextBatch: next ? { id: next.id, order: next.order, ...(next.title ? { title: next.title } : {}), bytes: next.bytes, items: next.items } : null,
    batches,
  };
}

export function mediaBatchStatus(e: Etude, opts: { deck?: string; id?: string } = {}): MediaBatchStatus[] {
  const all = entryMediaBatches(e);
  const out: MediaBatchStatus[] = [];
  for (const [key, rec] of Object.entries(all)) {
    if (opts.id && rec.entryId !== opts.id) continue;
    if (!deckMatchesEntry(opts.deck, rec.decks)) continue;
    out.push(summarizeBatchEntry(e, key, rec));
  }
  return out;
}

export async function downloadMediaBatch(
  e: Etude,
  entryId: string,
  batchId?: string,
  opts: { url?: string; kind?: MarketKind } = {},
): Promise<{ entryId: string; batch: MediaBatchRecord; filesStored: number; status: MediaBatchStatus }> {
  const all = entryMediaBatches(e);
  const key = opts.kind
    ? installKey(opts.kind, entryId)
    : Object.keys(all).find((k) => all[k].entryId === entryId);
  const rec = key ? all[key] : undefined;
  if (!key || !rec) throw new MarketError(`no progressive media batches found for "${entryId}"`, 404);
  const sorted = [...rec.batches].sort((a, b) => a.order - b.order);
  const target = batchId ? sorted.find((b) => b.id === batchId) : sorted.find((b) => !b.downloaded);
  if (!target) throw new MarketError(batchId ? `unknown media batch "${batchId}"` : "all media batches are already downloaded", 404);

  const lockKey = `${e.path}:${key}:${target.id}`;
  const existing = batchLocks.get(lockKey);
  if (existing) return existing;

  const job = (async () => {
    const url = opts.url || rec.url || marketSettings(e).url;
    try {
      const { text, bytes, body } = await readMarketFile(url, target.path);
      if (bytes !== target.bytes) throw new MarketError(`${target.path} is ${bytes} bytes; expected ${target.bytes}`);
      const digest = createHash("sha256").update(body).digest("hex");
      if (digest !== target.sha256) throw new MarketError(`${target.path} sha256 mismatch (got ${digest}, expected ${target.sha256})`);
      const bundle = parseJson(text, target.path) as MarketBatchBundle;
      if (bundle?.etudeBatch !== 1 || !Array.isArray(bundle.files)) throw new MarketError(`${target.path} isn't a valid media batch bundle`);

      let filesStored = 0;
      for (const f of bundle.files) {
        const m = typeof f?.data === "string" ? /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(f.data) : null;
        if (!m) throw new MarketError(`${target.path}: invalid data URL for ${f?.name ?? "?"}`);
        const raw = Buffer.from(m[2], "base64");
        if (f.sha256) {
          const fh = createHash("sha256").update(raw).digest("hex");
          if (fh !== f.sha256) throw new MarketError(`${target.path}: sha256 mismatch for ${f.name}`);
        }
        const stored = e.storeMedia(f.name, raw);
        if (f.url && stored.url !== f.url) {
          throw new MarketError(`${target.path}: stored URL ${stored.url} differs from expected ${f.url}`);
        }
        filesStored++;
      }

      const fresh = entryMediaBatches(e)[key] ?? rec;
      const nowIso = new Date().toISOString();
      const updated: EntryMediaBatches = {
        ...fresh,
        url,
        lastError: undefined,
        lastAttemptAt: nowIso,
        batches: fresh.batches.map((b) => (b.id === target.id ? { ...b, downloaded: true, downloadedAt: nowIso } : b)),
      };
      saveEntryMediaBatches(e, key, updated);
      const savedTarget = updated.batches.find((b) => b.id === target.id)!;
      return { entryId: updated.entryId, batch: savedTarget, filesStored, status: summarizeBatchEntry(e, key, updated) };
    } catch (err) {
      const fresh = entryMediaBatches(e)[key] ?? rec;
      saveEntryMediaBatches(e, key, { ...fresh, lastError: (err as Error).message, lastAttemptAt: new Date().toISOString() });
      throw err;
    } finally {
      batchLocks.delete(lockKey);
    }
  })();

  batchLocks.set(lockKey, job);
  return job;
}

export async function syncMediaBatches(
  e: Etude,
  opts: { deck?: string; id?: string; url?: string; force?: boolean; all?: boolean } = {},
): Promise<{
  downloaded: { entryId: string; batchId: string; order: number; title?: string; items: number; bytes: number }[];
  offline: boolean;
  errors: { entryId: string; error: string }[];
  entries: MediaBatchStatus[];
}> {
  const initial = mediaBatchStatus(e, { deck: opts.deck, id: opts.id });
  const downloaded: { entryId: string; batchId: string; order: number; title?: string; items: number; bytes: number }[] = [];
  const errors: { entryId: string; error: string }[] = [];
  let offline = false;

  for (const st of initial) {
    if (!st.nextBatch) continue;
    if (!opts.all && !opts.force && !st.shouldPrefetch) continue;
    for (;;) {
      const latest = mediaBatchStatus(e, { id: st.entryId })[0];
      if (!latest?.nextBatch) break;
      if (!opts.all && downloaded.some((d) => d.entryId === st.entryId)) break;
      try {
        const res = await downloadMediaBatch(e, st.entryId, latest.nextBatch.id, { url: opts.url, kind: st.kind });
        downloaded.push({
          entryId: st.entryId,
          batchId: res.batch.id,
          order: res.batch.order,
          ...(res.batch.title ? { title: res.batch.title } : {}),
          items: res.batch.itemIds.length,
          bytes: res.batch.bytes,
        });
        if (!opts.all) break;
      } catch (err) {
        const msg = (err as Error).message;
        if (/couldn't reach|fetch failed|network|timeout|ENOTFOUND|ECONNREFUSED|offline/i.test(msg)) offline = true;
        errors.push({ entryId: st.entryId, error: msg });
        break;
      }
    }
  }
  return { downloaded, offline, errors, entries: mediaBatchStatus(e, { deck: opts.deck, id: opts.id }) };
}

// ------------------------------------------------------------------ install

export async function installEntry(e: Etude, id: string, opts: { url?: string; dryRun?: boolean; kind?: MarketKind; fetchInitialBatch?: boolean } = {}) {
  const url = opts.url ?? marketSettings(e).url;
  const index = await fetchIndex(url);
  const matches = index.entries.filter((x) => x.id === id && (!opts.kind || x.kind === opts.kind));
  if (!matches.length) throw new MarketError(`the market has no entry "${id}"`, 404);
  if (matches.length > 1) throw new MarketError(`"${id}" is both a ${matches.map((m) => m.kind).join(" and a ")}; pass the kind`, 409);
  const file = await fetchEntry(url, matches[0]);
  const out = installFile(e, file, { dryRun: opts.dryRun, url });
  if (!opts.dryRun && opts.fetchInitialBatch !== false && Array.isArray(file.content?.mediaBatches) && file.content.mediaBatches.length) {
    const status = mediaBatchStatus(e, { id: file.id })[0];
    const firstBatch = status?.batches[0];
    if (status && firstBatch && !firstBatch.downloaded) {
      const initial = await downloadMediaBatch(e, file.id, firstBatch.id, { url, kind: file.kind });
      out.report = { ...out.report, initialBatch: { id: initial.batch.id, bytes: initial.batch.bytes, files: initial.filesStored, status: initial.status } };
    } else if (status) {
      out.report = { ...out.report, batches: status };
    }
  }
  return out;
}

/** Adds an entry file to the collection. Installing the same entry again updates it in place. */
export function installFile(e: Etude, file: MarketFile, opts: { dryRun?: boolean; url?: string } = {}) {
  const errors = checkEntry(file);
  if (errors.length) throw new MarketError(`invalid market entry: ${errors.join("; ")}`);
  const meta = metaOf(file);
  const prev = installedRec(installedEntries(e), meta.kind, meta.id);
  let result: "created" | "updated" | "unchanged";
  let ids: string[];
  let report: any;

  if (file.kind === "theme") {
    const custom = e.settings().themes;
    const want = String(file.content.id);
    // An update keeps the id it got the first time; a new install takes the published id when it's free.
    let themeId = prev?.kind === "theme" && custom.some((t) => t.id === prev.ids[0]) ? prev.ids[0] : want;
    if (!(prev?.kind === "theme" && themeId === prev.ids[0]) && (BUILTIN_THEMES.some((t) => t.id === themeId) || custom.some((t) => t.id === themeId))) {
      themeId = freeThemeId(want, custom.map((t) => t.id));
    }
    if (!THEME_ID.test(themeId)) themeId = freeThemeId(file.name, custom.map((t) => t.id));
    const old = custom.find((t) => t.id === themeId);
    const next = normalizeTheme({ ...file.content, id: themeId }).theme;
    result = !old ? "created" : JSON.stringify(old) === JSON.stringify(next) ? "unchanged" : "updated";
    if (!opts.dryRun && result !== "unchanged") e.saveTheme(next);
    ids = [themeId];
    report = { theme: themeId };
  } else {
    const pack = file.content;
    const r = e.importPack(pack, { dryRun: opts.dryRun });
    report = r;
    const changed = r.items.created + r.items.updated + r.types.created + r.types.updated + r.assets.created + r.assets.updated + r.assets.removed;
    result = prev ? (changed ? "updated" : "unchanged") : "created";
    ids =
      file.kind === "type"
        ? (pack.types ?? []).map((t: any) => t.id)
        : [...new Set(([...(pack.decks ?? []).map((d: any) => d.name), ...(pack.items ?? []).map((i: any) => i.deck)] as string[]).filter(Boolean).map((n) => n.split("::")[0].trim()))];
  }
  if (!opts.dryRun) {
    recordInstall(e, meta.id, { kind: meta.kind, name: meta.name, version: meta.version, updated: meta.updated, at: new Date().toISOString(), ids });
    const rawBatches = Array.isArray(file.content?.mediaBatches) ? (file.content.mediaBatches as MediaBatchSpec[]) : [];
    const key = installKey(meta.kind, meta.id);
    if (rawBatches.length) {
      const prevRec = entryMediaBatches(e)[key];
      const prevById = new Map((prevRec?.batches ?? []).map((b) => [b.id, b]));
      const batches: MediaBatchRecord[] = [...rawBatches]
        .sort((a, b) => a.order - b.order)
        .map((b) => {
          const old = prevById.get(b.id);
          const allPresent = b.media.length > 0 && b.media.every((m) => batchMediaExists(e, m));
          const downloaded = allPresent || (!!old?.downloaded && old.sha256 === b.sha256);
          return {
            ...b,
            downloaded,
            ...(downloaded ? { downloadedAt: old?.downloadedAt ?? new Date().toISOString() } : {}),
          };
        });
      saveEntryMediaBatches(e, key, {
        entryId: meta.id,
        kind: meta.kind,
        url: opts.url || prevRec?.url || marketSettings(e).url,
        decks: ids,
        batches,
      });
    } else {
      saveEntryMediaBatches(e, key, null);
    }
  }
  return { entry: meta, result, ids, dryRun: !!opts.dryRun, report };
}

// ------------------------------------------------------------------ publish

export interface SubmissionInput {
  kind: MarketKind;
  /** Theme id, deck name, or type id in this collection. */
  ref: string;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  tags?: string[];
  version?: string;
  /** Card types: how many of your items of the type ride along as examples (default 3). */
  examples?: number;
}

const stripType = (def: any) => {
  const { updated: _u, builtin: _b, ...rest } = def;
  return rest;
};

/**
 * A pack exported from a collection names its media as `/media/<file>`, which means nothing on
 * another machine. Publishing inlines those files as data URLs so an installed copy keeps them;
 * `importPack` unpacks data URLs back into the media folder.
 */
function inlineMedia(e: Etude, pack: any) {
  const root = resolve(e.mediaDir);
  for (const it of pack.items ?? []) {
    for (const [k, v] of Object.entries(it.fields ?? {})) {
      if (typeof v !== "string" || !v.includes("/media/")) continue;
      // Also rewrite embeds inside Markdown/HTML, not just fields that are only a media path.
      it.fields[k] = v.replace(/(?<![\w/])\/media\/[\w./-]+/g, (ref) => {
        const full = resolve(root, ref.slice("/media/".length));
        if (!full.startsWith(root + sep) || !existsSync(full)) return ref;
        const type = mediaType(full);
        if (!type) return ref;
        return `data:${type.mime};base64,${readFileSync(full).toString("base64")}`;
      });
    }
  }
  return pack;
}

/** Builds the entry file for something in this collection. */
export function buildSubmission(e: Etude, input: SubmissionInput): MarketFile {
  const { kind, ref } = input;
  if (!MARKET_KINDS.includes(kind)) throw new MarketError(`kind must be one of ${MARKET_KINDS.join(", ")}`);
  if (!ref?.trim()) throw new MarketError(`say which ${kind} to publish`);
  let content: any;
  let name = input.name?.trim();
  let description = input.description?.trim() ?? "";

  if (kind === "theme") {
    const t = e.theme(ref);
    if (t.builtin) throw new MarketError(`"${t.name}" ships with Wikae already; publish a copy you made from it`);
    const { builtin: _b, ...plain } = t;
    content = plain;
    name ||= t.name;
  } else if (kind === "deck") {
    const d = e.deck(ref);
    content = inlineMedia(e, e.exportPack({ deck: d.name, name: name || d.name }));
    if (!content.items.length) throw new MarketError(`deck "${d.name}" has no active items to share`);
    delete content.exported;
    name ||= d.name.split("::").pop()!;
    description ||= d.description ?? "";
  } else {
    const def = e.typeWithAssets(ref) as CardTypeDef & { builtin?: boolean };
    def.builtin = e.type(ref).builtin;
    const shipped = e.listTypes().find((t) => t.id === ref);
    if (def.builtin && !shipped?.edited) throw new MarketError(`"${def.name}" ships with Wikae already; publish your own type`);
    const n = Math.max(0, Math.min(20, input.examples ?? 3));
    const sample = n ? inlineMedia(e, e.exportPack({ query: `type:${ref}` })) : { items: [], decks: [], presets: [] };
    const items = sample.items.slice(0, n);
    const used = new Set(items.flatMap((i: any) => i.deck.split("::").map((_: string, k: number, a: string[]) => a.slice(0, k + 1).join("::"))));
    content = {
      etude: "pack/1",
      name: name || def.name,
      types: [stripType(def)],
      decks: (sample.decks ?? []).filter((d: any) => used.has(d.name)).map((d: any) => ({ name: d.name, description: d.description })),
      items,
    };
    name ||= def.name;
    description ||= def.description ?? "";
  }
  const file: MarketFile = {
    etudeMarket: 1,
    kind,
    id: input.id?.trim() || slugify(name!) || slugify(ref),
    name: name!,
    description,
    author: input.author?.trim() || "anonymous",
    tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12),
    version: input.version?.trim() || "1",
    updated: new Date().toISOString().slice(0, 10),
    content,
  };
  const errors = checkEntry(file);
  if (errors.length) throw new MarketError(`can't publish this: ${errors.join("; ")}`);
  const bytes = Buffer.byteLength(JSON.stringify(file));
  if (bytes > MAX_ENTRY_BYTES) throw new MarketError(`this ${kind} is ${(bytes / 1e6).toFixed(1)} MB; the market takes up to ${MAX_ENTRY_BYTES / 1024 / 1024} MiB per entry`);
  return file;
}

/** Pretty JSON for entry files: readable diffs in pull requests. */
export const entryJson = (file: MarketFile) => JSON.stringify(file, null, 2) + "\n";

/** A GitHub page where someone without `gh` can add the file by hand (GitHub forks for them). */
export function manualPublishUrl(repo: string, file: MarketFile): string {
  const path = entryPath(file.kind, file.id);
  const text = entryJson(file);
  if (text.length <= 6000) return `https://github.com/${repo}/new/main?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(text)}`;
  return `https://github.com/${repo}/upload/main/entries/${file.kind}s`;
}

type Gh = (args: string[], input?: unknown) => any;

function ghRunner(bin = appEnv(process.env, "GH") || "gh"): Gh {
  return (args, input) => {
    let out: string;
    try {
      out = execFileSync(bin, args, { input: input === undefined ? undefined : JSON.stringify(input), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
    } catch (err: any) {
      if (err?.code === "ENOENT") throw new MarketError("the GitHub CLI (gh) isn't installed", 424);
      const msg = String(err?.stderr || err?.message || err).trim().split("\n").filter((l: string) => !/^mise /.test(l)).join(" ");
      throw Object.assign(new MarketError(`gh ${args.slice(0, 2).join(" ")}: ${msg}`, 502), { stderr: msg });
    }
    // Version-manager shims (mise, asdf) can print a line of their own before gh's output.
    let t = out.trim();
    const start = t.search(/^[[{]/m);
    if (start > 0) t = t.slice(start);
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  };
}

/** Whether publishing through `gh` works here, and as whom. */
export function ghStatus(gh: Gh = ghRunner()): { ok: boolean; login?: string; reason?: string } {
  try {
    const user = gh(["api", "user"]);
    return user?.login ? { ok: true, login: user.login } : { ok: false, reason: "gh isn't signed in" };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, reason: /not installed/.test(m) ? m : /auth|login|401/i.test(m) ? "gh isn't signed in (run `gh auth login`)" : m };
  }
}

/**
 * Opens a pull request adding (or updating) the entry file. Uses the signed-in `gh`: forks the
 * market repository when you can't push to it, commits the file on a new branch, opens the PR.
 */
export async function publishFile(file: MarketFile, opts: { repo?: string; gh?: Gh } = {}) {
  const repo = opts.repo ?? MARKET_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new MarketError("market repo must be owner/name", 400);
  const gh = opts.gh ?? ghRunner();
  const status = ghStatus(gh);
  if (!status.ok) throw new MarketError(status.reason ?? "gh isn't available", 424);
  const login = status.login!;
  const [owner, name] = repo.split("/");
  const upstream = gh(["api", `repos/${repo}`]);
  const base = upstream?.default_branch ?? "main";
  const canPush = !!upstream?.permissions?.push;
  let target = repo;
  if (!canPush) {
    gh(["api", "-X", "POST", `repos/${repo}/forks`, "--input", "-"], { default_branch_only: true });
    target = `${login}/${name}`;
    // A fresh fork takes a moment to exist; an old one may be behind.
    for (let i = 0; i < 10; i++) {
      try {
        gh(["api", "-X", "POST", `repos/${target}/merge-upstream`, "--input", "-"], { branch: base });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  const head = gh(["api", `repos/${repo}/git/ref/heads/${base}`]);
  const branch = `${file.kind}-${file.id}-${Date.now().toString(36)}`;
  gh(["api", "-X", "POST", `repos/${target}/git/refs`, "--input", "-"], { ref: `refs/heads/${branch}`, sha: head.object.sha });
  const path = entryPath(file.kind, file.id);
  let sha: string | undefined;
  try {
    sha = gh(["api", `repos/${target}/contents/${path}?ref=${branch}`])?.sha;
  } catch {
    sha = undefined;
  }
  const verb = sha ? "Update" : "Add";
  const label = file.kind === "type" ? "card type" : file.kind;
  gh(["api", "-X", "PUT", `repos/${target}/contents/${path}`, "--input", "-"], {
    message: `${verb} ${label}: ${file.name}`,
    content: Buffer.from(entryJson(file)).toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  });
  const body = [
    `${verb}s the ${label} **${file.name}** by ${file.author}.`,
    "",
    file.description || "",
    "",
    `Published from Wikae with \`wikae market publish\`. The check on this pull request validates the file; the index updates itself after merge.`,
  ].join("\n");
  const pr = gh(["api", "-X", "POST", `repos/${repo}/pulls`, "--input", "-"], {
    title: `${verb} ${label}: ${file.name}`,
    head: canPush ? branch : `${login}:${branch}`,
    base,
    body,
    maintainer_can_modify: true,
  });
  return { url: pr.html_url as string, number: pr.number as number, branch, repo, fork: canPush ? null : target, path, updated: !!sha, login, owner };
}

// ------------------------------------------------------------------ index (for the market repository)

/** Validates every entry file under `dir/entries` and builds the index. `install` dry-runs each into a scratch collection. */
export async function buildIndex(dir: string, opts: { repo?: string; dryRunInto?: () => Promise<Etude> } = {}) {
  const root = resolve(dir);
  const entries: IndexEntry[] = [];
  const problems: { path: string; errors: string[] }[] = [];
  const seen = new Map<string, string>();
  for (const kind of MARKET_KINDS) {
    const sub = join(root, "entries", `${kind}s`);
    if (!existsSync(sub)) continue;
    for (const f of readdirSync(sub).filter((f) => f.endsWith(".json")).sort()) {
      const path = `entries/${kind}s/${f}`;
      const full = join(sub, f);
      const errors: string[] = [];
      let file: any;
      let body: Buffer;
      try {
        body = readFileSync(full);
        file = JSON.parse(body.toString("utf8"));
      } catch (e) {
        problems.push({ path, errors: [`not valid JSON: ${(e as Error).message}`] });
        continue;
      }
      errors.push(...checkEntry(file));
      if (!errors.length) {
        if (file.kind !== kind) errors.push(`kind is "${file.kind}" but the file is in entries/${kind}s`);
        if (`${file.id}.json` !== f) errors.push(`the file must be named ${file.id}.json`);
        const key = `${file.kind}:${file.id}`;
        if (seen.has(file.id)) errors.push(`id "${file.id}" is already used by ${seen.get(file.id)}`);
        seen.set(file.id, path);
        void key;
      }
      const bytes = body.length;
      const sha256 = createHash("sha256").update(body).digest("hex");
      if (bytes > MAX_ENTRY_BYTES) errors.push(`file is larger than ${MAX_ENTRY_BYTES} bytes`);
      if (!errors.length && opts.dryRunInto && (file.kind === "deck" || file.kind === "type")) {
        const scratch = await opts.dryRunInto();
        try {
          scratch.importPack(file.content, { dryRun: true });
        } catch (e) {
          errors.push(`import: ${(e as Error).message}`);
        } finally {
          scratch.close();
        }
      }
      if (errors.length) {
        problems.push({ path, errors });
        continue;
      }
      const ext = COVER_EXT.find((x) => existsSync(join(root, "covers", `${kind}s`, `${file.id}.${x}`)));
      const cover = ext ? `covers/${kind}s/${file.id}.${ext}` : undefined;
      if (cover && statSync(join(root, cover)).size > MAX_COVER_BYTES) {
        problems.push({ path: cover, errors: [`cover is larger than ${MAX_COVER_BYTES / 1024} KB`] });
        continue;
      }
      const mediaDir = join(root, "media", `${kind}s`, file.id);
      const media = existsSync(mediaDir) ? readdirSync(mediaDir).sort().map((f) => `media/${kind}s/${file.id}/${f}`) : [];
      const invalidMedia = media.filter((p) => !MARKET_MEDIA_PATH.test(p) || statSync(join(root, p)).size > MAX_MEDIA_BYTES);
      if (media.length > 12 || invalidMedia.length) {
        problems.push({ path: `media/${kind}s/${file.id}`, errors: ["Use at most 12 images/videos, lowercase slug filenames, at most 12 MB each."] });
        continue;
      }
      entries.push({ ...metaOf(file), path, bytes, sha256, ...(cover ? { cover } : {}), ...(media.length ? { media } : {}), summary: summarize(file) });
    }
  }
  entries.sort((a, b) => (b.updated || "").localeCompare(a.updated || "") || a.name.localeCompare(b.name));
  const index: MarketIndex = { etude: "market/1", generated: new Date().toISOString(), repo: opts.repo ?? MARKET_REPO, entries };
  return { index, problems };
}
