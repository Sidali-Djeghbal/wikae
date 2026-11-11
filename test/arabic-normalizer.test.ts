import { test } from "node:test";
import assert from "node:assert/strict";
import { initSandbox, runScript } from "../src/core/sandbox.ts";
import { normalizeArabic } from "../src/core/arabicNormalizer.ts";

// Uthmani samples covering dagger alef, tatweel, tashkeel, alef variants, hamza+alef,
// alef maksura, teh marbuta, Quranic waqf marks and zero-width characters.
const SAMPLES = [
  "بَلَدًا",
  "إِبْرَٰهِيمُ",
  "ٱلْبَلَدَ",
  "آَمِنًا",
  "أَوْلَـٰدَكُمْ",
  "ءَامِنًا",
  "إِمْلَـٰقٍ",
  "هَـٰذَا",
  "خَشْيَةَ",
  "بَنِىَّ",
  "مِّنْ إِمْلَــــٰقٍ",
  "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
  "وَمَآ أَدْرَىٰكَ مَا ٱلْقَارِعَةُ",
  "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
];

const inSandbox = (body: string, args: Record<string, unknown>) =>
  runScript<string>(body, { params: Object.keys(args), args, where: "test/arabic-normalizer" });

test("prelude std.normalizeArabic matches the TypeScript normalizer", async () => {
  await initSandbox();
  for (const text of SAMPLES) {
    const sandboxed = inSandbox("return std.normalizeArabic(text);", { text });
    const expected = normalizeArabic(text, { stripPunctuation: false, normalizeWhitespace: false });
    assert.equal(sandboxed, expected, text);
  }
});

test("prelude std.normalize lowercases, collapses whitespace and drops trailing punctuation", async () => {
  await initSandbox();
  assert.equal(inSandbox("return std.normalize(text);", { text: "  بَلَدًا،  " }), "بلدا");
  assert.equal(inSandbox("return std.normalize(text);", { text: "بَلَدًا!!" }), "بلدا");
  assert.equal(inSandbox("return std.normalize(text);", { text: "A  B" }), "a b");
});
