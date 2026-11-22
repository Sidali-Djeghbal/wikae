import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import en from "../web/src/locales/en.ts";
import ar from "../web/src/locales/ar.ts";

// `{name}` is interpolated by t(); `{{answer}}` is literal card syntax, so it is not a placeholder.
const placeholders = (s: string) => [...s.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map((m) => m[1]).sort();

test("locale sources have no control characters or duplicate keys", () => {
  for (const name of ["en", "ar"]) {
    const src = readFileSync(new URL(`../web/src/locales/${name}.ts`, import.meta.url), "utf8");
    assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(src), false, `${name}.ts has a control character`);
    const keys = [...src.matchAll(/^  "([^"]+)":/gm)].map((m) => m[1]);
    const dupes = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
    assert.deepEqual(dupes, [], `${name}.ts has duplicate keys: ${dupes.slice(0, 3).join(", ")}`);
  }
});

test("every English key has an Arabic translation", () => {
  const missing = Object.keys(en).filter((k) => !(k in ar));
  assert.deepEqual(missing, [], `missing from ar.ts: ${missing.join(", ")}`);
});

test("no Arabic translation is empty", () => {
  const blank = Object.entries(ar).filter(([, v]) => !v.trim()).map(([k]) => k);
  assert.deepEqual(blank, [], `empty in ar.ts: ${blank.join(", ")}`);
});

test("Arabic keeps the same interpolation placeholders as English", () => {
  const mismatched = Object.keys(en)
    .filter((k) => k in ar)
    .filter((k) => JSON.stringify(placeholders(en[k])) !== JSON.stringify(placeholders(ar[k])))
    .map((k) => k);
  assert.deepEqual(mismatched, [], `placeholder mismatch: ${mismatched.join(", ")}`);
});
