import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeArabic, stripTashkeel, areArabicTokensEqual } from "../src/core/arabicNormalizer.ts";
import {
  generateCardsFromMutashabihatCluster,
  generateEtudeItemsFromCluster,
  validateMutashabihatCard,
  validateVerseNode,
  toArabicDigits,
  VERIFIED_SEED_CLUSTERS,
} from "../src/core/mutashabihat.ts";
import { Etude } from "../src/core/engine.ts";

test("arabicNormalizer: diacritic stripping, tatweel and alef normalization", () => {
  // 1. Basic diacritics stripping
  assert.equal(normalizeArabic("بَلَدًا"), "بلدا");
  assert.equal(stripTashkeel("بَلَدًا"), "بلدا");

  // 2. Alef variants normalization [أإآٱٲٳ] -> ا
  assert.equal(normalizeArabic("إِبْرَٰهِيمُ"), "ابراهيم");
  assert.equal(normalizeArabic("ٱلْبَلَدَ"), "البلد");
  assert.equal(normalizeArabic("آَمِنًا"), "امنا");
  assert.equal(normalizeArabic("أَوْلَـٰدَكُمْ"), "اولادكم");

  // 3. Isolated Hamza + Alef: ءا -> ا
  assert.equal(normalizeArabic("ءَامِنًا"), "امنا");

  // 4. Dagger Alef (\u0670) to standard Alef conversion
  assert.equal(normalizeArabic("إِمْلَـٰقٍ"), "املاق");
  assert.equal(normalizeArabic("هَـٰذَا"), "هاذا");

  // 5. Alef Maksura to Ya (ى -> ي) and Teh Marbuta to Ha (ة -> ه)
  assert.equal(normalizeArabic("خَشْيَةَ"), "خشيه");
  assert.equal(normalizeArabic("بَنِىَّ"), "بني");

  // 6. Tatweel stripping
  assert.equal(normalizeArabic("مِّنْ إِمْلَــــٰقٍ"), "من املاق");

  // 7. Quranic Waqf & Sajda marks stripping (e.g. ۖ ۗ ۚ ۛ ۜ)
  assert.equal(normalizeArabic("مِّنْ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُكُمْ"), "من املاق نحن نرزقكم");
  // 8. End-of-Ayah and Arabic letter mark stripping
  assert.equal(normalizeArabic("بَلَدًا ءَامِنًا ۝١\u061C"), "بلدا امنا ١");
});

test("arabicNormalizer: equality matching for canonical Mutashabihat clusters", () => {
  // Cluster 1: Baqarah 126 vs Ibrahim 35
  const b126Uthmani = "بَلَدًا ءَامِنًا";
  const b126Typed1 = "بلدا آمنا";
  const b126Typed2 = "بلدا امنا";
  assert.ok(areArabicTokensEqual(b126Typed1, b126Uthmani));
  assert.ok(areArabicTokensEqual(b126Typed2, b126Uthmani));

  const i35Uthmani = "ٱلْبَلَدَ ءَامِنًا";
  const i35Typed1 = "البلد آمنا";
  const i35Typed2 = "البلد امنا";
  assert.ok(areArabicTokensEqual(i35Typed1, i35Uthmani));
  assert.ok(areArabicTokensEqual(i35Typed2, i35Uthmani));

  // Distinguishing between the two
  assert.equal(areArabicTokensEqual(b126Typed1, i35Uthmani), false);

  // Cluster 2: An'am 151 vs Isra 31
  const anamUthmani = "مِّنْ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُكُمْ وَإِيَّاهُمْ";
  const anamUser1 = "من إملاق نحن نرزقكم وإياهم";
  const anamUser2 = "من املاق نحن نرزقكم واياهم";
  assert.ok(areArabicTokensEqual(anamUser1, anamUthmani));
  assert.ok(areArabicTokensEqual(anamUser2, anamUthmani));

  const israUthmani = "خَشْيَةَ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُهُمْ وَإِيَّاهُمْ";
  const israUser1 = "خشية إملاق نحن نرزقهم وإياهم";
  const israUser2 = "خشيه املاق نحن نرزقهم واياهم";
  assert.ok(areArabicTokensEqual(israUser1, israUthmani));
  assert.ok(areArabicTokensEqual(israUser2, israUthmani));

  // Distinguishing between the two
  assert.equal(areArabicTokensEqual(anamUser1, israUthmani), false);
});

test("generateCardsFromMutashabihatCluster: generates atomic bidirectional FSRS cards", () => {
  const cluster = VERIFIED_SEED_CLUSTERS[0]; // Baqarah 126 vs Ibrahim 35 (2 siblings)
  const cards = generateCardsFromMutashabihatCluster(cluster);

  // 2 siblings * 2 modes = 4 atomic cards
  assert.equal(cards.length, 4);

  const completionCards = cards.filter((c) => c.mode === "pivotal_completion");
  const surahCards = cards.filter((c) => c.mode === "surah_identification");

  assert.equal(completionCards.length, 2);
  assert.equal(surahCards.length, 2);

  // Verify targetVerseIds
  assert.equal(completionCards[0].targetVerseId, "baqarah_126");
  assert.equal(completionCards[1].targetVerseId, "ibrahim_35");
  assert.equal(surahCards[0].targetVerseId, "baqarah_126");
  assert.equal(surahCards[1].targetVerseId, "ibrahim_35");

  // Every generated card is valid against schema
  for (const c of cards) {
    assert.deepEqual(validateMutashabihatCard(c), []);
  }

  // Check Etude items generator
  const items = generateEtudeItemsFromCluster(cluster, "Test Deck");
  assert.equal(items.length, 4);
  assert.equal(items[0].type, "quran-mutashabihat");
  assert.equal(items[0].deck, "Test Deck");
  assert.equal(items[0].fields.mode, "pivotal_completion");
});

test("schema validation: catches invalid nodes and cards", () => {
  assert.ok(validateVerseNode({}).length > 0);
  assert.ok(validateVerseNode({ id: "x", surahNumber: 200 }).length > 0);
  assert.deepEqual(validateMutashabihatCard(VERIFIED_SEED_CLUSTERS[0]), []);

  const invalidCard = {
    id: "test",
    type: "invalid_type",
    mode: "invalid_mode",
    siblings: [],
  };
  assert.ok(validateMutashabihatCard(invalidCard).length > 0);

  const missingTarget = { ...VERIFIED_SEED_CLUSTERS[0], targetVerseId: "missing" };
  assert.ok(validateMutashabihatCard(missingTarget).some((e) => /targetVerseId/.test(e)));

  const missingText = structuredClone(VERIFIED_SEED_CLUSTERS[0]) as any;
  delete missingText.siblings[0].textUthmani;
  assert.ok(validateMutashabihatCard(missingText).some((e) => /textUthmani/.test(e)));
});

test("generated items carry an Arabic title with Arabic-Indic digits", () => {
  assert.equal(toArabicDigits(126), "١٢٦");
  const items = generateEtudeItemsFromCluster(VERIFIED_SEED_CLUSTERS[0], "Deck");
  const completion = items.find((i) => i.fields.mode === "pivotal_completion")!;
  const surah = items.find((i) => i.fields.mode === "surah_identification")!;
  assert.match(completion.fields.titleAr, /سورة البقرة · آية ١٢٦ · إكمال/);
  assert.match(surah.fields.titleAr, /تحديد السورة · بَلَدًا ءَامِنًا/);
  assert.doesNotMatch(surah.fields.titleAr, /البقرة/, "the Surah-mode title must not reveal the answer");
  assert.doesNotMatch(surah.fields.titleAr, /١٢٦/, "the Surah-mode title must not reveal the ayah");
});

test("pack: Surah-identification items do not reveal the answer in titles or tags", async () => {
  const pack = JSON.parse(await readFile(new URL("../examples/quran-mutashabihat.pack.json", import.meta.url), "utf8"));
  const surahItems = pack.items.filter((item: any) => item.fields.mode === "surah_identification");
  assert.ok(surahItems.length > 0);
  for (const item of surahItems) {
    for (const sibling of item.fields.siblings) {
      const name = sibling.surahNameAr;
      assert.doesNotMatch(item.fields.titleAr, new RegExp(name));
      assert.equal(item.tags.includes(name), false);
    }
  }
});

test("prepare: the view never reveals the active mode's answer", async () => {
  const e = await Etude.open(":memory:");
  for (const it of generateEtudeItemsFromCluster(VERIFIED_SEED_CLUSTERS[0], "Deck")) e.upsertItem(it);

  for (const mode of ["pivotal_completion", "surah_identification"] as const) {
    const item = generateEtudeItemsFromCluster(VERIFIED_SEED_CLUSTERS[0], "Deck").find((i) => i.fields.mode === mode)!;
    const prep = e.prepare(item.id, "main", 7);
    const view = prep.view as Record<string, unknown>;

    assert.equal(view.mode, mode);
    assert.equal("targetVerseId" in view, false, `${mode}: targetVerseId leaked into the view`);
    assert.equal("siblings" in view, false, `${mode}: siblings leaked into the view`);
    assert.equal("mnemonicRuleAr" in view, false, `${mode}: the mnemonic leaked into the view`);

    if (mode === "pivotal_completion") {
      assert.equal("pivotalUthmani" in view, false, "the pivotal phrase leaked into the view");
      assert.equal("fullTextUthmani" in view, false, "the full verse leaked into the view");
      assert.equal("surahOptions" in view, false);
      const options = view.pivotalOptions as { id: string; textUthmani: string; isTarget?: boolean }[];
      assert.ok(options.length >= 2 && options.length <= 4);
      assert.equal(options.some((o) => "isTarget" in o), false, "options must not mark the target");
      assert.deepEqual(options.map((o) => o.id).sort(), options.map((_, i) => `p${i}`).sort());
    } else {
      assert.equal("targetSurahNameAr" in view, false, "the target Surah leaked into the view");
      assert.equal("targetSurahNumber" in view, false);
      assert.equal("targetAyahNumber" in view, false);
      assert.equal("pivotalOptions" in view, false);
      const options = view.surahOptions as { id: string; labelAr: string }[];
      assert.ok(options.length >= 2 && options.length <= 4);
      assert.ok(options.some((o) => o.labelAr.includes("١٢٦")), "Surah labels should use Arabic-Indic digits");
    }
  }
  e.close();
});

test("prepare: rejects a target that is not in the cluster", async () => {
  const e = await Etude.open(":memory:");
  e.upsertItem({
    id: "bad.cluster",
    type: "quran-mutashabihat",
    deck: "Deck",
    fields: {
      mode: "pivotal_completion",
      targetVerseId: "missing",
      siblings: VERIFIED_SEED_CLUSTERS[0].siblings,
    },
  });
  assert.throws(() => e.prepare("bad.cluster", "main", 1), /targetVerseId/);
  e.close();
});

test("engine integration: both modes grade the card's opaque options", async () => {
  const e = await Etude.open(":memory:");
  const items = generateEtudeItemsFromCluster(VERIFIED_SEED_CLUSTERS[0], "Deck");
  for (const it of items) e.upsertItem(it);

  const pivotalItem = items.find((i) => i.fields.mode === "pivotal_completion")!;
  const pivotalPrep = e.prepare(pivotalItem.id, "main", 11);
  const pivotalCard = e.db.get<{ id: number }>("SELECT id FROM cards WHERE item_id = ?", pivotalItem.id)!.id;
  const pivotalCorrect = pivotalPrep.key.correctOptionId as string;
  assert.match(pivotalCorrect, /^p\d+$/);

  const right = await e.grade(pivotalCard, 11, {
    mode: "pivotal_completion",
    submode: "choice",
    chosenOptionId: pivotalCorrect,
    timeMs: 3000,
    usedHint: false,
  });
  assert.equal(right.grade.score, 1.0);
  assert.equal((right.grade.details as { isCorrect?: boolean }).isCorrect, true);

  const wrongId = (pivotalPrep.view.pivotalOptions as { id: string }[]).find((o) => o.id !== pivotalCorrect)!.id;
  const wrong = await e.grade(pivotalCard, 11, {
    mode: "pivotal_completion",
    submode: "choice",
    chosenOptionId: wrongId,
    timeMs: 3000,
    usedHint: false,
  });
  assert.equal(wrong.grade.score, 0.0);

  const surahItem = items.find((i) => i.fields.mode === "surah_identification")!;
  const surahPrep = e.prepare(surahItem.id, "main", 11);
  const surahCard = e.db.get<{ id: number }>("SELECT id FROM cards WHERE item_id = ?", surahItem.id)!.id;
  const surahCorrect = surahPrep.key.correctOptionId as string;
  assert.match(surahCorrect, /^s\d+$/);

  const surahRight = await e.grade(surahCard, 11, {
    mode: "surah_identification",
    submode: "choice",
    chosenOptionId: surahCorrect,
    timeMs: 3000,
    usedHint: false,
  });
  assert.equal(surahRight.grade.score, 1.0);

  const surahWrongId = (surahPrep.view.surahOptions as { id: string }[]).find((o) => o.id !== surahCorrect)!.id;
  const surahWrong = await e.grade(surahCard, 11, {
    mode: "surah_identification",
    submode: "choice",
    chosenOptionId: surahWrongId,
    timeMs: 3000,
    usedHint: false,
  });
  assert.equal(surahWrong.grade.score, 0.0);
  e.close();
});

test("canonical seed dataset: verifies Cluster 1 and Cluster 2 integrity", () => {
  assert.equal(VERIFIED_SEED_CLUSTERS.length, 2);

  for (const cluster of VERIFIED_SEED_CLUSTERS) {
    assert.deepEqual(validateMutashabihatCard(cluster), []);
    assert.ok(cluster.siblings.length >= 2);
    assert.ok(cluster.mnemonicRuleAr && cluster.mnemonicRuleAr.length > 10);
    assert.ok(cluster.hintAr && cluster.hintAr.length > 5);

    // Verify all siblings have valid Uthmani text and pivotal segments
    for (const s of cluster.siblings) {
      assert.ok(s.textUthmani.includes(s.pivotalUthmani));
      assert.ok(s.surahNumber >= 1 && s.surahNumber <= 114);
      assert.ok(s.ayahNumber >= 1);
    }
  }
});

test("engine integration: quran-mutashabihat card type grades correctly in Etude", async () => {
  const e = await Etude.open(":memory:");
  const def = e.type("quran-mutashabihat");
  assert.ok(def, "quran-mutashabihat built-in type must be registered");
  assert.equal(def.grader.kind, "script");

  // Insert seed items into engine
  const cluster = VERIFIED_SEED_CLUSTERS[0];
  const items = generateEtudeItemsFromCluster(cluster, "Quran Deck");
  for (const it of items) {
    e.upsertItem(it);
  }

  // Check that cards were scheduled
  const cardList = e.db.all<{ id: number; item_id: string }>("SELECT c.id, c.item_id FROM cards c JOIN items i ON c.item_id = i.id WHERE i.type = 'quran-mutashabihat'");
  assert.equal(cardList.length, 4);

  // Grade choice mode correct answer
  const c1 = cardList.find((c) => c.item_id.includes("baqarah.126.completion"))!;
  const seed = 42;
  const gradeChoice = await e.grade(c1.id, seed, {
    mode: "pivotal_completion",
    submode: "choice",
    chosenOptionId: "baqarah_126",
    timeMs: 4000,
    usedHint: false,
  });
  assert.equal(gradeChoice.grade.score, 1.0);
  assert.equal(gradeChoice.grade.verdict, "correct");

  // Grade typing mode correct answer with standard Arabic keyboard input
  const gradeTyping = await e.grade(c1.id, seed, {
    mode: "pivotal_completion",
    submode: "typing",
    typedText: "بلدا آمنا",
    timeMs: 5000,
    usedHint: false,
  });
  assert.equal(gradeTyping.grade.score, 1.0);
  assert.equal(gradeTyping.grade.verdict, "correct");

  // Grade correct answer with slow response (> 8s) or hint -> suggests Hard (score 0.6)
  const gradeSlow = await e.grade(c1.id, seed, {
    mode: "pivotal_completion",
    submode: "choice",
    chosenOptionId: "baqarah_126",
    timeMs: 9500,
    usedHint: true,
  });
  assert.equal(gradeSlow.grade.score, 0.6);

  // Grade incorrect answer -> suggests Again (score 0.0)
  const gradeWrong = await e.grade(c1.id, seed, {
    mode: "pivotal_completion",
    submode: "choice",
    chosenOptionId: "ibrahim_35",
    timeMs: 3000,
    usedHint: false,
  });
  assert.equal(gradeWrong.grade.score, 0.0);
  assert.equal(gradeWrong.grade.verdict, "incorrect");

  e.close();
});
