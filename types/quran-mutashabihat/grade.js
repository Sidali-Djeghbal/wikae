// Mirrors src/core/arabicNormalizer.ts; keep the two in step (QuickJS can't import TS).
function normAr(text) {
  if (!text) return "";
  let s = String(text);
  // Convert dagger alef to standard alef for Uthmani comparison
  s = s.replace(/\u0670/g, "ا");
  // Strip tatweel
  s = s.replace(/\u0640/g, "");
  // Strip Tashkeel & Quranic annotations
  s = s.replace(/[\u0610-\u061A\u061C\u064B-\u065F\u0670\u06D6-\u06ED\u06DD\u06DE\u08D4-\u08ED\u08EF-\u08F3]/g, "");
  // Normalize Alef variants
  s = s.replace(/[أإآٱٲٳ]/g, "ا");
  // Handle isolated Hamza + Alef
  s = s.replace(/ءا/g, "ا");
  s = s.replace(/ا{2,}/g, "ا");
  // Normalize Alef Maksura
  s = s.replace(/ى/g, "ي");
  // Normalize Teh Marbuta
  s = s.replace(/ة/g, "ه");
  // Strip zero-width & punctuation
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[.,/#!$%^&*;:{}=\-_`~()؟،؛۝۞]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

const ans = typeof answer === "string" ? { chosenOptionId: answer, typedText: answer } : answer || {};
const mode = ans.mode || view.mode || "pivotal_completion";
const submode = ans.submode || view.inputSubmode || "choice";

let isCorrect = false;

if (submode === "typing" && typeof ans.typedText === "string" && ans.typedText.trim()) {
  const userNorm = normAr(ans.typedText);
  const targets = [normAr(key.correctPivotalNormalized), normAr(key.correctPivotalUthmani)].filter(Boolean);
  isCorrect = userNorm.length > 0 && targets.indexOf(userNorm) !== -1;
} else {
  const chosenId = ans.chosenOptionId;
  if (typeof chosenId === "string") {
    if (mode === "surah_identification") {
      // Opaque option id from the card, or the sibling id for CLI/API callers.
      isCorrect = chosenId === key.correctOptionId || chosenId === key.targetVerseId;
    } else {
      isCorrect =
        chosenId === key.correctOptionId ||
        chosenId === key.targetVerseId ||
        chosenId === key.correctPivotalUthmani ||
        normAr(chosenId) === normAr(key.correctPivotalNormalized);
    }
  }
}

let score = 0;
const usedHint = !!ans.usedHint;
const timeMs = typeof ans.timeMs === "number" ? ans.timeMs : null;

if (isCorrect) {
  // Correct on 1st attempt (< 8 seconds, no hint): score 1.0 (suggests Good)
  // Correct after using hint or slow response (> 8s): score 0.6 (suggests Hard)
  if (usedHint || (timeMs !== null && timeMs > 8000)) {
    score = 0.6;
  } else {
    score = 1.0;
  }
} else {
  // Incorrect attempt: score 0.0 (suggests Again)
  score = 0.0;
}

return {
  score,
  details: {
    isCorrect,
    mode,
    submode,
    usedHint,
    timeMs,
    chosenOptionId: ans.chosenOptionId || null,
    typedText: ans.typedText || null,
    correctOptionId: key.correctOptionId,
    correctOptionTextUthmani: key.correctOptionTextUthmani,
    correctPivotalUthmani: key.correctPivotalUthmani,
    correctSurahNameAr: key.correctSurahNameAr,
    correctAyahNumber: key.correctAyahNumber,
    correctSurahLabelAr: key.correctSurahLabelAr,
  },
};
