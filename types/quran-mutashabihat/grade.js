// std.normalize (prelude) applies std.normalizeArabic; strip punctuation and collapse spaces.
const normAr = (text) => std.normalize(text).replace(/[.,/#!$%^&*;:{}=\-_`~()؟،؛۝۞]+/g, " ").replace(/\s+/g, " ").trim();

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
