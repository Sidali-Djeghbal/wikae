const { view } = etude;
const startTime = Date.now();
let usedHint = false;
let activeMode = view.mode === "surah_identification" ? "surah_identification" : "pivotal_completion";
let activeSubmode = view.inputSubmode === "typing" ? "typing" : "choice";
let selectedOptionId = null;
let typedText = "";

function arabicDigits(value) {
  return String(value == null ? "" : value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

// DOM Elements
const badgeTitle = etude.$("#badge-surah-title");
const modeBtns = etude.$$(".mode-btn");
const hintBtn = etude.$("#hint-btn");
const hintBox = etude.$("#hint-container");
const hintText = etude.$("#hint-text");
const surahQuestionBanner = etude.$("#surah-question-banner");
const verseDisplay = etude.$("#verse-display");
const optionsGroup = etude.$("#options-group");
const typingGroup = etude.$("#typing-group");
const typingInput = etude.$("#arabic-typing-input");
const submitTypingBtn = etude.$("#submit-typing-btn");

// Init Hint text
if (view.hintAr) {
  hintText.textContent = view.hintAr;
} else if (hintBtn) {
  hintBtn.classList.add("hidden");
}

// Each atomic card renders the mode it was generated for. The sibling mode is a separate card,
// so hiding the other toggle keeps the target Surah and the unmasked pivotal phrase out of view.
modeBtns.forEach((btn) => {
  const available = btn.dataset.mode === activeMode;
  btn.classList.toggle("hidden", !available);
  btn.disabled = !available;
});

function updateHeader() {
  if (activeMode === "surah_identification") {
    badgeTitle.textContent = "متشابهات الآيات · تحديد السورة";
    surahQuestionBanner.classList.remove("hidden");
  } else {
    const ayah = view.targetAyahLabel || arabicDigits(view.targetAyahNumber);
    badgeTitle.textContent = `سورة ${view.targetSurahNameAr || ""} · آية ${ayah}`;
    surahQuestionBanner.classList.add("hidden");
  }

  modeBtns.forEach((btn) => {
    const bMode = btn.dataset.mode;
    const bSub = btn.dataset.submode;
    const isActive = (bMode === activeMode) && (!bSub || bSub === activeSubmode);
    btn.classList.toggle("is-active", isActive);
  });
}

function renderVerse() {
  if (activeMode === "surah_identification") {
    verseDisplay.innerHTML = `
      <span>${etude.escape(view.prefixUthmani)}</span>
      <span class="pivotal-highlight">${etude.escape(view.pivotalUthmani)}</span>
      <span>${etude.escape(view.suffixUthmani)}</span>
    `;
  } else {
    const slotContent = typedText.trim()
      ? etude.escape(typedText.trim())
      : (selectedOptionId
          ? (view.pivotalOptions?.find((o) => o.id === selectedOptionId)?.textUthmani || "..........")
          : "..........");
    const isFilled = !!(typedText.trim() || selectedOptionId);

    verseDisplay.innerHTML = `
      <span>${etude.escape(view.prefixUthmani)}</span>
      <span class="pivotal-slot ${isFilled ? "is-filled" : ""}" id="verse-slot">${slotContent}</span>
      <span>${etude.escape(view.suffixUthmani)}</span>
    `;
  }
}

function renderOptions() {
  if (activeMode === "pivotal_completion" && activeSubmode === "typing") {
    optionsGroup.classList.add("hidden");
    typingGroup.classList.remove("hidden");
    typingInput.focus();
    return;
  }

  typingGroup.classList.add("hidden");
  optionsGroup.classList.remove("hidden");

  const opts = activeMode === "surah_identification"
    ? (view.surahOptions || [])
    : (view.pivotalOptions || []);

  const keys = ["1", "2", "3", "4", "5", "6"];
  optionsGroup.innerHTML = opts.map((o, idx) => {
    const label = activeMode === "surah_identification" ? o.labelAr : o.textUthmani;
    const isSelected = selectedOptionId === o.id;
    return `
      <button type="button" class="mutashabih-option ${isSelected ? "is-selected" : ""}" data-id="${o.id}">
        <span class="opt-key">${keys[idx] || ""}</span>
        <span class="opt-text ${activeMode === "surah_identification" ? "" : "quran-text"}">${etude.escape(label)}</span>
      </button>
    `;
  }).join("");

  etude.$$(".mutashabih-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (etude.mode !== "answer") return;
      chooseOption(btn.dataset.id);
      submitNow();
    });
  });
}

function chooseOption(id) {
  selectedOptionId = id;
  renderVerse();
  etude.$$(".mutashabih-option").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.id === id);
  });
  etude.setReady(true);
}

function submitNow() {
  if (etude.mode !== "answer") return;
  const answerPayload = {
    mode: activeMode,
    submode: activeSubmode,
    chosenOptionId: selectedOptionId,
    typedText: typedText.trim(),
    timeMs: Date.now() - startTime,
    usedHint,
  };
  etude.submit(answerPayload);
}

// Submode toggles (choice / typing) for pivotal completion cards.
modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (etude.mode !== "answer") return;
    if (btn.dataset.mode !== activeMode) return;
    if (btn.dataset.submode) activeSubmode = btn.dataset.submode;
    updateHeader();
    renderVerse();
    renderOptions();
    etude.setReady(activeSubmode === "typing" ? typedText.trim().length > 0 : !!selectedOptionId);
  });
});

// Hint Toggle
function toggleHint() {
  usedHint = true;
  hintBox.classList.toggle("hidden");
  hintBtn?.classList.toggle("is-active", !hintBox.classList.contains("hidden"));
}

hintBtn?.addEventListener("click", toggleHint);

// Typing Input Handlers
typingInput?.addEventListener("input", (e) => {
  typedText = e.target.value;
  renderVerse();
  etude.setReady(typedText.trim().length > 0);
});

typingInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && typedText.trim().length > 0) {
    e.preventDefault();
    submitNow();
  }
});

submitTypingBtn?.addEventListener("click", () => {
  if (typedText.trim().length > 0) {
    submitNow();
  }
});

// Global Keyboard Navigation
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const isTyping = document.activeElement === typingInput;

  // Toggle Hint with H key
  if ((e.key === "h" || e.key === "H" || e.key === "ا") && !isTyping) {
    e.preventDefault();
    toggleHint();
    return;
  }

  // Answer mode hotkeys (1-4 for options)
  if (etude.mode === "answer" && !isTyping) {
    const keys = ["1", "2", "3", "4", "5", "6"];
    const idx = keys.indexOf(e.key);
    const btns = etude.$$(".mutashabih-option");
    if (idx >= 0 && idx < btns.length) {
      e.preventDefault();
      chooseOption(btns[idx].dataset.id);
      submitNow();
      return;
    }
  }
});

// Setup Answer Collector
etude.getAnswer(() => ({
  mode: activeMode,
  submode: activeSubmode,
  chosenOptionId: selectedOptionId,
  typedText: typedText.trim(),
  timeMs: Date.now() - startTime,
  usedHint,
}));

// Initial Paint
updateHeader();
renderVerse();
renderOptions();
etude.setReady(false);

// -------------------------------------------------------------
// POST-ANSWER STATE: Mutashabihat Comparison Matrix & FSRS Action
// -------------------------------------------------------------
// Rating buttons live outside the card's result flow: bind once and forward the key to the host.
etude.$$(".fsrs-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (etude.mode !== "result") return;
    window.parent.postMessage({ etude: 1, type: "key", key: String(btn.dataset.rating) }, "*");
  });
});

etude.onResult(({ grade, key, answer }) => {
  const ans = answer || {};
  const isCorrect = grade?.details?.isCorrect ?? (grade?.score != null && grade.score > 0.5);
  const timeSec = typeof ans.timeMs === "number" ? (ans.timeMs / 1000).toFixed(1) : null;
  const isSurahMode = (ans.mode || activeMode) === "surah_identification";

  // 1. Verdict Banner
  const verdictBanner = etude.$("#verdict-banner");
  const verdictStatus = etude.$("#verdict-status");
  const verdictTiming = etude.$("#verdict-timing");

  verdictBanner.classList.add(isCorrect ? "is-correct" : "is-wrong");
  const correctAnswer = isSurahMode
    ? (key.correctSurahLabelAr || (key.correctSurahNameAr ? `سورة ${key.correctSurahNameAr}` : ""))
    : (key.correctPivotalUthmani || "");
  verdictStatus.textContent = isCorrect
    ? "✓ أحسنت! إجابة صحيحة ومضبوطة"
    : `✕ غير صحيح · الصواب: ${correctAnswer}`;
  if (timeSec) {
    verdictTiming.textContent = `خلال ${arabicDigits(timeSec).replace(".", "٫")} ثانية${ans.usedHint ? " · مع استعانة بالتلميح" : ""}`;
  }

  // 2. Highlight chosen options in Answer Section
  const targetId = key.correctOptionId;
  etude.$$(".mutashabih-option").forEach((btn) => {
    const bId = btn.dataset.id;
    btn.disabled = true;
    if (bId === targetId) {
      btn.classList.add("is-correct");
    } else if (bId === ans.chosenOptionId && !isCorrect) {
      btn.classList.add("is-wrong");
    }
  });

  // 3. Render Sibling Comparison Matrix (المقارنة والضبط)
  const matrixContainer = etude.$("#sibling-matrix-list");
  const siblings = key.siblings || [];
  matrixContainer.innerHTML = siblings.map((s) => {
    const isTarget = s.id === key.targetVerseId;
    const ayah = s.ayahLabel || arabicDigits(s.ayahNumber);
    return `
      <div class="sibling-item ${isTarget ? "is-target" : ""}">
        <div class="sibling-header">
          <span class="sibling-surah-badge">
            سورة ${etude.escape(s.surahNameAr)} · آية ${ayah}
          </span>
          ${isTarget ? '<span class="target-badge-indicator">الموضع الحالي المستهدف</span>' : ""}
        </div>
        <div class="sibling-verse-text quran-text">
          <span>${etude.escape(s.prefixUthmani || "")}</span>
          <mark class="pivotal-mark">${etude.escape(s.pivotalUthmani || "")}</mark>
          <span>${etude.escape(s.suffixUthmani || "")}</span>
        </div>
      </div>
    `;
  }).join("");

  // 4. Mnemonic Rule Box (قاعدة الضبط والتقعيد)
  const mnemonicContainer = etude.$("#mnemonic-container");
  const mnemonicContent = etude.$("#mnemonic-content");
  if (key.mnemonicRuleAr && key.mnemonicRuleAr.trim()) {
    mnemonicContent.innerHTML = etude.md(key.mnemonicRuleAr);
    mnemonicContainer.classList.remove("hidden");
  }

  // 5. FSRS Auto-Suggestion
  let suggestedRating = 3; // Good
  let suggestedName = "جيد (Good)";

  if (!isCorrect) {
    suggestedRating = 1;
    suggestedName = "أعد (Again)";
  } else if (ans.usedHint || (typeof ans.timeMs === "number" && ans.timeMs > 8000)) {
    suggestedRating = 2;
    suggestedName = "صعب (Hard)";
  } else {
    suggestedRating = 3;
    suggestedName = "جيد (Good)";
  }

  etude.$("#fsrs-recommended-name").textContent = suggestedName;
  etude.$$(".fsrs-btn").forEach((btn) => {
    const r = Number(btn.dataset.rating);
    btn.classList.toggle("is-suggested", r === suggestedRating);
  });
});
