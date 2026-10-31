const siblings = Array.isArray(fields.siblings) ? fields.siblings : [];
const target = siblings.find((s) => s.id === fields.targetVerseId);
if (!target) throw new Error(`targetVerseId "${fields.targetVerseId}" is not one of the siblings`);
if (siblings.length < 2) throw new Error("a Mutashabihat cluster needs at least two sibling verses");
for (const s of siblings) {
  if (!s || !s.id || !s.surahNumber || !s.surahNameAr || !s.ayahNumber) {
    throw new Error("each sibling needs id, surahNumber, surahNameAr and ayahNumber");
  }
}
if (!target.pivotalUthmani) throw new Error("the target sibling is missing pivotalUthmani");
const mode = fields.mode === "surah_identification" ? "surah_identification" : "pivotal_completion";
const inputSubmode = fields.inputSubmode === "typing" ? "typing" : "choice";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function arabicDigits(value) {
  return String(value == null ? "" : value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

function fullText(s) {
  if (s.textUthmani) return s.textUthmani;
  return [s.prefixUthmani, s.pivotalUthmani, s.suffixUthmani].filter(Boolean).join(" ");
}

function surahLabel(s) {
  return "سورة " + (s.surahNameAr || "") + " (" + arabicDigits(s.ayahNumber) + ")";
}

// Pivotal options: the target plus up to three distinct distractors. The target is always present.
const targetPivotal = target.pivotalUthmani || "";
const seenPivotal = new Set([targetPivotal]);
const distractorPivots = [];
for (const s of siblings) {
  if (s.id === target.id || !s.pivotalUthmani || seenPivotal.has(s.pivotalUthmani)) continue;
  seenPivotal.add(s.pivotalUthmani);
  distractorPivots.push({ textUthmani: s.pivotalUthmani, isTarget: false });
}
if (Array.isArray(fields.extraDistractorsUthmani)) {
  for (const d of fields.extraDistractorsUthmani) {
    if (d && !seenPivotal.has(d)) {
      seenPivotal.add(d);
      distractorPivots.push({ textUthmani: d, isTarget: false });
    }
  }
}
const pivotalRaw = rng.shuffle([
  { textUthmani: targetPivotal, isTarget: true },
  ...rng.shuffle(distractorPivots).slice(0, 3),
]);
// Opaque option ids keep the answer out of the DOM and the view payload.
const pivotalOptions = pivotalRaw.map((o, i) => ({ id: "p" + i, textUthmani: o.textUthmani }));
const correctPivotalOptionId = "p" + pivotalRaw.findIndex((o) => o.isTarget);
if (mode === "pivotal_completion" && pivotalOptions.length < 2) {
  throw new Error("pivotal_completion needs at least two distinct pivotal phrases");
}

// Surah options: the target plus up to three other distinct Surahs, shuffled and capped at four.
const seenSurahs = new Set([target.surahNumber]);
const otherSurahs = [];
for (const s of siblings) {
  if (s.id === target.id || !s.surahNameAr || seenSurahs.has(s.surahNumber)) continue;
  seenSurahs.add(s.surahNumber);
  otherSurahs.push(s);
}
if (mode === "surah_identification" && otherSurahs.length === 0) {
  throw new Error("surah_identification needs siblings from at least two different Surahs");
}
const surahRaw = rng.shuffle([target, ...rng.shuffle(otherSurahs).slice(0, 3)]);
const surahOptions = surahRaw.map((s, i) => ({
  id: "s" + i,
  surahNumber: s.surahNumber,
  surahNameAr: s.surahNameAr,
  ayahNumber: s.ayahNumber,
  labelAr: surahLabel(s),
}));
const correctSurahOptionId = "s" + surahRaw.findIndex((s) => s.id === target.id);

const view = {
  mode,
  inputSubmode,
  hintAr: fields.hintAr || "",
  prefixUthmani: target.prefixUthmani || "",
  suffixUthmani: target.suffixUthmani || "",
};

// Each card renders only the mode it was generated for, so the view never carries the other
// mode's answer material (the target Surah name or the unmasked pivotal phrase).
if (mode === "surah_identification") {
  view.pivotalUthmani = target.pivotalUthmani || "";
  view.fullTextUthmani = fullText(target);
  view.surahOptions = surahOptions;
} else {
  view.targetSurahNumber = target.surahNumber;
  view.targetSurahNameAr = target.surahNameAr || "";
  view.targetAyahNumber = target.ayahNumber;
  view.targetAyahLabel = arabicDigits(target.ayahNumber);
  view.pivotalOptions = pivotalOptions;
}

return {
  view,
  key: {
    targetVerseId: target.id,
    correctOptionId: mode === "surah_identification" ? correctSurahOptionId : correctPivotalOptionId,
    correctOptionTextUthmani:
      mode === "surah_identification" ? surahLabel(target) : target.pivotalUthmani || "",
    correctPivotalUthmani: target.pivotalUthmani || "",
    correctPivotalNormalized: target.pivotalNormalized || "",
    correctSurahNameAr: target.surahNameAr || "",
    correctAyahNumber: target.ayahNumber,
    correctAyahLabel: arabicDigits(target.ayahNumber),
    correctSurahLabelAr: surahLabel(target),
    mnemonicRuleAr: fields.mnemonicRuleAr || "",
    siblings: siblings.map((s) => ({
      id: s.id,
      surahNumber: s.surahNumber,
      surahNameAr: s.surahNameAr,
      ayahNumber: s.ayahNumber,
      ayahLabel: arabicDigits(s.ayahNumber),
      prefixUthmani: s.prefixUthmani || "",
      pivotalUthmani: s.pivotalUthmani || "",
      suffixUthmani: s.suffixUthmani || "",
      textUthmani: fullText(s),
      pivotalNormalized: s.pivotalNormalized || "",
    })),
  },
};
