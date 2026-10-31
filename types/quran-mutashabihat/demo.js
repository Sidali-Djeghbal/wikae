if (view.mode === "surah_identification") {
  return {
    mode: "surah_identification",
    chosenOptionId: key.correctOptionId,
    timeMs: 4200,
    usedHint: false,
  };
} else {
  return {
    mode: "pivotal_completion",
    submode: view.inputSubmode === "typing" ? "typing" : "choice",
    chosenOptionId: key.correctOptionId,
    typedText: key.correctPivotalNormalized || key.correctPivotalUthmani,
    timeMs: 3800,
    usedHint: false,
  };
}

