import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../web/src/locales/en.ts";
import ar from "../web/src/locales/ar.ts";

// `{name}` is interpolated by t(); `{{answer}}` is literal card syntax, so it is not a placeholder.
const placeholders = (s: string) => [...s.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map((m) => m[1]).sort();

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
